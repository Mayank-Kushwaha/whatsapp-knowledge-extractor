"use client";

import { useEffect, useState, use, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Image as ImageIcon,
  X,
  Download,
  User,
  Calendar,
  Loader2,
  ArrowLeft,
  Inbox,
  ZoomIn,
} from "lucide-react";
import {
  getChatMedia,
  mediaUrl,
  formatRelativeTime,
  type MediaItemResponse,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Lightbox Modal
// ---------------------------------------------------------------------------

function LightboxModal({
  item,
  onClose,
}: {
  item: MediaItemResponse;
  onClose: () => void;
}) {
  // Close on escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const imgSrc = item.local_path ? mediaUrl(item.local_path) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative max-w-4xl max-h-[85vh] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Image */}
        {imgSrc && (
          <img
            src={imgSrc}
            alt={item.original_filename || "Image"}
            className="max-w-full max-h-[75vh] rounded-2xl object-contain"
          />
        )}

        {/* Info bar */}
        <div className="mt-4 flex items-center justify-between p-4 rounded-xl bg-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-4 text-sm">
            {item.sender && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <User className="w-3.5 h-3.5" />
                {item.sender.display_name}
              </span>
            )}
            {item.timestamp && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {formatRelativeTime(item.timestamp)}
              </span>
            )}
            {item.original_filename && (
              <span className="text-muted-foreground/60 text-xs truncate max-w-[200px]">
                {item.original_filename}
              </span>
            )}
          </div>

          {imgSrc && (
            <a
              href={imgSrc}
              download={item.original_filename || "image"}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Image Tile
// ---------------------------------------------------------------------------

function ImageTile({
  item,
  index,
  onClick,
}: {
  item: MediaItemResponse;
  index: number;
  onClick: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  // Lazy loading with intersection observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, []);

  const imgSrc = item.local_path ? mediaUrl(item.local_path) : null;

  return (
    <motion.div
      ref={imgRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.5), duration: 0.3 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.15 } }}
      onClick={onClick}
      className="relative rounded-xl overflow-hidden cursor-pointer group break-inside-avoid mb-4"
      style={{ backgroundColor: "var(--type-image-bg)" }}
    >
      {isVisible && imgSrc ? (
        <>
          <img
            src={imgSrc}
            alt={item.original_filename || "Image"}
            className={`w-full transition-all duration-500 ${
              loaded ? "opacity-100" : "opacity-0"
            }`}
            onLoad={() => setLoaded(true)}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
          {!loaded && (
            <div className="w-full h-48 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-48 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-muted-foreground/30" />
        </div>
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end">
        <div className="p-3 w-full">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/80 truncate">
              {item.sender?.display_name || ""}
            </div>
            <ZoomIn className="w-4 h-4 text-white/60" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ backgroundColor: "var(--type-image-bg)" }}
      >
        <Inbox className="w-8 h-8" style={{ color: "var(--type-image)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2">No images found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        This chat doesn&apos;t contain any images yet. Images shared in WhatsApp
        conversations will appear here in a gallery view.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Images Page
// ---------------------------------------------------------------------------

export default function ImagesPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chatId = parseInt(resolvedParams.id);

  const [images, setImages] = useState<MediaItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedImage, setSelectedImage] = useState<MediaItemResponse | null>(null);

  // Fetch images
  useEffect(() => {
    async function fetchImages() {
      setLoading(true);
      try {
        const result = await getChatMedia(chatId, { type: "image", page: 1, page_size: 30 });
        setImages(result.items);
        setTotal(result.total);
        setHasMore(result.has_next);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchImages();
  }, [chatId]);

  // Load more
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getChatMedia(chatId, { type: "image", page: nextPage, page_size: 30 });
      setImages((prev) => [...prev, ...result.items]);
      setPage(nextPage);
      setHasMore(result.has_next);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, page]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8"
      >
        <Link
          href={`/app/chats/${chatId}`}
          className="p-2 rounded-xl hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--type-image-bg)" }}
            >
              <ImageIcon className="w-4 h-4" style={{ color: "var(--type-image)" }} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Images</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-10">
            {total} image{total !== 1 ? "s" : ""} shared
          </p>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : images.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Masonry grid */}
          <div className="columns-2 md:columns-3 lg:columns-4 gap-4">
            {images.map((img, i) => (
              <ImageTile
                key={img.id}
                item={img}
                index={i}
                onClick={() => setSelectedImage(img)}
              />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center mt-8"
            >
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </motion.div>
          )}
        </>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <LightboxModal
            item={selectedImage}
            onClose={() => setSelectedImage(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
