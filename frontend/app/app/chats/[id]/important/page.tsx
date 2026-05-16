"use client";

import { useEffect, useState, use, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Star,
  Flag,
  Hash,
  Smile,
  Hand,
  Download,
  User,
  Calendar,
  Loader2,
  ArrowLeft,
  Inbox,
  Check,
} from "lucide-react";
import {
  getChatImportant,
  toggleImportance,
  formatRelativeTime,
  type ImportantMessage,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Trigger type config
// ---------------------------------------------------------------------------

const TRIGGER_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  keyword: { label: "Keyword", icon: Hash, color: "oklch(0.7 0.15 165)" },
  emoji: { label: "Emoji", icon: Smile, color: "oklch(0.8 0.18 85)" },
  manual: { label: "Manual", icon: Hand, color: "oklch(0.65 0.18 265)" },
};

// ---------------------------------------------------------------------------
// Message Card
// ---------------------------------------------------------------------------

function ImportantCard({
  message,
  index,
  chatId,
  onToggle,
}: {
  message: ImportantMessage;
  index: number;
  chatId: number;
  onToggle: (id: number, newState: boolean) => void;
}) {
  const [toggling, setToggling] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      const result = await toggleImportance(chatId, message.id);
      onToggle(message.id, result.is_important);
    } catch {
      // ignore
    } finally {
      setToggling(false);
    }
  }

  // Get the primary trigger
  const primaryFlag = message.flags[0];
  const triggerConfig = primaryFlag
    ? TRIGGER_CONFIG[primaryFlag.trigger_type] || TRIGGER_CONFIG.keyword
    : TRIGGER_CONFIG.keyword;
  const TriggerIcon = triggerConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: `linear-gradient(135deg, oklch(0.8 0.18 85 / 4%) 0%, oklch(0.75 0.15 70 / 2%) 100%)`,
        border: "1px solid oklch(0.8 0.18 85 / 12%)",
      }}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Star indicator */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ backgroundColor: "var(--type-important-bg)" }}
          >
            <Star className="w-4 h-4" style={{ color: "var(--type-important)" }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Message content */}
            <p className="text-sm leading-relaxed mb-3">{message.content}</p>

            {/* Trigger badges */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {message.flags.map((flag, i) => {
                const cfg = TRIGGER_CONFIG[flag.trigger_type] || TRIGGER_CONFIG.keyword;
                const FlagIcon = cfg.icon;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: `color-mix(in oklch, ${cfg.color} 12%, transparent)`,
                      color: cfg.color,
                    }}
                  >
                    <FlagIcon className="w-2.5 h-2.5" />
                    {flag.trigger_value || flag.trigger_type}
                  </span>
                );
              })}
            </div>

            {/* Meta */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70">
              {message.sender && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {message.sender.display_name}
                </span>
              )}
              {message.timestamp && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatRelativeTime(message.timestamp)}
                </span>
              )}
            </div>
          </div>

          {/* Toggle flag button */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors flex-shrink-0"
            title="Unflag this message"
          >
            {toggling ? (
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            ) : (
              <Flag className="w-4 h-4" style={{ color: "var(--type-important)" }} />
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Filter Chip
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  icon: Icon,
  isActive,
  onClick,
  color,
}: {
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        isActive
          ? "border"
          : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
      }`}
      style={
        isActive
          ? {
              backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
              color,
              borderColor: `color-mix(in oklch, ${color} 30%, transparent)`,
            }
          : undefined
      }
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
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
        style={{ backgroundColor: "var(--type-important-bg)" }}
      >
        <Inbox className="w-8 h-8" style={{ color: "var(--type-important)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2">No important messages</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Messages flagged as important will appear here. Messages are auto-flagged based
        on keywords (like &quot;important&quot;, &quot;urgent&quot;) and emojis (like ❗, ⚠️, 📌).
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Important Page
// ---------------------------------------------------------------------------

export default function ImportantPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chatId = parseInt(resolvedParams.id);

  const [messages, setMessages] = useState<ImportantMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [triggerFilter, setTriggerFilter] = useState<string | null>(null);

  // Fetch messages
  useEffect(() => {
    setPage(1);
    async function fetchImportant() {
      setLoading(true);
      try {
        const result = await getChatImportant(chatId, {
          page: 1,
          page_size: 30,
          trigger_type: triggerFilter || undefined,
          sort: "desc",
        });
        setMessages(result.messages);
        setTotal(result.total);
        setHasMore(result.has_next);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchImportant();
  }, [chatId, triggerFilter]);

  // Load more
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getChatImportant(chatId, {
        page: nextPage,
        page_size: 30,
        trigger_type: triggerFilter || undefined,
        sort: "desc",
      });
      setMessages((prev) => [...prev, ...result.messages]);
      setPage(nextPage);
      setHasMore(result.has_next);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [chatId, page, triggerFilter]);

  // Handle toggle
  function handleToggle(messageId: number, newState: boolean) {
    if (!newState) {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      setTotal((prev) => prev - 1);
    }
  }

  // Export to markdown
  function exportMarkdown() {
    const lines: string[] = [
      "# Important Messages",
      "",
      `> Exported ${messages.length} important messages`,
      "",
      "---",
      "",
    ];

    for (const msg of messages) {
      const sender = msg.sender?.display_name || "Unknown";
      const date = msg.timestamp ? formatRelativeTime(msg.timestamp) : "—";
      const triggers = msg.flags.map((f) => f.trigger_value || f.trigger_type).join(", ");

      lines.push(`### ${sender} — ${date}`);
      lines.push("");
      lines.push(msg.content);
      lines.push("");
      if (triggers) {
        lines.push(`_Trigger: ${triggers}_`);
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `important-messages-chat-${chatId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-6"
      >
        <div className="flex items-center gap-3">
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
                style={{ backgroundColor: "var(--type-important-bg)" }}
              >
                <Star className="w-4 h-4" style={{ color: "var(--type-important)" }} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Important</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-10">
              {total} important message{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        {messages.length > 0 && (
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-white/10 text-muted-foreground transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export .md
          </button>
        )}
      </motion.div>

      {/* Trigger filters */}
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-2 mb-6"
      >
        <FilterChip
          label="All"
          icon={Star}
          isActive={triggerFilter === null}
          onClick={() => setTriggerFilter(null)}
          color="var(--type-important)"
        />
        <FilterChip
          label="Keywords"
          icon={Hash}
          isActive={triggerFilter === "keyword"}
          onClick={() => setTriggerFilter(triggerFilter === "keyword" ? null : "keyword")}
          color={TRIGGER_CONFIG.keyword.color}
        />
        <FilterChip
          label="Emojis"
          icon={Smile}
          isActive={triggerFilter === "emoji"}
          onClick={() => setTriggerFilter(triggerFilter === "emoji" ? null : "emoji")}
          color={TRIGGER_CONFIG.emoji.color}
        />
        <FilterChip
          label="Manual"
          icon={Hand}
          isActive={triggerFilter === "manual"}
          onClick={() => setTriggerFilter(triggerFilter === "manual" ? null : "manual")}
          color={TRIGGER_CONFIG.manual.color}
        />
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : messages.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {messages.map((msg, i) => (
                <ImportantCard
                  key={msg.id}
                  message={msg}
                  index={i}
                  chatId={chatId}
                  onToggle={handleToggle}
                />
              ))}
            </AnimatePresence>
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
    </div>
  );
}
