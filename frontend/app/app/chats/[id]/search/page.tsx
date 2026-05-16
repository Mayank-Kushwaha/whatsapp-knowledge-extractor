"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { searchChat, type SearchResultItem, type SearchResponse, TYPE_CONFIG, formatRelativeTime } from "@/lib/api";

const SEARCH_MODES = [
  { value: "combined", label: "Combined", icon: "🔀" },
  { value: "keyword", label: "Keyword", icon: "🔤" },
  { value: "semantic", label: "Semantic", icon: "🧠" },
];

const TYPE_FILTERS = ["link", "image", "video", "pdf", "document", "audio", "text"];

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 2) return text;
  const words = query.split(/\s+/).filter(w => w.length >= 2 && !w.includes(":"));
  if (words.length === 0) return text;
  const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) =>
    pattern.test(part) ? (
      <mark key={i} className="bg-blue-500/30 text-blue-200 rounded px-0.5">{part}</mark>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function SearchPage() {
  const params = useParams();
  const chatId = parseInt(params.id as string);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("combined");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [importantOnly, setImportantOnly] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [filtersApplied, setFiltersApplied] = useState<Record<string, unknown>>({});

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string, m: string, t: string | null, imp: boolean) => {
    if (!q.trim() && !t && !imp) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const resp = await searchChat(chatId, {
        q: q.trim(),
        mode: m,
        type: t || undefined,
        is_important: imp || undefined,
        limit: 50,
      });
      setResults(resp.results);
      setTotal(resp.total);
      setFiltersApplied(resp.filters_applied);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query, mode, typeFilter, importantOnly);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, typeFilter, importantOnly, doSearch]);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">Search Chat</h1>
          <p className="text-slate-400 text-sm">
            Use shorthand filters: <code className="text-blue-400">from:Name</code>{" "}
            <code className="text-blue-400">type:link</code>{" "}
            <code className="text-blue-400">is:important</code>{" "}
            <code className="text-blue-400">domain:youtube</code>{" "}
            <code className="text-blue-400">after:2024-01</code>{" "}
            <code className="text-blue-400">before:2024-06</code>
          </p>
        </motion.div>

        {/* Search Input */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search messages... (try: from:Mom type:link apartment)"
              className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>
        </motion.div>

        {/* Mode + Filters */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex flex-wrap gap-3 mb-6">
          {/* Search mode */}
          <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
            {SEARCH_MODES.map((m) => (
              <button
                key={m.value}
                onClick={() => setMode(m.value)}
                className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                  mode === m.value
                    ? "bg-blue-600 text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Type filter chips */}
          <div className="flex gap-1 flex-wrap">
            {TYPE_FILTERS.map((t) => {
              const config = TYPE_CONFIG[t];
              return (
                <button
                  key={t}
                  onClick={() => setTypeFilter(typeFilter === t ? null : t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    typeFilter === t
                      ? "bg-blue-600 text-white"
                      : "bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50"
                  }`}
                >
                  {config?.icon || "📎"} {config?.label || t}
                </button>
              );
            })}
          </div>

          {/* Important toggle */}
          <button
            onClick={() => setImportantOnly(!importantOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              importantOnly
                ? "bg-amber-600 text-white"
                : "bg-slate-800/50 text-slate-400 hover:text-slate-200 border border-slate-700/50"
            }`}
          >
            ⭐ Important
          </button>
        </motion.div>

        {/* Results */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-28 bg-slate-800/30 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : searched && results.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-xl text-slate-300 mb-2">No results found</h3>
            <p className="text-slate-500">
              Try different keywords or remove some filters
            </p>
          </motion.div>
        ) : (
          <>
            {searched && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 mb-4">
                Found <span className="text-slate-200 font-medium">{total}</span> result{total !== 1 ? "s" : ""}
                {Object.keys(filtersApplied).length > 0 && (
                  <span className="text-slate-500"> with {Object.keys(filtersApplied).length} filter{Object.keys(filtersApplied).length !== 1 ? "s" : ""}</span>
                )}
              </motion.p>
            )}
            <AnimatePresence>
              <div className="space-y-3">
                {results.map((result, idx) => (
                  <motion.div
                    key={result.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-xl overflow-hidden hover:border-slate-600/50 transition-colors"
                  >
                    {/* Context before */}
                    {result.context_before && (
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-xs text-slate-600 italic truncate">{result.context_before}</p>
                      </div>
                    )}

                    {/* Main result */}
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-blue-400">
                            {result.sender_name || "Unknown"}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-400">
                            {TYPE_CONFIG[result.type]?.icon || "📎"} {TYPE_CONFIG[result.type]?.label || result.type}
                          </span>
                          {result.is_important && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">⭐ Important</span>
                          )}
                          {result.score > 0 && (
                            <span className="text-xs text-slate-600">{(result.score * 100).toFixed(0)}% match</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 whitespace-nowrap ml-2">
                          {formatRelativeTime(result.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed">
                        {highlightMatch(result.content, query)}
                      </p>
                    </div>

                    {/* Context after */}
                    {result.context_after && (
                      <div className="px-4 pb-3 pt-1">
                        <p className="text-xs text-slate-600 italic truncate">{result.context_after}</p>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          </>
        )}

        {/* Empty initial state */}
        {!searched && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center py-16">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl text-slate-300 mb-2">Search Your Chat</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Type to search by keyword, or use shorthand filters like <code className="text-blue-400">from:Mom</code> to narrow results.
              Switch between keyword, semantic, or combined search modes.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}