"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function SettingsPage() {
  const [llmProvider, setLlmProvider] = useState("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("llama3");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold text-slate-100 mb-2">⚙️ Settings</h1>
          <p className="text-slate-400">Configure your WhatsApp Knowledge Extractor</p>
        </motion.div>

        <div className="space-y-6">
          {/* LLM Provider */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">🤖 LLM Provider</h2>
            <p className="text-sm text-slate-400 mb-4">Choose which AI model to use for cluster labeling and summaries.</p>
            
            <div className="flex gap-3 mb-4">
              <button onClick={() => setLlmProvider("gemini")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  llmProvider === "gemini" ? "bg-blue-600 text-white" : "bg-slate-700/50 text-slate-400 hover:text-slate-200"
                }`}>
                ✨ Gemini Flash (Free)
              </button>
              <button onClick={() => setLlmProvider("ollama")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  llmProvider === "ollama" ? "bg-blue-600 text-white" : "bg-slate-700/50 text-slate-400 hover:text-slate-200"
                }`}>
                🦙 Ollama (Local)
              </button>
            </div>

            {llmProvider === "gemini" && (
              <div className="space-y-3">
                <label className="block text-sm text-slate-400">Gemini API Key</label>
                <input type="password" value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                <p className="text-xs text-slate-500">Get a free key at <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 hover:text-blue-300">aistudio.google.com</a></p>
              </div>
            )}

            {llmProvider === "ollama" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Ollama URL</label>
                  <input type="text" value={ollamaUrl} onChange={(e) => setOllamaUrl(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Model</label>
                  <input type="text" value={ollamaModel} onChange={(e) => setOllamaModel(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-lg text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </div>
              </div>
            )}
          </motion.div>

          {/* Data Storage */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">💾 Data Storage</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-400">
                <span>Database</span>
                <span className="text-slate-300 font-mono">./data/knowledge.db</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Media Files</span>
                <span className="text-slate-300 font-mono">./data/media/</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Storage</span>
                <span className="text-slate-300">100% Local — No cloud</span>
              </div>
            </div>
          </motion.div>

          {/* About */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">ℹ️ About</h2>
            <div className="space-y-2 text-sm text-slate-400">
              <p><strong className="text-slate-200">WhatsApp Knowledge Extractor</strong> v1.0</p>
              <p>Transforms WhatsApp chat exports into an organized, searchable, visual knowledge base.</p>
              <p className="text-xs text-slate-500 mt-3">Built with Next.js + FastAPI + SQLite • Free AI via Gemini Flash</p>
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <button onClick={handleSave}
              className={`w-full py-3 rounded-xl font-medium text-sm transition-all ${
                saved ? "bg-green-600 text-white" : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}>
              {saved ? "✓ Settings Saved" : "Save Settings"}
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}