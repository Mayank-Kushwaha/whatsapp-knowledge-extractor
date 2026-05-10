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
// Types (will be expanded in later sprints)
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
// Chat endpoints (Sprint 1+)
// ---------------------------------------------------------------------------

export async function getChats(): Promise<Chat[]> {
  return apiFetch("/api/chats");
}

export async function getChat(id: number): Promise<Chat> {
  return apiFetch(`/api/chats/${id}`);
}

export async function getChatMessages(
  chatId: number,
  page = 1,
  perPage = 50
): Promise<PaginatedResponse<Message>> {
  return apiFetch(`/api/chats/${chatId}/messages?page=${page}&per_page=${perPage}`);
}

// ---------------------------------------------------------------------------
// Upload (Sprint 1+)
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
