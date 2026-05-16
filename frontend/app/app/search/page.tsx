"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { searchGlobal, type SearchResultItem, TYPE_CONFIG, formatRelativeTime } from "@/lib/api";

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

export default function GlobalSearchPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState("combined");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const doSearch = useCallback(async (q: string, m: string) => {
    if (!q.trim()) {
      setResults([]);
      setTotal(0);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const resp = await searchGlobal({ q: q.trim(), mode: m, limit: 50 });
      setResults(resp.results);
      setTotal(resp.total);
    } catch (err) {
      console.error("Search failed:", err);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { doSearch(query, mode); }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode, doSearch]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Group results by chat
  const groupedResults: Record<string, SearchResultItem[]> = {};
  for (const r of results) {
    const key = r.chat_name || `Chat ${r.chat_id}`;
    if (!groupedResults[key]) groupedResults[key] = [];
    groupedResults[key].push(r);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">🌐 Global Search</h1>
          <p className="text-slate-400 text-sm">Search across all uploaded chats</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">🔍</span>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all chats..."
              className="w-full pl-12 pr-4 py-4 bg-slate-800/50 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="flex gap-1 bg-slate-800/50 rounded-lg p-1 mb-6 w-fit">
          {[
            { value: "combined", label: "Combined", icon: "🔀" },
            { value: "keyword", label: "Keyword", icon: "🔤" },
            { value: "semantic", label: "Semantic", icon: "🧠" },
          ].map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition-all ${
                mode === m.value ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </motion.div>

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
            <p className="text-slate-500">Try different keywords</p>
          </motion.div>
        ) : searched ? (
          <>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-slate-400 mb-4">
              Found <span className="text-slate-200 font-medium">{total}</span> result{total !== 1 ? "s" : ""} across {Object.keys(groupedResults).length} chat{Object.keys(groupedResults).length !== 1 ? "s" : ""}
            </motion.p>
            <div className="space-y-6">
              {Object.entries(groupedResults).map(([chatName, chatResults]) => (
                <motion.div key={chatName} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <h3 className="text-lg font-semibold text-slate-200 mb-3 flex items-center gap-2">
                    <span className="text-blue-400">💬</span> {chatName}
                    <span className="text-sm text-slate-500">({chatResults.length})</span>
                    <button
                      onClick={() => router.push(`/app/chats/${chatResults[0].chat_id}/search`)}
                      className="ml-auto text-xs text-blue-400 hover:text-blue-300"
                    >
                      Search in this chat →
                    </button>
                  </h3>
                  <div className="space-y-2">
                    {chatResults.map((result, idx) => (
                      <motion.div
                        key={result.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="bg-slate-800/30 border border-slate-700/30 rounded-lg p-4 hover:border-slate-600/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-blue-400">{result.sender_name || "Unknown"}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-slate-700/50 text-slate-400">
                              {TYPE_CONFIG[result.type]?.icon} {TYPE_CONFIG[result.type]?.label || result.type}
                            </span>
                            {result.is_important && <span className="text-amber-400 text-xs">⭐</span>}
                          </div>
                          <span className="text-xs text-slate-500">{formatRelativeTime(result.timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{highlightMatch(result.content, query)}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center py-16">
            <div className="text-6xl mb-4">🌐</div>
            <h3 className="text-xl text-slate-300 mb-2">Search All Chats</h3>
            <p className="text-slate-500 max-w-md mx-auto">
              Search across every uploaded chat. Results are grouped by chat for easy navigation.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}