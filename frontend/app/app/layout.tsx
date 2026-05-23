"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  MessageSquareText,
  Upload,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  ChevronRight,
  LogIn,
  LogOut,
} from "lucide-react";
import { useAppStore } from "@/lib/store";
import { getChats, type Chat } from "@/lib/api";
import { SAMPLE_CHAT_ID } from "@/lib/sample-chat";

// ---------------------------------------------------------------------------
// Sidebar chat item
// ---------------------------------------------------------------------------

function ChatItem({ chat, isActive, onClick }: { chat: Chat; isActive: boolean; onClick?: () => void }) {
  const statusColor =
    chat.status === "ready"
      ? "bg-emerald-400"
      : chat.status === "processing"
        ? "bg-amber-400 animate-pulse"
        : "bg-red-400";

  return (
    <Link href={`/app/chats/${chat.id}`} onClick={onClick}>
      <motion.div
        whileHover={{ x: 3 }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-200 ${
          isActive
            ? "bg-white/10 border border-white/10"
            : "hover:bg-white/5"
        }`}
      >
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <MessageSquareText className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{chat.name}</p>
          <p className="text-xs text-muted-foreground">
            {chat.message_count.toLocaleString()} messages
          </p>
        </div>
        <div className={`w-2 h-2 rounded-full ${statusColor}`} />
      </motion.div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// App Layout
// ---------------------------------------------------------------------------

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus } = useSession();
  const isAuthed = sessionStatus === "authenticated";
  const {
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    theme,
    toggleTheme,
    chats,
    setChats,
  } = useAppStore();

  // On mobile (<md), the sidebar is a full-screen overlay. After the user
  // navigates to a new page via a sidebar link, auto-close so they can see
  // the content. On desktop the sidebar stays put.
  const closeSidebarOnMobile = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
    }
  }, [setSidebarOpen]);

  const [loading, setLoading] = useState(true);

  // Extract current chat ID from URL
  const chatIdMatch = pathname.match(/\/app\/chats\/(\d+)/);
  const currentChatId = chatIdMatch ? parseInt(chatIdMatch[1]) : null;

  // Fetch chats for sidebar — getChats() prepends the demo chat regardless
  // of auth state, and silently swallows backend errors for signed-out
  // users (the backend rejects them with 401).
  const fetchChats = useCallback(async () => {
    try {
      const data = await getChats();
      setChats(data);
    } catch {
      // Backend may not be running yet, or the user is signed out.
    } finally {
      setLoading(false);
    }
  }, [setChats]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats, isAuthed]);

  // Nav items hidden when signed out — the only thing visitors can see
  // under /app is the demo chat (linked from the chat list itself).
  const navItems = isAuthed
    ? [
        { href: "/app/upload", icon: Upload, label: "Upload" },
        { href: "/app/chats", icon: LayoutDashboard, label: "All Chats" },
      ]
    : [];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ===== SIDEBAR =====
          On mobile (<md): full-screen overlay with translateX animation,
          dark backdrop behind it. On md+: classic 280px column with width
          animation. */}
      <AnimatePresence mode="wait">
        {sidebarOpen && (
          <>
            {/* Mobile backdrop — tapping outside the sidebar closes it. */}
            <motion.button
              type="button"
              aria-label="Close sidebar"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={toggleSidebar}
              className="md:hidden fixed inset-0 z-30 bg-black/60 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="fixed md:relative inset-y-0 left-0 z-40 w-full sm:w-[320px] md:w-[280px] flex-shrink-0 border-r border-white/5 bg-card/90 md:bg-card/50 backdrop-blur-xl overflow-hidden"
            >
            <div className="flex flex-col h-full w-full md:w-[280px]">
              {/* Logo */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4">
                <Link href="/" className="flex items-center gap-2.5 min-w-0">
                  <img
                    src="/whatsapp-knowledge-extractor-logo.png"
                    alt="WhatsApp Knowledge Extractor"
                    className="h-[50px] w-auto"
                  />
                </Link>
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 transition-colors"
                  aria-label="Close sidebar"
                >
                  <PanelLeftClose className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {/* Nav items */}
              <div className="px-3 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} onClick={closeSidebarOnMobile}>
                      <div
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors duration-200 ${
                          isActive
                            ? "bg-white/10 font-medium"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        }`}
                      >
                        <item.icon className="w-4 h-4" />
                        {item.label}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="mx-5 my-4 border-t border-white/5" />

              {/* Chat list */}
              <div className="flex-1 overflow-y-auto custom-scrollbar px-3">
                <div className="flex items-center justify-between px-3 mb-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Chats
                  </h3>
                  {chats.length > 0 && (
                    <span className="text-xs text-muted-foreground/60">
                      {chats.length}
                    </span>
                  )}
                </div>

                {loading ? (
                  <div className="space-y-2 px-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-xl bg-white/3 animate-pulse" />
                    ))}
                  </div>
                ) : chats.length === 0 ? (
                  <div className="px-3 py-4 text-center">
                    <p className="text-xs text-muted-foreground">No chats yet</p>
                    {isAuthed ? (
                      <Link
                        href="/app/upload"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Upload your first chat
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    ) : (
                      <button
                        onClick={() => signIn("google", { callbackUrl: "/app/upload" })}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        Sign in to upload a chat
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      visible: { transition: { staggerChildren: 0.04 } },
                    }}
                    className="space-y-1"
                  >
                    {chats.map((chat) => (
                      <motion.div
                        key={chat.id}
                        variants={{
                          hidden: { opacity: 0, x: -10 },
                          visible: { opacity: 1, x: 0 },
                        }}
                      >
                        <ChatItem
                          chat={chat}
                          isActive={currentChatId === chat.id}
                          onClick={closeSidebarOnMobile}
                        />
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </div>

              {/* Bottom */}
              <div className="px-3 py-3 border-t border-white/5 space-y-1">
                {isAuthed ? (
                  <>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/3">
                      {session?.user?.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={session.user.image}
                          alt={session.user.name ?? "Account"}
                          className="w-7 h-7 rounded-full"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-blue-500/20" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">
                          {session?.user?.name ?? "Signed in"}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {session?.user?.email ?? ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => signOut({ callbackUrl: "/" })}
                      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => signIn("google", { callbackUrl: "/app/chats" })}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium bg-white text-black hover:bg-white/90 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign in with Google
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-3 sm:px-5 py-3 border-b border-white/5 bg-card/30 backdrop-blur-md">
          {!sidebarOpen && (
            <button
              onClick={toggleSidebar}
              className="flex-shrink-0 p-2 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 hover:border-blue-500/50 active:bg-blue-500/35 transition-colors"
              aria-label="Open sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          )}

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0 overflow-hidden">
            <Link href="/app/chats" className="hover:text-foreground transition-colors flex-shrink-0">
              Dashboard
            </Link>
            {pathname !== "/app/chats" && pathname !== "/app/upload" && (
              <>
                <ChevronRight className="w-3 h-3" />
                {currentChatId ? (
                  <Link
                    href={`/app/chats/${currentChatId}`}
                    className="hover:text-foreground transition-colors truncate max-w-[40vw] sm:max-w-none"
                  >
                    {chats.find((c) => c.id === currentChatId)?.name || `Chat ${currentChatId}`}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">
                    {pathname.includes("/upload") ? "Upload" : ""}
                  </span>
                )}
                {/* Sub-page crumb (links, images, videos, docs, important) */}
                {currentChatId && (() => {
                  const subPageMatch = pathname.match(/\/chats\/\d+\/(links|images|videos|docs|important)/);
                  if (subPageMatch) {
                    const subPage = subPageMatch[1];
                    const labels: Record<string, string> = {
                      links: "Links",
                      images: "Images",
                      videos: "Videos",
                      docs: "Documents",
                      important: "Important",
                    };
                    return (
                      <>
                        <ChevronRight className="w-3 h-3" />
                        <span className="text-foreground font-medium">
                          {labels[subPage] || subPage}
                        </span>
                      </>
                    );
                  }
                  return null;
                })()}
              </>
            )}
          </div>
        </header>

        {/* Page content with transitions */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
