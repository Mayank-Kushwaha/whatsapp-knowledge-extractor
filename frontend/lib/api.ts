/**
 * Typed API client for the WhatsApp Knowledge Extractor backend.
 * All fetch wrappers for FastAPI endpoints live here.
 *
 * URL strategy:
 * - In production (Vercel): API_BASE is "" (empty string). All /api/* and
 *   /media/* requests are relative URLs that Vercel's rewrite proxy in
 *   next.config.ts forwards to the Render backend. This means zero CORS
 *   issues because the browser sees requests going to the same origin.
 * - In local dev: API_BASE falls back to http://localhost:8000 so direct
 *   fetch calls still work when the rewrite proxy isn't in play.
 *
 * NEXT_PUBLIC_API_URL MUST be set on Vercel to your Render backend URL
 * (e.g. https://your-service.onrender.com). It is used in two ways:
 *   1. By next.config.ts at build time to configure the rewrite destination.
 *   2. By uploadChat() at runtime to POST files directly to Render, bypassing
 *      Vercel's 4.5 MB proxy limit. Without this set, uploads of any size will
 *      be routed through the Vercel proxy and fail for files > 4.5 MB.
 * All other API calls still use relative URLs through the rewrite proxy.
 *
 * Sample chat: any function that takes a chatId short-circuits to canned
 * data from ./sample-chat when the id is SAMPLE_CHAT_ID, so the demo chat
 * works in production without touching the backend.
 */

import {
  SAMPLE_CHAT_ID,
  getSampleChat,
  getSampleChatClusters,
  getSampleChatGraph,
  getSampleChatImportant,
  getSampleChatLinkDomains,
  getSampleChatLinks,
  getSampleChatMedia,
  getSampleChatMessages,
  getSampleChats,
  getSampleClusterMessages,
  sampleDeleteChat,
  sampleSearchChat,
  sampleToggleImportance,
} from "./sample-chat";

// Empty string = use relative URLs (goes through Next.js rewrite proxy).
// Falls back to localhost only when running outside of Next.js (e.g. tests).
const API_BASE =
  typeof window !== "undefined"
    ? ""
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Auth — attach the Google ID token from the NextAuth session to every
// backend request so FastAPI's get_current_user dependency can verify it.
// `getSession` is imported dynamically because lib/api.ts is consumed by
// both client and server components; dynamic import keeps this client-only.
// ---------------------------------------------------------------------------

async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  try {
    const { getSession } = await import("next-auth/react");
    const session = (await getSession()) as
      | (null | { idToken?: string })
      | undefined;
    const idToken = session?.idToken;
    return idToken ? { Authorization: `Bearer ${idToken}` } : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const auth = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...auth,
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function checkHealth(): Promise<{ status: string; service: string; version: string }> {
  return apiFetch("/health");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Chat {
  id: number;
  name: string;
  type: string;
  created_at: string;
  message_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
  status: string;
  sender_count?: number;
}

export interface SenderInfo {
  id: number;
  display_name: string;
  message_count: number;
}

export interface PipelineInfo {
  current_step: number;
  steps_complete: number;
  steps_total: number;
  error: string | null;
}

export interface TypeBreakdown {
  type: string;
  count: number;
}

export interface ChatDetail extends Chat {
  senders: SenderInfo[];
  pipeline: PipelineInfo | null;
  type_breakdown: TypeBreakdown[];
}

export interface Message {
  id: number;
  chat_id: number;
  sender_id: number | null;
  content: string;
  timestamp: string;
  type: string;
  is_important: boolean;
  importance_reason: string | null;
  cluster_id: number | null;
  raw_line: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
}

// ---------------------------------------------------------------------------
// Link types
// ---------------------------------------------------------------------------

export interface LinkSenderInfo {
  id: number;
  display_name: string;
}

export interface LinkItem {
  id: number;
  message_id: number;
  url: string;
  domain: string;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  link_type: string | null;
  sender: LinkSenderInfo | null;
  timestamp: string | null;
  message_content: string | null;
}

export interface PaginatedLinks {
  links: LinkItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface DomainBreakdown {
  domain: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Important types
// ---------------------------------------------------------------------------

export interface ImportantSender {
  id: number;
  display_name: string;
}

export interface FlagInfo {
  trigger_type: string;
  trigger_value: string | null;
}

export interface ImportantMessage {
  id: number;
  chat_id: number;
  sender: ImportantSender | null;
  content: string;
  timestamp: string;
  type: string;
  importance_reason: string | null;
  flags: FlagInfo[];
}

export interface PaginatedImportant {
  messages: ImportantMessage[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ---------------------------------------------------------------------------
// Media item types
// ---------------------------------------------------------------------------

export interface MediaSenderInfo {
  id: number;
  display_name: string;
}

export interface MediaItemResponse {
  id: number;
  message_id: number;
  chat_id: number;
  type: string;
  original_filename: string | null;
  local_path: string | null;
  mime_type: string | null;
  file_size_bytes: number | null;
  extracted_text: string | null;
  sender: MediaSenderInfo | null;
  timestamp: string | null;
  message_content: string | null;
}

export interface PaginatedMedia {
  items: MediaItemResponse[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ---------------------------------------------------------------------------
// SSE Progress Event types
// ---------------------------------------------------------------------------

export interface ProgressEvent {
  step: number;
  step_name: string;
  steps_total: number;
  status: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Chat endpoints
// ---------------------------------------------------------------------------

export async function getChats(): Promise<Chat[]> {
  // Always prepend the sample chat so the sidebar is populated even on a
  // fresh backend with no uploads yet — and even if the backend is down.
  const sample = getSampleChats();
  try {
    const real = await apiFetch<Chat[]>("/api/chats");
    return [...sample, ...real.filter((c) => c.id !== SAMPLE_CHAT_ID)];
  } catch {
    return sample;
  }
}

export async function getChat(id: number): Promise<ChatDetail> {
  if (id === SAMPLE_CHAT_ID) return getSampleChat();
  return apiFetch(`/api/chats/${id}`);
}

export async function getChatMessages(
  chatId: number,
  params?: {
    page?: number;
    per_page?: number;
    type?: string;
    sender?: string;
    is_important?: boolean;
  }
): Promise<PaginatedResponse<Message>> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatMessages(params);
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.per_page) searchParams.set("per_page", String(params.per_page));
  if (params?.type) searchParams.set("type", params.type);
  if (params?.sender) searchParams.set("sender", params.sender);
  if (params?.is_important) searchParams.set("is_important", "true");
  const qs = searchParams.toString();
  return apiFetch(`/api/chats/${chatId}/messages${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Links endpoints
// ---------------------------------------------------------------------------

export async function getChatLinks(
  chatId: number,
  params?: {
    page?: number;
    page_size?: number;
    domain?: string;
    link_type?: string;
    sender_id?: number;
    start_date?: string;
    end_date?: string;
    sort?: string;
  }
): Promise<PaginatedLinks> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatLinks(params);
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));
  if (params?.domain) searchParams.set("domain", params.domain);
  if (params?.link_type) searchParams.set("link_type", params.link_type);
  if (params?.sender_id) searchParams.set("sender_id", String(params.sender_id));
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.sort) searchParams.set("sort", params.sort);
  const qs = searchParams.toString();
  return apiFetch(`/api/chats/${chatId}/links${qs ? `?${qs}` : ""}`);
}

export async function getChatLinkDomains(chatId: number): Promise<DomainBreakdown[]> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatLinkDomains();
  return apiFetch(`/api/chats/${chatId}/links/domains`);
}

// ---------------------------------------------------------------------------
// Important endpoints
// ---------------------------------------------------------------------------

export async function getChatImportant(
  chatId: number,
  params?: {
    page?: number;
    page_size?: number;
    trigger_type?: string;
    sender_id?: number;
    sort?: string;
  }
): Promise<PaginatedImportant> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatImportant(params);
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));
  if (params?.trigger_type) searchParams.set("trigger_type", params.trigger_type);
  if (params?.sender_id) searchParams.set("sender_id", String(params.sender_id));
  if (params?.sort) searchParams.set("sort", params.sort);
  const qs = searchParams.toString();
  return apiFetch(`/api/chats/${chatId}/important${qs ? `?${qs}` : ""}`);
}

export async function toggleImportance(
  chatId: number,
  messageId: number
): Promise<{ message_id: number; is_important: boolean; action: string }> {
  if (chatId === SAMPLE_CHAT_ID) return sampleToggleImportance(messageId);
  return apiFetch(`/api/chats/${chatId}/messages/${messageId}/flag`, {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Media endpoints
// ---------------------------------------------------------------------------

export async function getChatMedia(
  chatId: number,
  params?: {
    page?: number;
    page_size?: number;
    type?: string;
    sender_id?: number;
    start_date?: string;
    end_date?: string;
    sort?: string;
  }
): Promise<PaginatedMedia> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatMedia(params);
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));
  if (params?.type) searchParams.set("type", params.type);
  if (params?.sender_id) searchParams.set("sender_id", String(params.sender_id));
  if (params?.start_date) searchParams.set("start_date", params.start_date);
  if (params?.end_date) searchParams.set("end_date", params.end_date);
  if (params?.sort) searchParams.set("sort", params.sort);
  const qs = searchParams.toString();
  return apiFetch(`/api/chats/${chatId}/media${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

// For uploads, bypass the Vercel proxy (4.5 MB limit) and go directly to the
// Render backend. NEXT_PUBLIC_API_URL must be set to the Render service URL.
// In local dev it falls back to localhost just like API_BASE does.
const UPLOAD_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function uploadChat(
  file: File,
  options?: { chatId?: number }
): Promise<{ chat_id: number; status: string; message?: string; name?: string }> {
  if (options?.chatId === SAMPLE_CHAT_ID) {
    throw new Error("The demo chat can't be updated — upload a real chat to manage your own.");
  }

  const formData = new FormData();
  formData.append("file", file);
  if (options?.chatId) {
    formData.append("chat_id", String(options.chatId));
  }

  const auth = await authHeaders();
  const res = await fetch(`${UPLOAD_URL}/api/chats/upload`, {
    method: "POST",
    body: formData,
    headers: { ...auth },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Upload error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

/**
 * Pipeline progress is exposed by polling GET /api/chats/{id} — the chat
 * detail response carries `status` (processing|ready|error) and a
 * `pipeline` field with current_step / steps_complete / steps_total /
 * error. SSE was removed because EventSource cannot carry an
 * Authorization header.
 */

export async function deleteChat(
  chatId: number
): Promise<{ success: boolean; chat_id: number; message: string }> {
  if (chatId === SAMPLE_CHAT_ID) sampleDeleteChat();
  return apiFetch(`/api/chats/${chatId}`, {
    method: "DELETE",
  });
}

// ---------------------------------------------------------------------------
// Media URL helper
// ---------------------------------------------------------------------------

export function mediaUrl(path: string): string {
  // When the backend uses MEDIA_BACKEND=cloudinary, media_items.local_path
  // already holds an absolute https URL (the Cloudinary secure_url). In that
  // case render it as-is — prefixing /media/ would produce a broken URL like
  // /media/https://res.cloudinary.com/... and the rewrite proxy would try to
  // forward that to the Render backend.
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}/media/${path}`;
}

// ---------------------------------------------------------------------------
// Pipeline step names
// ---------------------------------------------------------------------------

export const PIPELINE_STEPS: Record<number, string> = {
  1: "Parsing messages",
  2: "Classifying content",
  3: "Fetching link metadata",
  4: "Extracting PDF text",
  5: "Generating embeddings",
  6: "Clustering topics",
  7: "Labeling clusters",
  8: "Tagging important",
  9: "Building search index",
  10: "Finalizing",
};

// ---------------------------------------------------------------------------
// Media type utilities
// ---------------------------------------------------------------------------

export type MediaType =
  | "link"
  | "image"
  | "video"
  | "pdf"
  | "document"
  | "audio"
  | "contact"
  | "location"
  | "text"
  | "important"
  | "deleted"
  | "unknown_media";

export const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: string }> = {
  link: { label: "Links", color: "var(--type-link)", bgColor: "var(--type-link-bg)", icon: "🔗" },
  image: { label: "Images", color: "var(--type-image)", bgColor: "var(--type-image-bg)", icon: "🖼️" },
  video: { label: "Videos", color: "var(--type-video)", bgColor: "var(--type-video-bg)", icon: "🎬" },
  pdf: { label: "PDFs", color: "var(--type-doc)", bgColor: "var(--type-doc-bg)", icon: "📄" },
  document: { label: "Documents", color: "var(--type-doc)", bgColor: "var(--type-doc-bg)", icon: "📑" },
  audio: { label: "Audio", color: "var(--type-audio)", bgColor: "var(--type-audio-bg)", icon: "🎵" },
  contact: { label: "Contacts", color: "var(--type-contact)", bgColor: "var(--type-contact-bg)", icon: "👤" },
  location: { label: "Locations", color: "var(--type-location)", bgColor: "var(--type-location-bg)", icon: "📍" },
  text: { label: "Messages", color: "var(--type-text)", bgColor: "var(--type-text-bg)", icon: "💬" },
  important: { label: "Important", color: "var(--type-important)", bgColor: "var(--type-important-bg)", icon: "⭐" },
  deleted: { label: "Deleted", color: "var(--type-text)", bgColor: "var(--type-text-bg)", icon: "🗑️" },
  unknown_media: { label: "Media", color: "var(--type-text)", bgColor: "var(--type-text-bg)", icon: "📎" },
};

// ---------------------------------------------------------------------------
// Utility: format file size
// ---------------------------------------------------------------------------

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Utility: format relative time
// ---------------------------------------------------------------------------

export function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

// ---------------------------------------------------------------------------
// Cluster types
// ---------------------------------------------------------------------------

export interface ClusterItem {
  id: number;
  chat_id: number;
  label: string | null;
  summary: string | null;
  message_count: number;
  date_range_start: string | null;
  date_range_end: string | null;
}

export interface ClusterMessage {
  id: number;
  sender_id: number | null;
  sender_name: string | null;
  content: string;
  timestamp: string;
  type: string;
  is_important: boolean;
}

export interface PaginatedClusterMessages {
  cluster: ClusterItem;
  messages: ClusterMessage[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

// ---------------------------------------------------------------------------
// Cluster endpoints
// ---------------------------------------------------------------------------

export async function getChatClusters(chatId: number): Promise<ClusterItem[]> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatClusters();
  return apiFetch(`/api/chats/${chatId}/clusters`);
}

export async function getClusterMessages(
  chatId: number,
  clusterId: number,
  params?: {
    page?: number;
    page_size?: number;
  }
): Promise<PaginatedClusterMessages> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleClusterMessages(clusterId, params);
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.page_size) searchParams.set("page_size", String(params.page_size));
  const qs = searchParams.toString();
  return apiFetch(`/api/chats/${chatId}/clusters/${clusterId}/messages${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Search types
// ---------------------------------------------------------------------------

export interface SearchResultItem {
  id: number;
  chat_id: number;
  chat_name: string | null;
  sender_id: number | null;
  sender_name: string | null;
  content: string;
  timestamp: string;
  type: string;
  is_important: boolean;
  cluster_id: number | null;
  score: number;
  match_type: string;
  context_before: string | null;
  context_after: string | null;
}

export interface SearchResponse {
  results: SearchResultItem[];
  total: number;
  query: string;
  mode: string;
  filters_applied: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Search endpoints
// ---------------------------------------------------------------------------

export async function searchChat(
  chatId: number,
  params: {
    q: string;
    mode?: string;
    sender?: string;
    sender_id?: number;
    type?: string;
    is_important?: boolean;
    cluster_id?: number;
    start_date?: string;
    end_date?: string;
    domain?: string;
    limit?: number;
  }
): Promise<SearchResponse> {
  if (chatId === SAMPLE_CHAT_ID) return sampleSearchChat(params.q);
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  if (params.mode) searchParams.set("mode", params.mode);
  if (params.sender) searchParams.set("sender", params.sender);
  if (params.sender_id) searchParams.set("sender_id", String(params.sender_id));
  if (params.type) searchParams.set("type", params.type);
  if (params.is_important !== undefined) searchParams.set("is_important", String(params.is_important));
  if (params.cluster_id) searchParams.set("cluster_id", String(params.cluster_id));
  if (params.start_date) searchParams.set("start_date", params.start_date);
  if (params.end_date) searchParams.set("end_date", params.end_date);
  if (params.domain) searchParams.set("domain", params.domain);
  if (params.limit) searchParams.set("limit", String(params.limit));
  return apiFetch(`/api/chats/${chatId}/search?${searchParams.toString()}`);
}

export async function searchGlobal(
  params: {
    q: string;
    mode?: string;
    sender?: string;
    type?: string;
    is_important?: boolean;
    start_date?: string;
    end_date?: string;
    domain?: string;
    limit?: number;
  }
): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q);
  if (params.mode) searchParams.set("mode", params.mode);
  if (params.sender) searchParams.set("sender", params.sender);
  if (params.type) searchParams.set("type", params.type);
  if (params.is_important !== undefined) searchParams.set("is_important", String(params.is_important));
  if (params.start_date) searchParams.set("start_date", params.start_date);
  if (params.end_date) searchParams.set("end_date", params.end_date);
  if (params.domain) searchParams.set("domain", params.domain);
  if (params.limit) searchParams.set("limit", String(params.limit));
  return apiFetch(`/api/search?${searchParams.toString()}`);
}

// ---------------------------------------------------------------------------
// Graph types
// ---------------------------------------------------------------------------

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  size: number;
  color: string;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface GraphStats {
  total_nodes: number;
  total_edges: number;
  node_types: Record<string, number>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

// ---------------------------------------------------------------------------
// Graph endpoints
// ---------------------------------------------------------------------------

export async function getChatGraph(
  chatId: number,
  params?: {
    max_nodes?: number;
    filter_type?: string;
    filter_sender?: string;
    filter_cluster?: number;
  }
): Promise<GraphData> {
  if (chatId === SAMPLE_CHAT_ID) return getSampleChatGraph();
  const searchParams = new URLSearchParams();
  if (params?.max_nodes) searchParams.set("max_nodes", String(params.max_nodes));
  if (params?.filter_type) searchParams.set("filter_type", params.filter_type);
  if (params?.filter_sender) searchParams.set("filter_sender", params.filter_sender);
  if (params?.filter_cluster) searchParams.set("filter_cluster", String(params.filter_cluster));
  const qs = searchParams.toString();
  return apiFetch(`/api/chats/${chatId}/graph${qs ? `?${qs}` : ""}`);
}

// ---------------------------------------------------------------------------
// Utility: YouTube thumbnail URL
// ---------------------------------------------------------------------------

export function getYouTubeThumbnail(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
}

