"""Authentication: verifying Google ID tokens issued by NextAuth.

The frontend signs in users via NextAuth's Google provider and forwards
Google's ID token to the backend as `Authorization: Bearer <id_token>`.
This module verifies the token's signature against Google's public JWKS
and confirms the `aud` claim matches our configured GOOGLE_CLIENT_ID.

The returned payload's `sub` claim is the stable, opaque Google user id
that we store as `chats.owner_id`. Email/name are returned alongside for
display purposes only — never for authorization decisions.
"""

import logging
from typing import Optional

from fastapi import Header, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from app.core.config import GOOGLE_CLIENT_ID

logger = logging.getLogger(__name__)

# Reused across requests — google-auth's Request wraps a session-like
# object; constructing it once avoids per-request overhead.
_google_request = google_requests.Request()


def verify_google_id_token(token: str) -> dict:
    """Verify a Google ID token and return its decoded claims.

    Raises HTTPException(401) on any verification failure (bad signature,
    expired, wrong audience, malformed).
    """
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server is not configured with GOOGLE_CLIENT_ID.",
        )

    try:
        claims = google_id_token.verify_oauth2_token(
            token,
            _google_request,
            GOOGLE_CLIENT_ID,
        )
    except ValueError as e:
        logger.info(f"[Auth] Google ID token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired Google credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not claims.get("sub"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is missing the subject claim.",
        )

    return claims


def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """FastAPI dependency: returns the signed-in user's claims.

    Expects `Authorization: Bearer <google_id_token>`. Raises 401 if the
    header is missing/malformed or the token is invalid.

    Returns a dict with at least `sub`, plus `email` and `name` if Google
    included them in the token.
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Empty bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    claims = verify_google_id_token(token)
    return {
        "sub": claims["sub"],
        "email": claims.get("email"),
        "name": claims.get("name"),
        "picture": claims.get("picture"),
    }


def require_owned_chat(db, chat_id: int, user: dict):
    """Fetch a chat by id, returning it only if the current user owns it.

    Returns the Chat ORM row. Raises 404 (not 403) for missing OR
    not-owned so we never disclose the existence of someone else's chat.

    `db` is a SQLAlchemy Session; `user` is the dict returned by
    get_current_user. Kept here (not in db.py) to avoid a circular
    import between auth and models.
    """
    from app.models.db import Chat

    chat = db.query(Chat).filter(
        Chat.id == chat_id,
        Chat.owner_id == user["sub"],
    ).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat
