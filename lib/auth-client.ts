import { createAuthClient } from 'better-auth/react';

// BETTER_AUTH_URL is a runtime env var (no NEXT_PUBLIC_ prefix).
// - Server bundle: Next.js leaves process.env references intact → reads the real URL at runtime.
// - Client bundle: Next.js replaces non-NEXT_PUBLIC_ env vars with `undefined` at build time.
//   When baseURL is undefined, better-auth falls back to window.location.origin in the browser.
export const authClient = createAuthClient({
  baseURL: process.env.BETTER_AUTH_URL,
});

export const { signIn, signOut, signUp, useSession } = authClient;
