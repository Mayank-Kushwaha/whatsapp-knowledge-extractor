/**
 * Demo / sample chat used to populate the production UI with realistic-looking
 * data so first-time visitors can see what a processed chat looks like without
 * uploading anything.
 *
 * Everything in this file is fake. The chat lives only in the browser — the
 * backend never sees it. lib/api.ts short-circuits every chat-id-taking
 * function when the id matches SAMPLE_CHAT_ID and returns data from here
 * instead of hitting the network.
 *
 * Real backend ids are positive autoincrement integers starting at 1, so we
 * use 0 for the sample chat and negative numbers for every other id (messages,
 * clusters, senders, links, media) so a collision is impossible.
 */

import type {
  Chat,
  ChatDetail,
  ClusterItem,
  ClusterMessage,
  DomainBreakdown,
  GraphData,
  ImportantMessage,
  LinkItem,
  MediaItemResponse,
  Message,
  PaginatedClusterMessages,
  PaginatedImportant,
  PaginatedLinks,
  PaginatedMedia,
  PaginatedResponse,
  SearchResponse,
  SearchResultItem,
  SenderInfo,
  TypeBreakdown,
} from "./api";

export const SAMPLE_CHAT_ID = 0;
export const SAMPLE_CHAT_NAME = "Tech Squad (Demo)";

// ---------------------------------------------------------------------------
// Senders
// ---------------------------------------------------------------------------

const SENDER_DEFS = [
  { id: -1, name: "Aarav", messages: 842 },
  { id: -2, name: "Diya", messages: 763 },
  { id: -3, name: "Karan", messages: 691 },
  { id: -4, name: "Meera", messages: 528 },
  { id: -5, name: "Rohan", messages: 423 },
] as const;

const sampleSenders: SenderInfo[] = SENDER_DEFS.map((s) => ({
  id: s.id,
  display_name: s.name,
  message_count: s.messages,
}));

const senderById = new Map(SENDER_DEFS.map((s) => [s.id, s.name] as const));

// ---------------------------------------------------------------------------
// Type breakdown — matches the totals below
// ---------------------------------------------------------------------------

const TOTAL_MESSAGES = SENDER_DEFS.reduce((a, b) => a + b.messages, 0); // 3247

const sampleTypeBreakdown: TypeBreakdown[] = [
  { type: "text", count: 2480 },
  { type: "link", count: 384 },
  { type: "image", count: 198 },
  { type: "video", count: 47 },
  { type: "audio", count: 35 },
  { type: "pdf", count: 23 },
  { type: "important", count: 18 },
  { type: "contact", count: 8 },
  { type: "location", count: 4 },
  { type: "deleted", count: 12 },
  { type: "unknown_media", count: 38 },
];

const DATE_START = "2026-03-15T08:00:00";
const DATE_END = "2026-05-21T22:30:00";

// ---------------------------------------------------------------------------
// Chat records
// ---------------------------------------------------------------------------

export const sampleChat: Chat = {
  id: SAMPLE_CHAT_ID,
  name: SAMPLE_CHAT_NAME,
  type: "group",
  created_at: DATE_START,
  message_count: TOTAL_MESSAGES,
  date_range_start: DATE_START,
  date_range_end: DATE_END,
  status: "ready",
  sender_count: sampleSenders.length,
};

export const sampleChatDetail: ChatDetail = {
  ...sampleChat,
  senders: sampleSenders,
  pipeline: { current_step: 10, steps_complete: 10, steps_total: 10, error: null },
  type_breakdown: sampleTypeBreakdown,
};

// ---------------------------------------------------------------------------
// Topic clusters
// ---------------------------------------------------------------------------

const CLUSTER_DEFS = [
  {
    id: -1,
    label: "AI & Coding",
    summary: "Discussion around Claude, ChatGPT, and pair-programming workflows.",
    count: 412,
  },
  {
    id: -2,
    label: "Weekend Plans",
    summary: "Trip planning, restaurant picks, and weekend hangouts.",
    count: 287,
  },
  {
    id: -3,
    label: "Job Hunt & Interviews",
    summary: "Interview prep, recruiter pings, and offer comparisons.",
    count: 234,
  },
  {
    id: -4,
    label: "Anime & K-Drama",
    summary: "Anime episode reactions and weekly K-drama recap threads.",
    count: 198,
  },
  {
    id: -5,
    label: "Side Projects",
    summary: "Updates on portfolio sites, browser extensions, and indie apps.",
    count: 176,
  },
  {
    id: -6,
    label: "Tech News",
    summary: "Hacker News links, model launches, and product Hunt drops.",
    count: 154,
  },
  {
    id: -7,
    label: "Memes & Banter",
    summary: "Reels, screenshots, and the daily round of inside jokes.",
    count: 142,
  },
  {
    id: -8,
    label: "Travel & Tickets",
    summary: "Flight deals, train bookings, and Goa-trip logistics.",
    count: 89,
  },
] as const;

const sampleClusters: ClusterItem[] = CLUSTER_DEFS.map((c, i) => ({
  id: c.id,
  chat_id: SAMPLE_CHAT_ID,
  label: c.label,
  summary: c.summary,
  message_count: c.count,
  date_range_start: DATE_START,
  date_range_end: DATE_END,
}));

// ---------------------------------------------------------------------------
// Messages — generated, spread across the date range so day-of-week chart
// renders interestingly. Pre-baked so the same set is returned every call.
// ---------------------------------------------------------------------------

const SAMPLE_TEXTS = [
  "Anyone tried the new Claude 4.7 release yet? feels noticeably better at long-context stuff",
  "Bro it's been 3 days, are we doing the goa trip or not",
  "Diya you ARE the goa trip",
  "Just finished episode 12 of Frieren — no spoilers please",
  "https://youtu.be/dQw4w9WgXcQ this changed my life",
  "anyone got the link for that resume template",
  "Got the Microsoft offer 🎉",
  "WAIT WHAT congrats!!!",
  "deets in DM",
  "Pushed the portfolio site live, let me know what breaks",
  "Looks great but the contact form is 404",
  "fixed",
  "tomorrow's standup is cancelled fyi",
  "thank god",
  "Has anyone read the new Anthropic paper on agents",
  "skimmed it, basically saying tools > finetuning for most stuff",
  "Anyone free Saturday? Thinking of going to that new café in Indiranagar",
  "in",
  "in",
  "im in but only after 5",
  "Whoever has the AWS credit code drop it here",
  "https://github.com/anthropics/anthropic-sdk-typescript anyone used this?",
  "ya it's clean, way better DX than openai's",
  "Karan you owe me 200 from the last trip",
  "I sent it last week check your gpay",
  "oh my bad",
  "The Spotify wrapped this year is gonna be embarrassing for some of you",
  "https://open.spotify.com/track/4u8xrxiKDqh2w8Q2wUjee4 song of the year",
  "Rohan stop posting flipkart links in this group istg",
  "but it's 60% off",
  "Did anyone watch the Apple event",
  "yeah pretty meh tbh",
  "Vision Pro is still a flop",
  "Anyone has a referral for Razorpay engineering",
  "Diya I think you know someone there",
  "yep, send me the resume",
  "I'm pushing a v0.2 of the chrome extension tonight, will share for testing",
  "send",
  "Just landed in Goa ☀️",
  "📍 Anjuna Beach",
  "Photos coming",
  "Don't post photos of me in the group I look terrible",
  "too late",
  "🤡",
  "Cancelled my Netflix, anyone want to share a Prime?",
  "I have prime, throw 200 a month",
  "deal",
  "Has anyone used the new Cursor IDE properly",
  "yeah it's good but Claude Code is faster for me",
  "ngl I switch between both depending on the task",
  "The new Hindi rom-com on Netflix is actually decent",
  "which one",
  "Do Patti",
  "noted",
  "Anyone has a working invite for the GPT-5 dev preview",
  "lol no",
  "Reminder — Friday is Karan's birthday",
  "we doing dinner?",
  "yep, place TBD, dropping a poll later",
  "I'm out Friday, can we move to Saturday",
  "Karan whose birthday is it anyway",
  "fair point",
];

const TYPE_POOL: Array<Message["type"]> = [
  "text", "text", "text", "text", "text", "text", "text", "text",
  "link", "link",
  "image",
  "important",
  "text",
];

function _generateSampleMessages(): Message[] {
  const start = new Date(DATE_START).getTime();
  const end = new Date(DATE_END).getTime();
  const N = 260; // enough for the activity chart's per_page=200 sample
  const out: Message[] = [];

  for (let i = 0; i < N; i++) {
    const ts = new Date(start + ((end - start) * i) / (N - 1));
    const senderIdx = i % SENDER_DEFS.length;
    const sender = SENDER_DEFS[senderIdx];
    const text = SAMPLE_TEXTS[i % SAMPLE_TEXTS.length];
    const type = TYPE_POOL[i % TYPE_POOL.length];
    const clusterIdx = i % CLUSTER_DEFS.length;

    out.push({
      id: -(1000 + i),
      chat_id: SAMPLE_CHAT_ID,
      sender_id: sender.id,
      content: text,
      timestamp: ts.toISOString(),
      type,
      is_important: type === "important",
      importance_reason: type === "important" ? "Job offer accepted" : null,
      cluster_id: CLUSTER_DEFS[clusterIdx].id,
      raw_line: null,
    });
  }
  return out;
}

const sampleMessages = _generateSampleMessages();

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

const LINK_DEFS = [
  {
    url: "https://youtu.be/dQw4w9WgXcQ",
    domain: "youtu.be",
    og_title: "Rick Astley — Never Gonna Give You Up",
    og_description: "Official music video for Rick Astley's 1987 hit.",
    og_image: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    type: "video",
  },
  {
    url: "https://github.com/anthropics/anthropic-sdk-typescript",
    domain: "github.com",
    og_title: "anthropics/anthropic-sdk-typescript",
    og_description: "Official TypeScript SDK for the Anthropic API.",
    og_image: null,
    type: "code",
  },
  {
    url: "https://open.spotify.com/track/4u8xrxiKDqh2w8Q2wUjee4",
    domain: "open.spotify.com",
    og_title: "Song of the Year — Spotify",
    og_description: "Listen on Spotify.",
    og_image: null,
    type: "music",
  },
  {
    url: "https://news.ycombinator.com/item?id=39000000",
    domain: "news.ycombinator.com",
    og_title: "Show HN: A tool for turning WhatsApp chats into a graph",
    og_description: "I built a thing that ingests WhatsApp exports and...",
    og_image: null,
    type: "article",
  },
  {
    url: "https://www.anthropic.com/news/claude-opus-4-7",
    domain: "anthropic.com",
    og_title: "Claude Opus 4.7",
    og_description: "Anthropic's flagship model, now with a 1M-token context window.",
    og_image: null,
    type: "article",
  },
  {
    url: "https://www.flipkart.com/some-product",
    domain: "flipkart.com",
    og_title: "Portable Laptop Table — 60% off",
    og_description: "Today's deal on Flipkart.",
    og_image: null,
    type: "shopping",
  },
  {
    url: "https://twitter.com/sama/status/1234567890",
    domain: "twitter.com",
    og_title: "@sama on X",
    og_description: "tweets about AGI again",
    og_image: null,
    type: "social",
  },
  {
    url: "https://www.linkedin.com/in/karan-s",
    domain: "linkedin.com",
    og_title: "Karan S. — Software Engineer @ Microsoft",
    og_description: "I'm thrilled to share that I've joined Microsoft...",
    og_image: null,
    type: "social",
  },
] as const;

function _generateSampleLinks(): LinkItem[] {
  const start = new Date(DATE_START).getTime();
  const end = new Date(DATE_END).getTime();
  const out: LinkItem[] = [];
  // 48 link items total; cycle through defs
  for (let i = 0; i < 48; i++) {
    const def = LINK_DEFS[i % LINK_DEFS.length];
    const senderIdx = i % SENDER_DEFS.length;
    const sender = SENDER_DEFS[senderIdx];
    const ts = new Date(start + ((end - start) * i) / 47).toISOString();
    out.push({
      id: -(2000 + i),
      message_id: -(1000 + (i * 5) % 260),
      url: def.url,
      domain: def.domain,
      og_title: def.og_title,
      og_description: def.og_description,
      og_image_url: def.og_image,
      link_type: def.type,
      sender: { id: sender.id, display_name: sender.name },
      timestamp: ts,
      message_content: SAMPLE_TEXTS[i % SAMPLE_TEXTS.length],
    });
  }
  return out;
}

const sampleLinks = _generateSampleLinks();

const sampleDomains: DomainBreakdown[] = [
  { domain: "youtu.be", count: 102 },
  { domain: "github.com", count: 64 },
  { domain: "twitter.com", count: 48 },
  { domain: "linkedin.com", count: 41 },
  { domain: "open.spotify.com", count: 38 },
  { domain: "news.ycombinator.com", count: 27 },
  { domain: "flipkart.com", count: 22 },
  { domain: "anthropic.com", count: 19 },
];

// ---------------------------------------------------------------------------
// Important messages
// ---------------------------------------------------------------------------

const IMPORTANT_DEFS = [
  { text: "Got the Microsoft offer 🎉", reason: "Job offer accepted" },
  { text: "Diya's flight to Goa is 6 AM, leaving for airport at 3:30", reason: "Travel logistics" },
  { text: "Karan's birthday Friday — dinner reservation at Toit 8 PM", reason: "Event scheduled" },
  { text: "Razorpay referral submitted — Diya is the referrer", reason: "Job application" },
  { text: "We split the airbnb 5 ways — 4200 per person, send to Aarav", reason: "Money owed" },
  { text: "Anjuna Airbnb booking ref: ABRB-77291", reason: "Booking confirmation" },
  { text: "Pushing v0.2 of chrome extension tonight — test before publish", reason: "Action item" },
  { text: "Domain renewal due May 28 ($14) — Karan on it", reason: "Deadline" },
  { text: "Standup cancelled tomorrow — manager OOO", reason: "Schedule change" },
  { text: "Aarav AWS credit code: AWSCR-DEMO-7732X (do not share)", reason: "Credentials" },
  { text: "Goa group trip dates locked: May 24 → May 28", reason: "Event confirmed" },
  { text: "Final list of attendees for trip: Aarav, Diya, Karan, Meera, Rohan", reason: "Confirmed attendance" },
];

function _generateSampleImportant(): ImportantMessage[] {
  const start = new Date(DATE_START).getTime();
  const end = new Date(DATE_END).getTime();
  return IMPORTANT_DEFS.map((d, i) => ({
    id: -(3000 + i),
    chat_id: SAMPLE_CHAT_ID,
    sender: { id: SENDER_DEFS[i % SENDER_DEFS.length].id, display_name: SENDER_DEFS[i % SENDER_DEFS.length].name },
    content: d.text,
    timestamp: new Date(start + ((end - start) * i) / (IMPORTANT_DEFS.length - 1)).toISOString(),
    type: "important",
    importance_reason: d.reason,
    flags: [
      { trigger_type: i % 2 === 0 ? "llm" : "rule", trigger_value: d.reason },
    ],
  }));
}

const sampleImportant = _generateSampleImportant();

// ---------------------------------------------------------------------------
// Media items (images, videos, pdf, audio, contact, location)
// ---------------------------------------------------------------------------

const MEDIA_DEFS: Array<{ type: string; filename: string; mime: string; size: number; text: string | null }> = [
  { type: "image", filename: "anjuna-sunset.jpg", mime: "image/jpeg", size: 2_400_000, text: null },
  { type: "image", filename: "karan-birthday-cake.jpg", mime: "image/jpeg", size: 1_800_000, text: null },
  { type: "image", filename: "code-review-screenshot.png", mime: "image/png", size: 480_000, text: null },
  { type: "image", filename: "boarding-pass.jpg", mime: "image/jpeg", size: 920_000, text: null },
  { type: "image", filename: "whiteboard-arch.jpg", mime: "image/jpeg", size: 3_100_000, text: null },
  { type: "image", filename: "memes-friday.png", mime: "image/png", size: 620_000, text: null },
  { type: "video", filename: "goa-beach-clip.mp4", mime: "video/mp4", size: 24_000_000, text: null },
  { type: "video", filename: "demo-walkthrough.mp4", mime: "video/mp4", size: 18_500_000, text: null },
  { type: "video", filename: "extension-demo.mp4", mime: "video/mp4", size: 7_800_000, text: null },
  { type: "pdf", filename: "Aarav_Resume_v3.pdf", mime: "application/pdf", size: 280_000, text: "Aarav K. — Software Engineer with 4 years experience in distributed systems..." },
  { type: "pdf", filename: "Goa_Itinerary.pdf", mime: "application/pdf", size: 410_000, text: "Day 1: Arrive 10AM. Check into Anjuna Airbnb. Lunch at Curlies..." },
  { type: "pdf", filename: "Offer_Letter_MSFT.pdf", mime: "application/pdf", size: 165_000, text: "Microsoft Corporation. We are pleased to extend an offer..." },
  { type: "audio", filename: "voice-note-1.opus", mime: "audio/opus", size: 145_000, text: null },
  { type: "audio", filename: "song-rec.opus", mime: "audio/opus", size: 220_000, text: null },
  { type: "contact", filename: "Razorpay_Recruiter.vcf", mime: "text/vcard", size: 1_200, text: null },
  { type: "location", filename: "anjuna-beach.geo", mime: "application/geo+json", size: 800, text: null },
];

function _generateSampleMedia(): MediaItemResponse[] {
  const start = new Date(DATE_START).getTime();
  const end = new Date(DATE_END).getTime();
  return MEDIA_DEFS.map((m, i) => ({
    id: -(4000 + i),
    message_id: -(1000 + (i * 7) % 260),
    chat_id: SAMPLE_CHAT_ID,
    type: m.type,
    original_filename: m.filename,
    local_path: null, // intentionally null — UI falls back to placeholders
    mime_type: m.mime,
    file_size_bytes: m.size,
    extracted_text: m.text,
    sender: { id: SENDER_DEFS[i % SENDER_DEFS.length].id, display_name: SENDER_DEFS[i % SENDER_DEFS.length].name },
    timestamp: new Date(start + ((end - start) * i) / (MEDIA_DEFS.length - 1)).toISOString(),
    message_content: SAMPLE_TEXTS[i % SAMPLE_TEXTS.length],
  }));
}

const sampleMedia = _generateSampleMedia();

// ---------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------

function _generateSampleGraph(): GraphData {
  const nodes: GraphData["nodes"] = [];
  const edges: GraphData["edges"] = [];

  // Sender nodes (5)
  for (const s of SENDER_DEFS) {
    nodes.push({
      id: `sender-${s.id}`,
      label: s.name,
      type: "sender",
      size: 40 + s.messages / 25,
      color: "oklch(0.7 0.15 165)",
      metadata: { message_count: s.messages },
    });
  }

  // Topic nodes (8)
  for (const c of CLUSTER_DEFS) {
    nodes.push({
      id: `topic-${c.id}`,
      label: c.label,
      type: "topic",
      size: 30 + c.count / 12,
      color: "oklch(0.65 0.18 265)",
      metadata: { message_count: c.count, summary: c.summary },
    });
  }

  // Domain nodes (5)
  for (const d of sampleDomains.slice(0, 5)) {
    nodes.push({
      id: `domain-${d.domain}`,
      label: d.domain,
      type: "link",
      size: 18 + d.count / 6,
      color: "oklch(0.65 0.2 300)",
      metadata: { link_count: d.count },
    });
  }

  // Important nodes (3 — representative)
  for (let i = 0; i < 3; i++) {
    nodes.push({
      id: `important-${i}`,
      label: IMPORTANT_DEFS[i].text.slice(0, 32) + "…",
      type: "important",
      size: 16,
      color: "oklch(0.8 0.18 85)",
      metadata: { reason: IMPORTANT_DEFS[i].reason },
    });
  }

  // Edges: sender → topic (every sender contributes to every topic, weights vary)
  for (const s of SENDER_DEFS) {
    for (const c of CLUSTER_DEFS) {
      edges.push({
        source: `sender-${s.id}`,
        target: `topic-${c.id}`,
        type: "discusses",
        weight: 1 + Math.abs((s.id * c.id) % 7),
      });
    }
  }

  // Edges: sender → domain (top senders share top domains)
  for (let i = 0; i < SENDER_DEFS.length; i++) {
    const s = SENDER_DEFS[i];
    for (let j = 0; j < Math.min(3, sampleDomains.length); j++) {
      const d = sampleDomains[j];
      edges.push({
        source: `sender-${s.id}`,
        target: `domain-${d.domain}`,
        type: "shares",
        weight: 1 + ((i + j) % 4),
      });
    }
  }

  // Edges: topic → important (a few important messages anchored to topics)
  for (let i = 0; i < 3; i++) {
    edges.push({
      source: `topic-${CLUSTER_DEFS[i].id}`,
      target: `important-${i}`,
      type: "flagged",
      weight: 3,
    });
  }

  const node_types: Record<string, number> = {};
  for (const n of nodes) {
    node_types[n.type] = (node_types[n.type] || 0) + 1;
  }

  return {
    nodes,
    edges,
    stats: {
      total_nodes: nodes.length,
      total_edges: edges.length,
      node_types,
    },
  };
}

const sampleGraph = _generateSampleGraph();

// ---------------------------------------------------------------------------
// Pagination helper
// ---------------------------------------------------------------------------

function paginate<T>(items: T[], page = 1, pageSize = 20) {
  const total = items.length;
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize);
  return { slice, total, page, page_size: pageSize, total_pages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ---------------------------------------------------------------------------
// Public API — these are called from lib/api.ts when chatId === SAMPLE_CHAT_ID
// ---------------------------------------------------------------------------

export function getSampleChats(): Chat[] {
  return [sampleChat];
}

export function getSampleChat(): ChatDetail {
  return sampleChatDetail;
}

export function getSampleChatMessages(params?: {
  page?: number;
  per_page?: number;
  type?: string;
  sender?: string;
  is_important?: boolean;
}): PaginatedResponse<Message> {
  let items = sampleMessages;
  if (params?.type) items = items.filter((m) => m.type === params.type);
  if (params?.is_important) items = items.filter((m) => m.is_important);
  if (params?.sender) {
    const senderId = SENDER_DEFS.find((s) => s.name.toLowerCase() === params.sender!.toLowerCase())?.id;
    if (senderId !== undefined) items = items.filter((m) => m.sender_id === senderId);
  }
  const page = params?.page || 1;
  const perPage = params?.per_page || 50;
  const { slice, total } = paginate(items, page, perPage);
  return { items: slice, total, page, per_page: perPage };
}

export function getSampleChatLinks(params?: {
  page?: number;
  page_size?: number;
  domain?: string;
  link_type?: string;
}): PaginatedLinks {
  let items = sampleLinks;
  if (params?.domain) items = items.filter((l) => l.domain === params.domain);
  if (params?.link_type) items = items.filter((l) => l.link_type === params.link_type);
  const page = params?.page || 1;
  const pageSize = params?.page_size || 20;
  const { slice, total, total_pages } = paginate(items, page, pageSize);
  return {
    links: slice,
    total,
    page,
    page_size: pageSize,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

export function getSampleChatLinkDomains(): DomainBreakdown[] {
  return sampleDomains;
}

export function getSampleChatImportant(params?: {
  page?: number;
  page_size?: number;
}): PaginatedImportant {
  const page = params?.page || 1;
  const pageSize = params?.page_size || 20;
  const { slice, total, total_pages } = paginate(sampleImportant, page, pageSize);
  return {
    messages: slice,
    total,
    page,
    page_size: pageSize,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

export function sampleToggleImportance(messageId: number) {
  const found = sampleMessages.find((m) => m.id === messageId);
  const next = !(found?.is_important ?? false);
  if (found) found.is_important = next;
  return {
    message_id: messageId,
    is_important: next,
    action: next ? "flagged" : "unflagged",
  };
}

export function getSampleChatMedia(params?: {
  page?: number;
  page_size?: number;
  type?: string;
}): PaginatedMedia {
  let items = sampleMedia;
  if (params?.type) items = items.filter((m) => m.type === params.type);
  const page = params?.page || 1;
  const pageSize = params?.page_size || 24;
  const { slice, total, total_pages } = paginate(items, page, pageSize);
  return {
    items: slice,
    total,
    page,
    page_size: pageSize,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

export function getSampleChatClusters(): ClusterItem[] {
  return sampleClusters;
}

export function getSampleClusterMessages(
  clusterId: number,
  params?: { page?: number; page_size?: number }
): PaginatedClusterMessages {
  const cluster = sampleClusters.find((c) => c.id === clusterId) || sampleClusters[0];
  const clusterMessages = sampleMessages.filter((m) => m.cluster_id === clusterId);
  const page = params?.page || 1;
  const pageSize = params?.page_size || 20;
  const { slice, total, total_pages } = paginate(clusterMessages, page, pageSize);

  const formatted: ClusterMessage[] = slice.map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    sender_name: m.sender_id ? senderById.get(m.sender_id) ?? null : null,
    content: m.content,
    timestamp: m.timestamp,
    type: m.type,
    is_important: m.is_important,
  }));

  return {
    cluster,
    messages: formatted,
    total,
    page,
    page_size: pageSize,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

export function getSampleChatGraph(): GraphData {
  return sampleGraph;
}

export function sampleSearchChat(query: string): SearchResponse {
  const q = query.toLowerCase().trim();
  const results: SearchResultItem[] = sampleMessages
    .filter((m) => m.content.toLowerCase().includes(q))
    .slice(0, 30)
    .map((m, i) => ({
      id: m.id,
      chat_id: SAMPLE_CHAT_ID,
      chat_name: SAMPLE_CHAT_NAME,
      sender_id: m.sender_id,
      sender_name: m.sender_id ? senderById.get(m.sender_id) ?? null : null,
      content: m.content,
      timestamp: m.timestamp,
      type: m.type,
      is_important: m.is_important,
      cluster_id: m.cluster_id,
      score: 0.95 - i * 0.02,
      match_type: "keyword",
      context_before: null,
      context_after: null,
    }));
  return {
    results,
    total: results.length,
    query,
    mode: "keyword",
    filters_applied: {},
  };
}

export function sampleDeleteChat(): never {
  throw new Error("The demo chat can't be deleted — upload a real chat to manage your own.");
}
