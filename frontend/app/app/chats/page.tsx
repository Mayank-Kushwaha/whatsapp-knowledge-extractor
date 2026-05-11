"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquareText,
  Calendar,
  Users,
  ArrowRight,
  Upload,
  Loader2,
} from "lucide-react";
import { getChats, type Chat } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// ---------------------------------------------------------------------------
// Chat Card
// ---------------------------------------------------------------------------

function ChatCard({ chat, index }: { chat: Chat; index: number }) {
  const statusConfig = {
    ready: { label: "Ready", color: "text-emerald-400", bg: "bg-emerald-400/10", dot: "bg-emerald-400" },
    processing: { label: "Processing", color: "text-amber-400", bg: "bg-amber-400/10", dot: "bg-amber-400 animate-pulse" },
    error: { label: "Error", color: "text-red-400", bg: "bg-red-400/10", dot: "bg-red-400" },
  };

  const status = statusConfig[chat.status as keyof typeof statusConfig] || statusConfig.ready;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <Link href={`/app/chats/${chat.id}`}>
        <motion.div
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          className="group relative rounded-2xl p-5 glass-card hover:border-white/15 transition-all duration-300 cursor-pointer"
        >
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-purple-500/15 flex items-center justify-center">
              <MessageSquareText className="w-5 h-5 text-blue-400" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-base font-semibold truncate">{chat.name}</h3>
                <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                  {status.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <MessageSquareText className="w-3.5 h-3.5" />
                  {chat.message_count.toLocaleString()} messages
                </span>
                {(chat as Chat & { sender_count?: number }).sender_count ? (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {(chat as Chat & { sender_count?: number }).sender_count} senders
                  </span>
                ) : null}
                {chat.date_range_start && (
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(chat.date_range_start)} — {formatDate(chat.date_range_end)}
                  </span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all duration-200 flex-shrink-0 mt-1" />
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Empty State
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="w-20 h-20 rounded-2xl bg-white/3 flex items-center justify-center mb-6">
        <MessageSquareText className="w-9 h-9 text-muted-foreground/40" />
      </div>
      <h2 className="text-xl font-semibold mb-2">No chats yet</h2>
      <p className="text-muted-foreground text-sm max-w-sm mb-8">
        Upload your first WhatsApp chat export to get started. We&apos;ll automatically parse, classify, and organize everything.
      </p>
      <Link href="/app/upload">
        <motion.div
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-sm bg-gradient-to-r from-blue-600 to-purple-600 text-white"
        >
          <Upload className="w-4 h-4" />
          Upload Chat Export
        </motion.div>
      </Link>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Chats Page
// ---------------------------------------------------------------------------

export default function ChatsPage() {
  const { chats, setChats } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChats() {
      try {
        const data = await getChats();
        setChats(data);
      } catch {
        // Backend may not be running
      } finally {
        setLoading(false);
      }
    }
    fetchChats();
  }, [setChats]);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Chats</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {chats.length > 0
              ? `${chats.length} chat${chats.length > 1 ? "s" : ""} uploaded`
              : "Upload a chat to get started"}
          </p>
        </div>
        <Link href="/app/upload">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/6 border border-white/10 hover:bg-white/10 transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            Upload
          </motion.div>
        </Link>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : chats.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {chats.map((chat, i) => (
            <ChatCard key={chat.id} chat={chat} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
