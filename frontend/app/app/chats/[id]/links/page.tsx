"use client";

import { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Link2,
  ExternalLink,
  Globe,
  Filter,
  ChevronDown,
  ChevronUp,
  Loader2,
  User,
  Calendar,
  ArrowLeft,
  Inbox,
} from "lucide-react";
import {
  getChatLinks,
  getChatLinkDomains,
  formatRelativeTime,
  type LinkItem,
  type DomainBreakdown,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Link Card
// ---------------------------------------------------------------------------

function LinkCard({ link, index }: { link: LinkItem; index: number }) {
  const hasOg = link.og_title || link.og_description || link.og_image_url;
  const faviconUrl = link.domain
    ? `https://www.google.com/s2/favicons?domain=${link.domain}&sz=32`
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      className="rounded-2xl glass-card overflow-hidden hover:border-white/15 transition-all duration-300 group"
    >
      {/* OG Image */}
      {link.og_image_url && (
        <div className="h-40 overflow-hidden bg-white/3">
          <img
            src={link.og_image_url}
            alt={link.og_title || "Link preview"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}

      <div className="p-5">
        {/* Domain + Type badge */}
        <div className="flex items-center gap-2 mb-3">
          {faviconUrl && (
            <img
              src={faviconUrl}
              alt=""
              className="w-4 h-4 rounded-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          )}
          <span className="text-xs font-medium text-muted-foreground">
            {link.domain || "Unknown"}
          </span>
          {link.link_type && link.link_type !== "generic" && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "var(--type-link-bg)",
                color: "var(--type-link)",
              }}
            >
              {link.link_type}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold mb-1 line-clamp-2 leading-snug">
          {hasOg && link.og_title ? link.og_title : link.url}
        </h3>

        {/* Description */}
        {link.og_description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">
            {link.og_description}
          </p>
        )}

        {/* URL */}
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors truncate mb-3"
        >
          <ExternalLink className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{link.url}</span>
        </a>

        {/* Footer: sender + date */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/70 pt-3 border-t border-white/5">
          {link.sender && (
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {link.sender.display_name}
            </span>
          )}
          {link.timestamp && (
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatRelativeTime(link.timestamp)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Domain Filter Chip
// ---------------------------------------------------------------------------

function DomainChip({
  domain,
  count,
  isActive,
  onClick,
}: {
  domain: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
        isActive
          ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
          : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
      }`}
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
        alt=""
        className="w-3 h-3 rounded-sm"
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
      {domain}
      <span className="text-[10px] opacity-60 tabular-nums">{count}</span>
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
        style={{ backgroundColor: "var(--type-link-bg)" }}
      >
        <Inbox className="w-8 h-8" style={{ color: "var(--type-link)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2">No links found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        This chat doesn&apos;t contain any shared links yet. Links shared in WhatsApp
        conversations will appear here with their preview cards.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Links Page
// ---------------------------------------------------------------------------

export default function LinksPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chatId = parseInt(resolvedParams.id);

  const [links, setLinks] = useState<LinkItem[]>([]);
  const [domains, setDomains] = useState<DomainBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(true);

  // Fetch domains for filter chips
  useEffect(() => {
    async function fetchDomains() {
      try {
        const data = await getChatLinkDomains(chatId);
        setDomains(data.sort((a, b) => b.count - a.count).slice(0, 12));
      } catch {
        // ignore
      }
    }
    fetchDomains();
  }, [chatId]);

  // Fetch links with filters
  useEffect(() => {
    setPage(1);
    setLinks([]);
    async function fetchLinks() {
      setLoading(true);
      try {
        const result = await getChatLinks(chatId, {
          page: 1,
          page_size: 24,
          domain: selectedDomain || undefined,
        });
        setLinks(result.links);
        setTotal(result.total);
        setHasMore(result.has_next);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchLinks();
  }, [chatId, selectedDomain]);

  // Load more
  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await getChatLinks(chatId, {
        page: nextPage,
        page_size: 24,
        domain: selectedDomain || undefined,
      });
      setLinks((prev) => [...prev, ...result.links]);
      setPage(nextPage);
      setHasMore(result.has_next);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
                style={{ backgroundColor: "var(--type-link-bg)" }}
              >
                <Link2 className="w-4 h-4" style={{ color: "var(--type-link)" }} />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Links</h1>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 ml-10">
              {total} link{total !== 1 ? "s" : ""} shared
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-white/5 transition-colors"
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {showFilters ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </motion.div>

      {/* Domain Filter Chips */}
      <AnimatePresence>
        {showFilters && domains.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mb-6"
          >
            <div className="flex flex-wrap gap-2 p-4 rounded-2xl glass-card">
              <button
                onClick={() => setSelectedDomain(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  selectedDomain === null
                    ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    : "bg-white/5 text-muted-foreground hover:bg-white/10 border border-transparent"
                }`}
              >
                <Globe className="w-3 h-3 inline mr-1" />
                All domains
              </button>
              {domains.map((d) => (
                <DomainChip
                  key={d.domain}
                  domain={d.domain}
                  count={d.count}
                  isActive={selectedDomain === d.domain}
                  onClick={() =>
                    setSelectedDomain(selectedDomain === d.domain ? null : d.domain)
                  }
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : links.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {links.map((link, i) => (
              <LinkCard key={link.id} link={link} index={i} />
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
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
