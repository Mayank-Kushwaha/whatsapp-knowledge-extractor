/**
 * Typed API client for the WhatsApp Knowledge Extractor backend.
 * All fetch wrappers for FastAPI endpoints live here.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
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

export interface LinkItem {
  id: number;
  message_id: number;
  url: string;
  domain: string;
  og_title: string | null;
  og_description: string | null;
  og_image_url: string | null;
  link_type: string | null;
}

export interface ImportantMessage {
  id: number;
  message_id: number;
  trigger_type: string;
  trigger_value: string;
  flagged_at: string;
  message: Message;
}

export interface DomainBreakdown {
  domain: string;
  count: number;
}

export interface LinksResponse {
  links: LinkItem[];
  total: number;
  domains: DomainBreakdown[];
}

export interface ImportantResponse {
  items: ImportantMessage[];
  total: number;
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
  return apiFetch("/api/chats");
}

export async function getChat(id: number): Promise<ChatDetail> {
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

export async function getChatLinks(chatId: number): Promise<LinksResponse> {
  return apiFetch(`/api/chats/${chatId}/links`);
}

// ---------------------------------------------------------------------------
// Important endpoints
// ---------------------------------------------------------------------------

export async function getChatImportant(chatId: number): Promise<ImportantResponse> {
  return apiFetch(`/api/chats/${chatId}/important`);
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

export async function uploadChat(file: File): Promise<{ chat_id: number; status: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/chats/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Upload error ${res.status}: ${errorBody}`);
  }

  return res.json();
}

/**
 * Create an SSE EventSource for pipeline progress.
 * Returns the EventSource — caller manages onmessage/onerror.
 */
export function createProgressStream(chatId: number): EventSource {
  return new EventSource(`${API_BASE}/api/chats/${chatId}/progress`);
}

// ---------------------------------------------------------------------------
// Media URL helper
// ---------------------------------------------------------------------------

export function mediaUrl(path: string): string {
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
