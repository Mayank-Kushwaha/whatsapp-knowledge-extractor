/**
 * Route protection for /app/* with a public exception for the demo chat.
 *
 * In Next.js 16 this file convention was renamed from `middleware.ts`
 * to `proxy.ts`. The behaviour is identical: it runs before requests
 * matching the `matcher` and can redirect or pass through.
 *
 * Unauthenticated requests to anything under /app are redirected to the
 * NextAuth sign-in page. /app/chats/0 and any sub-route of it remain
 * public so the landing page can preview the dashboard without forcing
 * sign-in.
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

const PUBLIC_APP_PATHS = [
  /^\/app\/chats\/0$/,
  /^\/app\/chats\/0\/.*$/,
];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  // Allow the demo chat without auth.
  if (PUBLIC_APP_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  // Allow signed-in users through.
  if (req.auth) return NextResponse.next();

  // Redirect everyone else to the NextAuth sign-in page with a callback
  // back to the requested URL so they land where they intended.
  const callbackUrl = encodeURIComponent(pathname + search);
  const signInUrl = new URL(
    `/api/auth/signin?callbackUrl=${callbackUrl}`,
    req.nextUrl.origin
  );
  return NextResponse.redirect(signInUrl);
});

export const config = {
  // Only run on /app/* — the landing page (/) and NextAuth endpoints
  // (/api/auth/*) are public and must not pass through here.
  matcher: ["/app/:path*"],
};
