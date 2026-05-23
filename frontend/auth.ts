/**
 * NextAuth v5 (Auth.js) configuration.
 *
 * Google is the only sign-in provider. The Google ID token issued at
 * sign-in time is captured in the `jwt` callback and surfaced to the
 * browser via the `session` callback as `session.idToken`. The frontend
 * forwards that token to the FastAPI backend as `Authorization: Bearer
 * <idToken>`; the backend verifies it against Google's JWKS and uses
 * the `sub` claim as the chat owner identifier.
 *
 * Token lifetime: Google ID tokens are valid for ~1 hour. We store the
 * refresh_token (requested via access_type=offline) alongside the
 * id_token in the session JWT, and rotate them in the jwt() callback
 * whenever the cached id_token is within 60s of expiry. The user stays
 * signed in indefinitely (until they sign out or revoke access on
 * Google's side).
 *
 * Required env vars (set in Vercel dashboard):
 *   AUTH_SECRET        - random 32+ char string
 *   AUTH_URL           - https://<production-domain>
 *   AUTH_TRUST_HOST    - true
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 */

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Exchange a Google refresh_token for a fresh access_token + id_token.
 * Returns the new token claims to merge into the NextAuth JWT, or marks
 * the JWT as errored if refresh fails (which causes the next backend
 * call to 401 and the UI to redirect to sign-in).
 */
async function refreshGoogleToken(
  refreshToken: string
): Promise<{ idToken?: string; expiresAt?: number; refreshToken?: string; error?: string }> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    const payload = (await res.json()) as {
      id_token?: string;
      access_token?: string;
      expires_in?: number;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok || !payload.id_token) {
      return { error: payload.error || `refresh_failed_${res.status}` };
    }

    return {
      idToken: payload.id_token,
      expiresAt: Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600),
      // Google may rotate the refresh_token; keep the old one if absent.
      refreshToken: payload.refresh_token,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "refresh_threw" };
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      // Auth.js v5 defaults to reading AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET
      // from env. We pass these explicitly so the existing GOOGLE_CLIENT_ID
      // / GOOGLE_CLIENT_SECRET env vars (also used by the backend's token
      // verification) work without renaming.
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          // `consent` forces Google to re-issue a refresh_token even if
          // the user previously authorised the app — without this, a
          // returning user gets no refresh_token and we can't rotate.
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Phase 1 — initial sign-in. `account` is only set on the first
      // invocation right after the OAuth callback.
      if (account?.id_token) {
        token.idToken = account.id_token;
        token.refreshToken = account.refresh_token;
        token.idTokenExpiresAt = account.expires_at; // unix seconds
        return token;
      }

      // Phase 2 — subsequent calls. Refresh the id_token if it's about
      // to expire (within 60s) and we have a refresh_token.
      const expiresAt = token.idTokenExpiresAt as number | undefined;
      const refreshToken = token.refreshToken as string | undefined;
      const nowSec = Math.floor(Date.now() / 1000);

      if (!expiresAt || nowSec < expiresAt - 60) {
        // Still valid for >60s — return cached token.
        return token;
      }

      if (!refreshToken) {
        // No refresh token available (Google didn't issue one). User
        // will need to sign in again next time the backend rejects the
        // expired id_token.
        token.error = "no_refresh_token";
        return token;
      }

      const refreshed = await refreshGoogleToken(refreshToken);
      if (refreshed.error || !refreshed.idToken) {
        token.error = refreshed.error || "refresh_failed";
        return token;
      }

      token.idToken = refreshed.idToken;
      token.idTokenExpiresAt = refreshed.expiresAt;
      if (refreshed.refreshToken) token.refreshToken = refreshed.refreshToken;
      delete token.error;
      return token;
    },
    async session({ session, token }) {
      // Surface the (possibly refreshed) id_token to the client.
      const t = token as { idToken?: string; error?: string };
      (session as unknown as { idToken?: string; error?: string }).idToken = t.idToken;
      (session as unknown as { idToken?: string; error?: string }).error = t.error;
      return session;
    },
  },
});
