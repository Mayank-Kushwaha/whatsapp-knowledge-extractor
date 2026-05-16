"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { getChatClusters, getClusterMessages, type ClusterItem, type ClusterMessage } from "@/lib/api";
import { formatRelativeTime } from "@/lib/api";

export default function TopicsPage() {
  const params = useParams();
  const router = useRouter();
  const chatId = parseInt(params.id as string);

  const [clusters, setClusters] = useState<ClusterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ClusterItem | null>(null);
  const [clusterMessages, setClusterMessages] = useState<ClusterMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    loadClusters();
  }, [chatId]);

  async function loadClusters() {
    try {
      setLoading(true);
      const data = await getChatClusters(chatId);
      setClusters(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }

  async function loadClusterMessages(cluster: ClusterItem) {
    try {
      setLoadingMessages(true);
      setSelectedCluster(cluster);
      const data = await getClusterMessages(chatId, cluster.id, { page_size: 100 });
      setClusterMessages(data.messages);
    } catch (err) {
      console.error("Failed to load cluster messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  }

  function closeClusterView() {
    setSelectedCluster(null);
    setClusterMessages([]);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-48 bg-slate-800 rounded animate-pulse mb-2" />
            <div className="h-4 w-96 bg-slate-800 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">⚠️ {error}</div>
          <button
            onClick={loadClusters}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div className="text-6xl mb-6">🏷️</div>
            <h2 className="text-2xl font-bold text-slate-200 mb-4">No Topics Found</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              This chat doesn't have enough messages to generate topic clusters. Upload a chat with more messages to see topics.
            </p>
            <button
              onClick={() => router.push(`/app/chats/${chatId}`)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Back to Dashboard
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // Cluster detail view
  if (selectedCluster) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6"
          >
            <button
              onClick={closeClusterView}
              className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors mb-4"
            >
              <span>←</span> Back to Topics
            </button>
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <h1 className="text-3xl font-bold text-slate-100 mb-2">
                {selectedCluster.label || "Untitled Topic"}
              </h1>
              <p className="text-slate-400 mb-4">{selectedCluster.summary}</p>
              <div className="flex gap-6 text-sm text-slate-500">
                <div>
                  <span className="text-slate-400">{selectedCluster.message_count}</span> messages
                </div>
                {selectedCluster.date_range_start && selectedCluster.date_range_end && (
                  <div>
                    {formatRelativeTime(selectedCluster.date_range_start)} →{" "}
                    {formatRelativeTime(selectedCluster.date_range_end)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {loadingMessages ? (
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {clusterMessages.map((msg, idx) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-slate-800/30 backdrop-blur-sm border border-slate-700/30 rounded-lg p-4 hover:border-slate-600/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-blue-400">
                        {msg.sender_name || "Unknown"}
                      </span>
                      {msg.is_important && (
                        <span className="text-amber-400 text-xs">⭐</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatRelativeTime(msg.timestamp)}
                    </span>
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{msg.content}</p>
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // Main topics grid view
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-100 mb-2">
            Discovered Topics
          </h1>
          <p className="text-slate-400">
            {clusters.length} topic{clusters.length !== 1 ? "s" : ""} found in this chat
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clusters.map((cluster, idx) => (
            <motion.div
              key={cluster.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              whileHover={{ scale: 1.02, y: -4 }}
              onClick={() => loadClusterMessages(cluster)}
              className="group cursor-pointer"
            >
              <div className="h-full bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-slate-100 mb-2 group-hover:text-blue-400 transition-colors">
                      {cluster.label || "Untitled Topic"}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-3 leading-relaxed">
                      {cluster.summary || "No summary available"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-400 font-medium">
                      {cluster.message_count}
                    </span>
                    <span className="text-slate-500">messages</span>
                  </div>
                  <div className="text-slate-500 group-hover:text-blue-400 transition-colors">
                    →
                  </div>
                </div>

                {cluster.date_range_start && cluster.date_range_end && (
                  <div className="mt-3 text-xs text-slate-500">
                    {formatRelativeTime(cluster.date_range_start)} →{" "}
                    {formatRelativeTime(cluster.date_range_end)}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}