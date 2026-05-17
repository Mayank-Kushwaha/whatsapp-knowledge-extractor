"use client";

import Link from "next/link";
import { ArrowLeft, Upload, BookOpen, Code, Smartphone, Monitor, ArrowRight } from "lucide-react";

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background relative">
      <div className="fixed inset-0 mesh-gradient opacity-60 pointer-events-none" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
        <Link href="/app/upload" className="px-5 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:opacity-90 transition-opacity">
          Upload Chat Export
        </Link>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12 md:py-20">
        {/* Page Header */}
        <div className="mb-16 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/6 border border-white/10 text-xs text-muted-foreground mb-6">
            <BookOpen className="w-3.5 h-3.5 text-purple-400" />
            Documentation
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">WhatsApp Knowledge Extractor</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">Complete guide to understanding, using, and setting up the project locally.</p>
        </div>

        {/* Table of Contents */}
        <div className="mb-16 p-6 rounded-2xl glass-card">
          <h2 className="text-lg font-semibold mb-4">Table of Contents</h2>
          <nav className="space-y-2">
            <a href="#about" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">1. About the Project</a>
            <a href="#flow" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">2. How It Works — App Flow</a>
            <a href="#features" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">3. Features Overview</a>
            <a href="#setup" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">4. Local Setup Guide</a>
            <a href="#env" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">5. Environment Variables</a>
            <a href="#troubleshooting" className="block text-sm text-muted-foreground hover:text-foreground transition-colors">6. Troubleshooting</a>
          </nav>
        </div>

        {/* SECTION 1: ABOUT */}
        <section id="about" className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-bold">1</span>
            About the Project
          </h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              <strong className="text-foreground">WhatsApp Knowledge Extractor</strong> is a web application that transforms your WhatsApp chat exports into a rich, interactive, and searchable knowledge base. It runs entirely on your local machine — no cloud services, no subscriptions, no data leaving your computer.
            </p>
            <p>
              You upload a <code className="px-1.5 py-0.5 rounded bg-white/10 text-sm">.zip</code> or <code className="px-1.5 py-0.5 rounded bg-white/10 text-sm">.txt</code> WhatsApp export file, and the app automatically parses every message, classifies content by type (links, images, videos, documents, audio, locations), clusters messages into semantic topics using local NLP, tags important messages, and presents everything in a searchable dashboard with an interactive knowledge graph.
            </p>

            <div className="p-5 rounded-xl bg-white/5 border border-white/8 mt-6">
              <h3 className="text-foreground font-semibold mb-3">The Problem It Solves</h3>
              <p>
                Millions of people use WhatsApp as an informal notes app — sharing Google Drive links, YouTube videos, PDFs, images, addresses, and important reminders. Retrieving any of it later means scrolling through thousands of messages. This app turns that chaos into an organized, searchable, interlinked knowledge graph.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/8 mt-6">
              <h3 className="text-foreground font-semibold mb-3">Who Is It For?</h3>
              <ul className="space-y-2 list-disc list-inside">
                <li>Individuals who use &quot;Saved Messages&quot; or personal chats as a notes app</li>
                <li>Small teams or families coordinating via WhatsApp groups</li>
                <li>Researchers, students, and professionals who share resources over WhatsApp</li>
                <li>Anyone in India, Southeast Asia, Latin America, or the Middle East where WhatsApp is the primary communication layer</li>
              </ul>
            </div>

            <div className="p-5 rounded-xl bg-white/5 border border-white/8 mt-6">
              <h3 className="text-foreground font-semibold mb-3">Tech Stack</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-foreground font-medium mb-1">Frontend</p>
                  <p>Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Cytoscape.js, Recharts, Zustand</p>
                </div>
                <div>
                  <p className="text-foreground font-medium mb-1">Backend</p>
                  <p>FastAPI, Python 3.11+, SQLAlchemy 2.0, SQLite, sentence-transformers, HDBSCAN, Gemini 2.0 Flash (free)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: FLOW */}
        <section id="flow" className="mb-20">
          <h2 className="text-2xl md:text-3xl font-bold mb-6 flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 text-sm font-bold">2</span>
            How It Works — App Flow
          </h2>
          <div className="space-y-8 text-muted-foreground leading-relaxed">
            <p>The entire workflow is designed to be simple: export your chat from WhatsApp, upload it here, and let the app do the rest.</p>

            {/* Step 1: Export */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/8">
              <div className="flex items-center gap-3 mb-4">
                <Smartphone className="w-5 h-5 text-green-400" />
                <h3 className="text-foreground font-semibold text-lg">Step 1: Export Your WhatsApp Chat</h3>
              </div>
              <p className="mb-4">First, you need to export a chat from WhatsApp on your phone. Here&apos;s how:</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-foreground font-medium mb-2">📱 Android</p>
                  <ol className="space-y-1.5 text-sm list-decimal list-inside">
                    <li>Open WhatsApp → open the chat</li>
                    <li>Tap the three-dot menu (⋮) → <strong className="text-foreground">More</strong> → <strong className="text-foreground">Export Chat</strong></li>
                    <li>Choose <strong className="text-foreground">Include Media</strong> (recommended) or Without Media</li>
                    <li>Save or share the .zip file to your computer</li>
                  </ol>
                </div>
                <div className="p-4 rounded-lg bg-white/5 border border-white/5">
                  <p className="text-foreground font-medium mb-2">🍎 iOS</p>
                  <ol className="space-y-1.5 text-sm list-decimal list-inside">
                    <li>Open WhatsApp → open the chat</li>
                    <li>Tap the contact/group name → <strong className="text-foreground">Export Chat</strong></li>
                    <li>Choose <strong className="text-foreground">Attach Media</strong> or Without Media</li>
                    <li>AirDrop, email, or save the .zip to your computer</li>
                  </ol>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                <p><strong className="text-amber-400">💡 Tip:</strong> The export produces a <code className="px-1 py-0.5 rounded bg-white/10">.zip</code> file containing a <code className="px-1 py-0.5 rounded bg-white/10">_chat.txt</code> message log and all media files. Both <code className="px-1 py-0.5 rounded bg-white/10">.zip</code> and standalone <code className="px-1 py-0.5 rounded bg-white/10">.txt</code> formats are supported.</p>
              </div>
            </div>

            {/* Step 2: Upload */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/8">
              <div className="flex items-center gap-3 mb-4">
                <Upload className="w-5 h-5 text-blue-400" />
                <h3 className="text-foreground font-semibold text-lg">Step 2: Upload to the App</h3>
              </div>
              <p className="mb-3">Navigate to the <Link href="/app/upload" className="text-blue-400 hover:underline">Upload page</Link> and drag-and-drop your exported file onto the upload zone. You can upload:</p>
              <ul className="space-y-1.5 text-sm list-disc list-inside mb-4">
                <li>A <code className="px-1 py-0.5 rounded bg-white/10">.zip</code> file (with media — recommended for full experience)</li>
                <li>A standalone <code className="px-1 py-0.5 rounded bg-white/10">.txt</code> file (text-only, no media previews)</li>
              </ul>
              <p className="text-sm">The app handles chats with 50,000+ messages without issues.</p>
            </div>

            {/* Step 3: Processing */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/8">
              <div className="flex items-center gap-3 mb-4">
                <Monitor className="w-5 h-5 text-emerald-400" />
                <h3 className="text-foreground font-semibold text-lg">Step 3: Automatic Processing (10-Step Pipeline)</h3>
              </div>
              <p className="mb-4">Once uploaded, a 10-step pipeline runs automatically. You&apos;ll see a real-time progress bar powered by Server-Sent Events (SSE):</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">01</span> Parse messages &amp; extract media</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">02</span> Classify message types</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">03</span> Fetch link previews (Open Graph)</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">04</span> Extract PDF text content</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">05</span> Generate sentence embeddings</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">06</span> Cluster into semantic topics</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">07</span> AI-label topic clusters</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">08</span> Tag important messages</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">09</span> Build full-text search index</div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3"><span className="text-emerald-400 font-mono text-xs w-5">10</span> Mark complete &amp; redirect</div>
              </div>
            </div>

            {/* Step 4: Explore */}
            <div className="p-6 rounded-xl bg-white/5 border border-white/8">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h3 className="text-foreground font-semibold text-lg">Step 4: Explore Your Knowledge Base</h3>
              </div>
              <p className="mb-3">After processing completes, you&apos;re redirected to the chat dashboard where you can:</p>
              <ul className="space-y-1.5 text-sm list-disc list-inside">
                <li>View summary stats (total messages, senders, date range, media count)</li>
                <li>Browse messages by type — links, images, videos, documents</li>
                <li>See important messages flagged automatically</li>
                <li>Explore AI-discovered topic clusters</li>
                <li>Search with keywords, semantic queries, or shorthand filters</li>
                <li>Visualize everything as an interactive knowledge graph</li>
                <li>Export any view as Markdown, CSV, or JSON</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SECTION 3: FEATURES */}
        <section id="features" className="mb-20">
          {/* PLACEHOLDER:FEATURES */}
        </section>

        {/* SECTION 4: SETUP */}
        <section id="setup" className="mb-20">
          {/* PLACEHOLDER:SETUP */}
        </section>

        {/* SECTION 5: ENV */}
        <section id="env" className="mb-20">
          {/* PLACEHOLDER:ENV */}
        </section>

        {/* SECTION 6: TROUBLESHOOTING */}
        <section id="troubleshooting" className="mb-20">
          {/* PLACEHOLDER:TROUBLESHOOTING */}
        </section>

        {/* Bottom CTA */}
        <div className="text-center p-8 rounded-2xl glass-card">
          <h2 className="text-2xl font-bold mb-3">Ready to get started?</h2>
          <p className="text-muted-foreground mb-6">Upload your first WhatsApp export and explore your knowledge base.</p>
          <Link href="/app/upload" className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <Upload className="w-4 h-4" />
            Upload Chat Export
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
