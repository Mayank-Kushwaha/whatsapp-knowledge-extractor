"use client";

import { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  FileText,
  Download,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Loader2,
  ArrowLeft,
  Inbox,
  File,
  FileSpreadsheet,
  Presentation,
} from "lucide-react";
import {
  getChatMedia,
  mediaUrl,
  formatRelativeTime,
  formatFileSize,
  type MediaItemResponse,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// File type icon
// ---------------------------------------------------------------------------

function FileIcon({ filename, mimeType }: { filename: string | null; mimeType: string | null }) {
  const ext = filename?.split(".").pop()?.toLowerCase() || "";
  const mime = mimeType || "";

  if (ext === "pdf" || mime.includes("pdf")) {
    return <FileText className="w-5 h-5" style={{ color: "oklch(0.7 0.2 25)" }} />;
  }
  if (["xlsx", "xls", "csv"].includes(ext) || mime.includes("spreadsheet")) {
    return <FileSpreadsheet className="w-5 h-5" style={{ color: "oklch(0.7 0.15 145)" }} />;
  }
  if (["pptx", "ppt"].includes(ext) || mime.includes("presentation")) {
    return <Presentation className="w-5 h-5" style={{ color: "oklch(0.7 0.18 25)" }} />;
  }
  if (["docx", "doc", "txt"].includes(ext) || mime.includes("document")) {
    return <FileText className="w-5 h-5" style={{ color: "var(--type-doc)" }} />;
  }
  return <File className="w-5 h-5" style={{ color: "var(--type-doc)" }} />;
}

// ---------------------------------------------------------------------------
// Document Card
// ---------------------------------------------------------------------------

function DocumentCard({ item, index }: { item: MediaItemResponse; index: number }) {
  const [showPreview, setShowPreview] = useState(false);
  const hasPreview = item.extracted_text && item.extracted_text.trim().length > 0;
  const previewText = item.extracted_text?.slice(0, 500) || "";
  const downloadUrl = item.local_path ? mediaUrl(item.local_path) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className="rounded-2xl glass-card hover:border-white/15 transition-all duration-300"
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "var(--type-doc-bg)" }}
          >
            <FileIcon filename={item.original_filename} mimeType={item.mime_type} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate mb-1">
              {item.original_filename || "Document"}
            </h3>

            <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
              {item.file_size_bytes && (
                <span className="tabular-nums">{formatFileSize(item.file_size_bytes)}</span>
              )}
              {item.mime_type && (
                <span className="text-muted-foreground/50">
                  {item.original_filename?.split(".").pop()?.toUpperCase() || item.mime_type.split("/").pop()}
                </span>
              )}
              {item.sender && (
                <span className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  {item.sender.display_name}
                </span>
              )}
              {item.timestamp && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatRelativeTime(item.timestamp)}
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasPreview && (
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-muted-foreground"
                title="Preview text"
              >
                {showPreview ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            )}
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={item.original_filename || "document"}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                style={{ color: "var(--type-doc)" }}
                title="Download"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Text Preview */}
      <AnimatePresence>
        {showPreview && hasPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 pt-0">
              <div className="p-4 rounded-xl bg-white/3 border border-white/5">
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono">
                  {previewText}
                  {item.extracted_text && item.extracted_text.length > 500 && (
                    <span className="text-muted-foreground/40">…</span>
                  )}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
        style={{ backgroundColor: "var(--type-doc-bg)" }}
      >
        <Inbox className="w-8 h-8" style={{ color: "var(--type-doc)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2">No documents found</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        This chat doesn&apos;t contain any documents yet. PDFs, Word docs, spreadsheets,
        and other files will appear here.
      </p>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Documents Page
// ---------------------------------------------------------------------------

export default function DocsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chatId = parseInt(resolvedParams.id);

  const [docs, setDocs] = useState<MediaItemResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Fetch documents (pdf + document types)
  useEffect(() => {
    async function fetchDocs() {
      setLoading(true);
      try {
        // Fetch both PDFs and documents
        const [pdfResult, docResult] = await Promise.all([
          getChatMedia(chatId, { type: "pdf", page: 1, page_size: 50 }),
          getChatMedia(chatId, { type: "document", page: 1, page_size: 50 }),
        ]);

        const allDocs = [...pdfResult.items, ...docResult.items].sort((a, b) => {
          const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
          const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
          return tb - ta;
        });

        setDocs(allDocs);
        setTotal(pdfResult.total + docResult.total);
        setHasMore(pdfResult.has_next || docResult.has_next);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, [chatId]);

  // Load more
  async function loadMore() {
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const [pdfResult, docResult] = await Promise.all([
        getChatMedia(chatId, { type: "pdf", page: nextPage, page_size: 50 }),
        getChatMedia(chatId, { type: "document", page: nextPage, page_size: 50 }),
      ]);
      const moreDocs = [...pdfResult.items, ...docResult.items].sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return tb - ta;
      });
      setDocs((prev) => [...prev, ...moreDocs]);
      setPage(nextPage);
      setHasMore(pdfResult.has_next || docResult.has_next);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
              style={{ backgroundColor: "var(--type-doc-bg)" }}
            >
              <FileText className="w-4 h-4" style={{ color: "var(--type-doc)" }} />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Documents</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 ml-10">
            {total} document{total !== 1 ? "s" : ""} shared
          </p>
        </div>
      </motion.div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : docs.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="space-y-3">
            {docs.map((doc, i) => (
              <DocumentCard key={doc.id} item={doc} index={i} />
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
    </div>
  );
}
