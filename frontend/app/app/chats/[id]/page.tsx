"use client";

import { useEffect, useState, useRef, use } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  MessageSquareText,
  Users,
  Calendar,
  BarChart3,
  Link2,
  Image as ImageIcon,
  Video,
  FileText,
  Music,
  Star,
  MapPin,
  Contact,
  ArrowRight,
  Loader2,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { getChat, getChatMessages, getChatLinkDomains, TYPE_CONFIG, type ChatDetail, type TypeBreakdown, type SenderInfo } from "@/lib/api";
import { useAppStore } from "@/lib/store";

// ---------------------------------------------------------------------------
// Count-Up Animation Hook
// ---------------------------------------------------------------------------

function useCountUp(end: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    if (end === 0) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    ref.current = requestAnimationFrame(function animate() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * end));

      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    });

    return () => cancelAnimationFrame(ref.current);
  }, [end, duration]);

  return count;
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
  bgColor,
  index,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  subtext?: string;
  color: string;
  bgColor: string;
  index: number;
}) {
  const animatedValue = useCountUp(value);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className="rounded-2xl p-5 glass-card hover:border-white/15 transition-all duration-300"
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: bgColor }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-bold tracking-tight tabular-nums">
        {animatedValue.toLocaleString()}
      </p>
      {subtext && (
        <p className="text-xs text-muted-foreground mt-1">{subtext}</p>
      )}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Type Panel
// ---------------------------------------------------------------------------

function TypePanel({
  type,
  count,
  total,
  chatId,
  index,
}: {
  type: string;
  count: number;
  total: number;
  chatId: number;
  index: number;
}) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.text;
  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";

  const iconMap: Record<string, React.ElementType> = {
    link: Link2,
    image: ImageIcon,
    video: Video,
    pdf: FileText,
    document: FileText,
    audio: Music,
    contact: Contact,
    location: MapPin,
    text: MessageSquareText,
    important: Star,
    deleted: MessageSquareText,
    unknown_media: FileText,
  };

  const Icon = iconMap[type] || MessageSquareText;

  // Route for the detail view
  const detailRoutes: Record<string, string> = {
    link: "links",
    image: "images",
    video: "videos",
    pdf: "docs",
    document: "docs",
    important: "important",
  };
  const route = detailRoutes[type];

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.3 + index * 0.04, duration: 0.3 }}
      whileHover={route ? { y: -2, transition: { duration: 0.15 } } : {}}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        route ? "hover:bg-white/5 cursor-pointer" : ""
      }`}
      style={{
        backgroundColor: count > 0 ? `color-mix(in oklch, ${config.color} 5%, transparent)` : undefined,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: config.bgColor }}
      >
        <Icon className="w-4 h-4" style={{ color: config.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{config.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ delay: 0.5 + index * 0.04, duration: 0.6 }}
              className="h-full rounded-full"
              style={{ backgroundColor: config.color }}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
        </div>
      </div>
      <span className="text-sm font-semibold tabular-nums" style={{ color: config.color }}>
        {count.toLocaleString()}
      </span>
      {route && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />}
    </motion.div>
  );

  if (route) {
    return <Link href={`/app/chats/${chatId}/${route}`}>{content}</Link>;
  }
  return content;
}

// ---------------------------------------------------------------------------
// Sender Chart
// ---------------------------------------------------------------------------

const CHART_COLORS = [
  "oklch(0.65 0.18 265)",
  "oklch(0.7 0.15 165)",
  "oklch(0.72 0.18 15)",
  "oklch(0.65 0.2 300)",
  "oklch(0.75 0.15 70)",
  "oklch(0.7 0.14 175)",
  "oklch(0.68 0.12 140)",
  "oklch(0.6 0.16 320)",
];

function SenderChart({ senders }: { senders: SenderInfo[] }) {
  const topSenders = senders.slice(0, 8);
  const data = topSenders.map((s) => ({
    name: s.display_name.length > 12 ? s.display_name.slice(0, 12) + "…" : s.display_name,
    messages: s.message_count,
  }));

  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="rounded-2xl p-6 glass-card"
    >
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold">Top Senders</h3>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fontSize: 12, fill: "oklch(0.6 0.01 285)" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "oklch(0.14 0.006 285)",
                border: "1px solid oklch(1 0 0 / 10%)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "oklch(0.92 0 0)",
              }}
              cursor={{ fill: "oklch(1 0 0 / 3%)" }}
            />
            <Bar dataKey="messages" radius={[0, 6, 6, 0]} maxBarSize={24}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Type Distribution Pie
// ---------------------------------------------------------------------------

function TypeDistributionChart({ breakdown }: { breakdown: TypeBreakdown[] }) {
  const filtered = breakdown.filter((t) => t.type !== "text" && t.type !== "deleted" && t.count > 0);

  if (filtered.length === 0) return null;

  const data = filtered.map((t) => ({
    name: TYPE_CONFIG[t.type]?.label || t.type,
    value: t.count,
    color: TYPE_CONFIG[t.type]?.color || "var(--type-text)",
  }));

  // Map CSS vars to actual colors for Recharts
  const colorMap: Record<string, string> = {
    "var(--type-link)": "oklch(0.65 0.18 250)",
    "var(--type-image)": "oklch(0.72 0.18 15)",
    "var(--type-video)": "oklch(0.65 0.2 300)",
    "var(--type-doc)": "oklch(0.75 0.15 70)",
    "var(--type-audio)": "oklch(0.7 0.14 175)",
    "var(--type-important)": "oklch(0.8 0.18 85)",
    "var(--type-contact)": "oklch(0.68 0.12 140)",
    "var(--type-location)": "oklch(0.65 0.15 145)",
    "var(--type-text)": "oklch(0.6 0.01 285)",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="rounded-2xl p-6 glass-card"
    >
      <div className="flex items-center gap-2 mb-5">
        <BarChart3 className="w-4 h-4 text-purple-400" />
        <h3 className="text-sm font-semibold">Content Distribution</h3>
      </div>
      <div className="h-[220px] flex items-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              dataKey="value"
              stroke="none"
              paddingAngle={3}
            >
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={colorMap[entry.color] || CHART_COLORS[i % CHART_COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "oklch(0.14 0.006 285)",
                border: "1px solid oklch(1 0 0 / 10%)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "oklch(0.92 0 0)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {data.map((entry, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: colorMap[entry.color] || CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
            {entry.name}
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Activity Heatmap (simplified as a bar chart by day-of-week)
// ---------------------------------------------------------------------------

function ActivityChart({ chatId }: { chatId: number }) {
  const [data, setData] = useState<{ name: string; messages: number }[]>([]);

  useEffect(() => {
    async function fetchActivity() {
      try {
        // Fetch first page of messages to compute day-of-week distribution
        const result = await getChatMessages(chatId, { per_page: 200 });
        const dayCounts: Record<string, number> = {
          Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0,
        };
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        result.items.forEach((msg) => {
          try {
            const day = new Date(msg.timestamp).getDay();
            dayCounts[dayNames[day]]++;
          } catch {
            // skip
          }
        });

        setData(
          dayNames.map((name) => ({ name, messages: dayCounts[name] }))
        );
      } catch {
        // ignore
      }
    }
    fetchActivity();
  }, [chatId]);

  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5 }}
      className="rounded-2xl p-6 glass-card"
    >
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="w-4 h-4 text-teal-400" />
        <h3 className="text-sm font-semibold">Activity by Day</h3>
      </div>
      <div className="h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: -20, right: 4 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "oklch(0.6 0.01 285)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: "oklch(0.14 0.006 285)",
                border: "1px solid oklch(1 0 0 / 10%)",
                borderRadius: "12px",
                fontSize: "13px",
                color: "oklch(0.92 0 0)",
              }}
              cursor={{ fill: "oklch(1 0 0 / 3%)" }}
            />
            <Bar dataKey="messages" radius={[6, 6, 0, 0]} maxBarSize={36}>
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Domain Breakdown
// ---------------------------------------------------------------------------

function DomainBreakdownChart({ chatId }: { chatId: number }) {
  const [domains, setDomains] = useState<{ name: string; count: number }[]>([]);

  useEffect(() => {
    async function fetchLinks() {
      try {
        const domainData = await getChatLinkDomains(chatId);
        const topDomains = domainData
          .sort((a, b) => b.count - a.count)
          .slice(0, 6)
          .map((d) => ({ name: d.domain, count: d.count }));
        setDomains(topDomains);
      } catch {
        // ignore
      }
    }
    fetchLinks();
  }, [chatId]);

  if (domains.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.8, duration: 0.5 }}
      className="rounded-2xl p-6 glass-card"
    >
      <div className="flex items-center gap-2 mb-5">
        <Link2 className="w-4 h-4 text-blue-400" />
        <h3 className="text-sm font-semibold">Top Domains</h3>
      </div>
      <div className="space-y-3">
        {domains.map((domain, i) => (
          <div key={domain.name} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 truncate">{domain.name}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(domain.count / Math.max(...domains.map((d) => d.count))) * 100}%` }}
                transition={{ delay: 0.9 + i * 0.05, duration: 0.5 }}
                className="h-full rounded-full"
                style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
              />
            </div>
            <span className="text-xs font-medium tabular-nums w-8 text-right">{domain.count}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Page
// ---------------------------------------------------------------------------

export default function DashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const chatId = parseInt(resolvedParams.id);
  const { setCurrentChat } = useAppStore();
  const [chat, setChat] = useState<ChatDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChat() {
      try {
        const data = await getChat(chatId);
        setChat(data);
        setCurrentChat(data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    }
    fetchChat();
  }, [chatId, setCurrentChat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!chat) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Chat not found</p>
      </div>
    );
  }

  // Format date range
  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const dateRange = chat.date_range_start
    ? `${formatDate(chat.date_range_start)} — ${formatDate(chat.date_range_end)}`
    : "No date range";

  // Count media (non-text, non-deleted)
  const mediaCount = chat.type_breakdown
    .filter((t) => t.type !== "text" && t.type !== "deleted")
    .reduce((sum, t) => sum + t.count, 0);

  // Important count
  const importantCount = chat.type_breakdown.find((t) => t.type === "important")?.count || 0;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-2xl font-bold tracking-tight">{chat.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{dateRange}</p>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={MessageSquareText}
          label="Messages"
          value={chat.message_count}
          color="oklch(0.65 0.18 265)"
          bgColor="oklch(0.65 0.18 265 / 12%)"
          index={0}
        />
        <StatCard
          icon={Users}
          label="Senders"
          value={chat.senders.length}
          color="oklch(0.7 0.15 165)"
          bgColor="oklch(0.7 0.15 165 / 12%)"
          index={1}
        />
        <StatCard
          icon={BarChart3}
          label="Media Items"
          value={mediaCount}
          color="oklch(0.72 0.18 15)"
          bgColor="oklch(0.72 0.18 15 / 12%)"
          index={2}
        />
        <StatCard
          icon={Star}
          label="Important"
          value={importantCount}
          color="oklch(0.8 0.18 85)"
          bgColor="oklch(0.8 0.18 85 / 12%)"
          index={3}
        />
      </div>

      {/* Type breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="rounded-2xl p-5 glass-card mb-8"
      >
        <h3 className="text-sm font-semibold mb-4 px-1">Content Breakdown</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {chat.type_breakdown
            .sort((a, b) => b.count - a.count)
            .map((t, i) => (
              <TypePanel
                key={t.type}
                type={t.type}
                count={t.count}
                total={chat.message_count}
                chatId={chatId}
                index={i}
              />
            ))}
        </div>
      </motion.div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SenderChart senders={chat.senders} />
        <TypeDistributionChart breakdown={chat.type_breakdown} />
        <ActivityChart chatId={chatId} />
        <DomainBreakdownChart chatId={chatId} />
      </div>
    </div>
  );
}
