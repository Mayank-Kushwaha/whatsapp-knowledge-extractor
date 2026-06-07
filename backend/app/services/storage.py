"""Media storage abstraction — local filesystem or Cloudinary.

The pipeline stages media files (images, videos, PDFs, audio, etc.) extracted
from a WhatsApp .zip export. In dev or on a paid Render disk we keep them on
the local filesystem; on Render free tier the container filesystem is
ephemeral, so we offload to Cloudinary instead.

A single `get_storage()` factory returns the right backend based on
`MEDIA_BACKEND` env var. Callers should treat the returned `url_or_path`
opaquely — it goes straight into `media_items.local_path`, and the frontend's
`mediaUrl()` helper handles both absolute https URLs (Cloudinary) and
MEDIA_DIR-relative paths (local).
"""

import logging
import os
from pathlib import Path
from typing import Optional, Protocol

from app.core.config import (
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_CLOUD_NAME,
    MEDIA_BACKEND,
    MEDIA_DIR,
)

logger = logging.getLogger(__name__)


# Cloudinary public_id "folders" only allow these characters; anything else is
# stripped or replaced. WhatsApp filenames can contain spaces and parentheses,
# so we sanitise before uploading.
_SAFE_PUBLIC_ID_CHARS = set(
    "abcdefghijklmnopqrstuvwxyz"
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    "0123456789-_./"
)


def _sanitise_public_id(s: str) -> str:
    return "".join(c if c in _SAFE_PUBLIC_ID_CHARS else "_" for c in s)


class MediaStorage(Protocol):
    """Storage backend interface used by the pipeline."""

    def save(
        self,
        owner_id: str,
        chat_id: int,
        media_type: str,
        filename: str,
        source_path: Path,
    ) -> str:
        """Persist a media file and return the value to store in
        media_items.local_path (a relative path for local, full URL for cloud).
        """
        ...

    def delete_chat(self, owner_id: str, chat_id: int) -> None:
        """Remove all media for a chat. Called on chat deletion."""
        ...


class LocalStorage:
    """Writes files under MEDIA_DIR/<chat_id>/ and returns relative paths.

    Preserves the original behaviour the codebase had before Cloudinary was
    introduced — the frontend's `/media/<local_path>` URLs continue to work
    via FastAPI's StaticFiles mount.
    """

    def save(
        self,
        owner_id: str,
        chat_id: int,
        media_type: str,
        filename: str,
        source_path: Path,
    ) -> str:
        target_dir = MEDIA_DIR / str(chat_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        target = target_dir / filename
        if source_path.resolve() != target.resolve():
            target.write_bytes(source_path.read_bytes())
        # Return a path RELATIVE to MEDIA_DIR — matches what the classifier
        # was previously computing with os.path.relpath.
        return f"{chat_id}/{filename}".replace(os.sep, "/")

    def delete_chat(self, owner_id: str, chat_id: int) -> None:
        import shutil

        target_dir = MEDIA_DIR / str(chat_id)
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)


class CloudinaryStorage:
    """Uploads files to Cloudinary and returns the secure_url.

    Per-user isolation:
      - public_id prefix is `users/<owner_id>/chats/<chat_id>/<media_type>/`.
      - The owner_id is the Google `sub` claim, already used as
        `chats.owner_id`. The frontend never sees other users' chat IDs (the
        chat list endpoint filters by owner_id), so a leaked Cloudinary URL
        is the only way to reach another user's media — and that URL carries
        a non-guessable random version segment.
    """

    def __init__(self):
        import cloudinary  # local import: keeps import error scoped to cloud mode

        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True,
        )

    @staticmethod
    def _cloudinary_resource_type(media_type: str, filename: str) -> str:
        # Cloudinary requires telling it whether the asset is image/video/raw.
        # Anything that isn't an obvious image or video goes to "raw" so its
        # bytes are preserved verbatim (PDFs, docs, audio, etc.). This avoids
        # Cloudinary's image-pipeline rejecting non-image inputs.
        if media_type == "image":
            return "image"
        if media_type == "video":
            return "video"
        return "raw"

    def _folder(self, owner_id: str, chat_id: int, media_type: str) -> str:
        return _sanitise_public_id(
            f"users/{owner_id}/chats/{chat_id}/{media_type}"
        )

    def save(
        self,
        owner_id: str,
        chat_id: int,
        media_type: str,
        filename: str,
        source_path: Path,
    ) -> str:
        import cloudinary.uploader

        folder = self._folder(owner_id, chat_id, media_type)
        resource_type = self._cloudinary_resource_type(media_type, filename)
        # Strip the extension from public_id; Cloudinary appends the format
        # itself when resource_type is "image" or "video". For "raw" we keep
        # the extension since Cloudinary uses the public_id as-is.
        name_no_ext = Path(filename).stem
        public_id = (
            _sanitise_public_id(filename)
            if resource_type == "raw"
            else _sanitise_public_id(name_no_ext)
        )
        try:
            result = cloudinary.uploader.upload(
                str(source_path),
                folder=folder,
                public_id=public_id,
                resource_type=resource_type,
                overwrite=True,
                unique_filename=False,
            )
        except Exception as e:
            logger.error(
                f"[Cloudinary] upload failed for {filename} "
                f"(owner={owner_id}, chat={chat_id}): {e}"
            )
            raise
        url: Optional[str] = result.get("secure_url")
        if not url:
            raise RuntimeError(
                f"Cloudinary upload returned no secure_url for {filename}"
            )
        return url

    def delete_chat(self, owner_id: str, chat_id: int) -> None:
        # Best-effort: delete the per-chat folder across all three resource
        # types Cloudinary segregates content into. Errors are logged but not
        # re-raised so a single failure doesn't block chat deletion.
        import cloudinary.api

        folder = _sanitise_public_id(f"users/{owner_id}/chats/{chat_id}")
        for rt in ("image", "video", "raw"):
            try:
                cloudinary.api.delete_resources_by_prefix(
                    folder, resource_type=rt
                )
            except Exception as e:
                logger.warning(
                    f"[Cloudinary] delete_resources_by_prefix failed "
                    f"(folder={folder}, type={rt}): {e}"
                )
        # Also drop the empty folders themselves.
        try:
            cloudinary.api.delete_folder(folder)
        except Exception:
            pass


# Module-level singleton — Cloudinary's SDK reads config from a thread-local
# state set by cloudinary.config(), so we only need one instance.
_storage: Optional[MediaStorage] = None


def get_storage() -> MediaStorage:
    """Return the configured storage backend (memoised)."""
    global _storage
    if _storage is not None:
        return _storage
    if MEDIA_BACKEND == "cloudinary":
        if not (CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET):
            raise RuntimeError(
                "MEDIA_BACKEND=cloudinary but CLOUDINARY_CLOUD_NAME / "
                "CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET are not all set."
            )
        _storage = CloudinaryStorage()
    else:
        _storage = LocalStorage()
    return _storage


def is_absolute_url(value: Optional[str]) -> bool:
    """True for full https URLs (Cloudinary case). Used by the /media endpoint
    and frontend helpers to decide between redirecting and prefixing."""
    return bool(value) and (value.startswith("https://") or value.startswith("http://"))
