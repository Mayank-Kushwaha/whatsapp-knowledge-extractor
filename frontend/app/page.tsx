"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import {
  MessageSquareText,
  Search,
  BarChart3,
  Network,
  Upload,
  Sparkles,
  ArrowRight,
  Link2,
  Image as ImageIcon,
  Video,
  FileText,
  Star,
  Settings,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Animation variants
// ---------------------------------------------------------------------------

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }),
};

const stagger = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const floatAnimation = {
  animate: {
    y: [0, -8, 0],
    transition: { duration: 5, repeat: Infinity, ease: "easeInOut" as const },
  },
};

const pulseGlow = {
  animate: {
    boxShadow: [
      "0 0 20px oklch(0.65 0.18 265 / 10%)",
      "0 0 50px oklch(0.65 0.18 265 / 25%)",
      "0 0 20px oklch(0.65 0.18 265 / 10%)",
    ],
    transition: { duration: 3, repeat: Infinity, ease: "easeInOut" as const },
  },
};

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

const features = [
  {
    icon: Upload,
    title: "Drag & Drop Upload",
    description: "Upload your WhatsApp .txt or .zip exports. Processing happens in real-time with live progress.",
    gradient: "from-blue-500/20 to-cyan-500/20",
    iconColor: "text-blue-400",
  },
  {
    icon: MessageSquareText,
    title: "Smart Classification",
    description: "Every message is automatically classified — links, images, videos, PDFs, audio, and more.",
    gradient: "from-purple-500/20 to-pink-500/20",
    iconColor: "text-purple-400",
  },
  {
    icon: Search,
    title: "Powerful Search",
    description: "Full-text and semantic search across all your chats. Find anything instantly with smart filters.",
    gradient: "from-emerald-500/20 to-teal-500/20",
    iconColor: "text-emerald-400",
  },
  {
    icon: BarChart3,
    title: "Rich Analytics",
    description: "Discover patterns with interactive charts, heatmaps, and sender breakdowns.",
    gradient: "from-amber-500/20 to-orange-500/20",
    iconColor: "text-amber-400",
  },
  {
    icon: Network,
    title: "Knowledge Graph",
    description: "See your conversations as an interactive network. Explore connections between people, topics, and links.",
    gradient: "from-rose-500/20 to-red-500/20",
    iconColor: "text-rose-400",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Topics",
    description: "Automatic topic clustering using local NLP. No data leaves your machine. 100% private.",
    gradient: "from-indigo-500/20 to-violet-500/20",
    iconColor: "text-indigo-400",
  },
];

const typeIcons = [
  { icon: Link2, label: "Links", color: "text-blue-400", bg: "bg-blue-400/10" },
  { icon: ImageIcon, label: "Images", color: "text-rose-400", bg: "bg-rose-400/10" },
  { icon: Video, label: "Videos", color: "text-purple-400", bg: "bg-purple-400/10" },
  { icon: FileText, label: "Documents", color: "text-amber-400", bg: "bg-amber-400/10" },
  { icon: Star, label: "Important", color: "text-yellow-400", bg: "bg-yellow-400/10" },
];

// ---------------------------------------------------------------------------
// Landing Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  const { status: sessionStatus } = useSession();
  const isAuthed = sessionStatus === "authenticated";

  return (
    <div className="min-h-screen bg-background relative pt-[72px]">
      {/* Background mesh gradient */}
      <div className="fixed inset-0 mesh-gradient opacity-60 pointer-events-none" />
      <div className="fixed inset-0 noise-overlay pointer-events-none" />

      {/* ===== NAVBAR ===== */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-4 border-b border-white/5 bg-background/80 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <img
            src="/whatsapp-knowledge-extractor-logo.png"
            alt="WhatsApp Knowledge Extractor"
            className="h-[60px] w-auto"
          />
        </div>
        <div className="flex items-center gap-2">
          <a
            href="https://mayank-kushwaha.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-amber-300/30 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-rose-500/15 px-4 py-2 text-sm font-medium text-amber-50 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(251,146,60,0.18)] transition-all duration-300 hover:border-amber-200/55 hover:from-amber-500/25 hover:via-orange-500/25 hover:to-rose-500/25 hover:text-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_rgba(251,113,133,0.28)]"
            aria-label="Visit Mayank's portfolio"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.22),transparent_42%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
            <Sparkles className="relative z-10 h-3.5 w-3.5 text-amber-200" />
            <span className="relative z-10 hidden sm:inline">Portfolio</span>
            <ArrowRight className="relative z-10 h-3 w-3 -rotate-45 text-amber-200 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>
          <Link
            href="/app/search"
            className="group relative flex items-center gap-2 overflow-hidden rounded-full border border-cyan-400/20 bg-gradient-to-r from-sky-500/12 via-cyan-400/10 to-violet-500/12 px-4 py-2 text-sm font-medium text-slate-100 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_10px_30px_rgba(34,211,238,0.12)] transition-all duration-300 hover:border-cyan-300/35 hover:from-sky-500/20 hover:via-cyan-400/18 hover:to-violet-500/20 hover:text-white hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_40px_rgba(59,130,246,0.18)]"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(34,211,238,0.16),transparent_42%)] opacity-80 transition-opacity duration-300 group-hover:opacity-100" />
            <Search className="relative z-10 h-3.5 w-3.5 text-cyan-200" />
            <span className="relative z-10 hidden sm:inline">Search</span>
          </Link>
          <Link
            href="/app/settings"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-muted-foreground hover:text-foreground bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15 transition-all duration-300"
          >
            <Settings className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Settings</span>
          </Link>
          {/* <Link
            href="/docs"
            className="px-5 py-2.5 rounded-full text-sm font-medium bg-white/8 border border-white/10 hover:bg-white/14 transition-all duration-300 hover:border-white/20"
          >
            Documentation
          </Link> */}
        </div>
      </motion.nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative z-10 flex flex-col items-center text-center px-6 pt-20 pb-28 md:pt-32 md:pb-40">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/6 border border-white/10 text-xs text-muted-foreground mb-8"
        >
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>100% local • No data leaves your machine</span>
        </motion.div>

        {/* Main heading */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] max-w-4xl"
        >
          Turn WhatsApp chaos into{" "}
          <span className="gradient-text">organized knowledge</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed"
        >
          Upload your WhatsApp exports and instantly get a searchable, visual knowledge base.
          Classify links, images, documents — discover topics and connections you never knew existed.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          {isAuthed ? (
            <Link href="/app/upload">
              <motion.div
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-medium text-white overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_auto] animate-shimmer" />
                <span className="relative z-10 flex items-center gap-2.5">
                  <Upload className="w-4.5 h-4.5" />
                  Upload Chat Export
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </motion.div>
            </Link>
          ) : (
            <motion.button
              onClick={() => signIn("google", { callbackUrl: "/app/upload" })}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="group relative inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-medium text-white overflow-hidden cursor-pointer"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-[length:200%_auto] animate-shimmer" />
              <span className="relative z-10 flex items-center gap-2.5">
                Sign in with Google
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </span>
            </motion.button>
          )}
          <Link href="/app/chats/0">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-medium bg-white/6 border border-white/10 hover:bg-white/10 transition-all"
            >
              Try the demo
              <ArrowRight className="w-4 h-4" />
            </motion.div>
          </Link>
          <Link href="/docs">
            <motion.div
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-full font-medium bg-white/6 border border-white/10 hover:bg-white/10 transition-all"
            >
              Documentation
            </motion.div>
          </Link>
        </motion.div>

        {/* Type pills */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-16 flex flex-wrap items-center justify-center gap-3"
        >
          {typeIcons.map((item) => (
            <motion.div
              key={item.label}
              {...floatAnimation}
              className={`flex items-center gap-2 px-4 py-2 rounded-full ${item.bg} border border-white/5`}
            >
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section className="relative z-10 px-6 md:px-12 pb-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={stagger}
          className="max-w-6xl mx-auto"
        >
          {/* Section heading */}
          <motion.div variants={fadeUp} custom={0} className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Everything you need to{" "}
              <span className="gradient-text">extract knowledge</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
              From raw chat exports to organized insights — powered by local AI.
            </p>
          </motion.div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                variants={fadeUp}
                custom={i + 1}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group relative rounded-2xl p-6 glass-card hover:border-white/15 transition-all duration-300"
              >
                {/* Gradient overlay on hover */}
                <div
                  className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                <div className="relative z-10">
                  <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/8 transition-colors">
                    <feature.icon className={`w-5.5 h-5.5 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ===== BOTTOM CTA ===== */}
      <section className="relative z-10 px-6 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="max-w-3xl mx-auto text-center"
        >
          <motion.div {...pulseGlow} className="inline-block rounded-3xl p-[1px] bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-teal-500/30">
            <div className="rounded-3xl px-12 py-10 bg-card/80 backdrop-blur-xl">
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to explore your chats?
              </h2>
              <p className="text-muted-foreground mb-8">
                Upload your first WhatsApp export and see the magic happen.
              </p>
              <Link href="/app/upload">
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-medium bg-gradient-to-r from-blue-600 to-purple-600 text-white"
                >
                  <Upload className="w-4.5 h-4.5" />
                  Get Started Free
                  <ArrowRight className="w-4 h-4" />
                </motion.div>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MessageSquareText className="w-4 h-4" />
            WhatsApp Knowledge Extractor
          </div>
          <p className="text-xs text-muted-foreground/60">
            100% local processing • Your data never leaves your machine
          </p>
        </div>
      </footer>
    </div>
  );
}
