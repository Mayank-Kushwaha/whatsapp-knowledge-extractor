"use client";

import { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Video,
  Play,
  ExternalLink,
  User,
  Calendar,
  Loader2,
  ArrowLeft,
  Inbox,
  X,
} from "lucide-react";
import {
  getChatLinks,
  getChatMedia,
  mediaUrl,
  formatRelativeTime,
  getYouTubeThumbnail,
  getYouTubeEmbedUrl,
  type LinkItem,
  type MediaItemResponse,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VideoEntry {
  id: string;
  type: "youtube" | "local";
  title: string;
  thumbnail: string | null;
  embedUrl: string | null;
  localPath: string | null;
  url: string | null;
  sender: string | null;
  timestamp: string | null;
  filename: string | null;
}

// ---------------------------------------------------------------------------
// YouTube Embed Modal
// ---------------------------------------------------------------------------

function EmbedModal({
  embedUrl,
  title,
  onClose,
}: {
  embedUrl: string;
  title: string;
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

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
        className="relative w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="relative w-full pt-[56.25%] rounded-2xl overflow-hidden bg-black">
          <iframe
            src={embedUrl}
            title={title}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Video Card
// ---------------------------------------------------------------------------

function VideoCard({
  entry,
  index,
  onPlay,
}: {
  entry: VideoEntry;
  index: number;
  onPlay: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="rounded-2xl glass-card overflow-hidden hover:border-white/15 transition-all duration-300 group cursor-pointer"
      onClick={onPlay}
    >
      {/* Thumbnail / Player */}
      <div className="relative aspect-video bg-white/3 overflow-hidden">
        {entry.type === "local" && entry.localPath ? (
          <video
            src={mediaUrl(entry.localPath)}
            className="w-full h-full object-cover"
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
            controls
          />
        ) : entry.thumbnail ? (
          <>
            <img
              src={entry.thumbnail}
              alt={entry.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
            {/* Play button overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-white ml-1" />
              </div>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Video className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="text-sm font-semibold line-clamp-2 mb-2 leading-snug">
          {entry.title}
        </h3>

        {entry.type === "youtube" && (
          <span
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full mb-2"
            style={{
              backgroundColor: "var(--type-video-bg)",
              color: "var(--type-video)",
            }}
          >
            YouTube
          </span>
        )}

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 pt-2 border-t border-white/5">
          {entry.sender && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {entry.sender}
            </span>
          )}
          {entry.timestamp && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatRelativeTime(entry.timestamp)}
            </span>
          )}
          {entry.url && entry.type === "youtube" && (
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="ml-auto flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
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
        style={{ backgroundColor: "var(--type-video-bg)" }}
      >
        <Inbox className="w-8 h-8" style={{ color: "var(--type-video)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2">No videos found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        This chat doesn&apos;t contain any videos yet. YouTube links and local video files
        will appear here.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Videos Page
// ---------------------------------------------------------------------------

export default function VideosPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chatId = parseInt(resolvedParams.id);

  const [videos, setVideos] = useState<VideoEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [embedEntry, setEmbedEntry] = useState<VideoEntry | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      setLoading(true);
      try {
        const entries: VideoEntry[] = [];

        // 1. Fetch YouTube links
        const linksResult = await getChatLinks(chatId, {
          link_type: "youtube",
          page_size: 100,
        });
        for (const link of linksResult.links) {
          const thumb = getYouTubeThumbnail(link.url);
          const embed = getYouTubeEmbedUrl(link.url);
          entries.push({
            id: `link-${link.id}`,
            type: "youtube",
            title: link.og_title || link.url,
            thumbnail: thumb,
            embedUrl: embed,
            localPath: null,
            url: link.url,
            sender: link.sender?.display_name || null,
            timestamp: link.timestamp,
            filename: null,
          });
        }

        // 2. Fetch local video files
        const mediaResult = await getChatMedia(chatId, {
          type: "video",
          page_size: 100,
        });
        for (const item of mediaResult.items) {
          entries.push({
            id: `media-${item.id}`,
            type: "local",
            title: item.original_filename || "Video",
            thumbnail: null,
            embedUrl: null,
            localPath: item.local_path,
            url: null,
            sender: item.sender?.display_name || null,
            timestamp: item.timestamp,
            filename: item.original_filename,
          });
        }

        setVideos(entries);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchVideos();
  }, [chatId]);

  function handlePlay(entry: VideoEntry) {
    if (entry.type === "youtube" && entry.embedUrl) {
      setEmbedEntry(entry);
    }
    // Local videos play inline via <video> controls
  }

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
              style={{ backgroundColor: "var(--type-video-bg)" }}
            >
              <Video className="w-4 h-4" style={{ color: "var(--type-video)" }} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Videos</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-10">
            {videos.length} video{videos.length !== 1 ? "s" : ""}
          </p>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : videos.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((entry, i) => (
            <VideoCard
              key={entry.id}
              entry={entry}
              index={i}
              onPlay={() => handlePlay(entry)}
            />
          ))}
        </div>
      )}

      {/* YouTube Embed Modal */}
      <AnimatePresence>
        {embedEntry && embedEntry.embedUrl && (
          <EmbedModal
            embedUrl={embedEntry.embedUrl}
            title={embedEntry.title}
            onClose={() => setEmbedEntry(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
