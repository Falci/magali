import { createAuthClient } from 'better-auth/react';

// Next.js statically replaces `typeof window` in each bundle:
//   server bundle → 'undefined' === 'undefined' → true  → use BETTER_AUTH_URL env var
//   client bundle → 'object'   === 'undefined' → false → use window.location.origin
//
// This prevents better-auth from freezing "http://localhost:3000" into the
// client object when the module is first evaluated server-side during SSR.
const baseURL =
  typeof window === 'undefined'
    ? (process.env.BETTER_AUTH_URL ?? 'http://localhost:3000')
    : window.location.origin;

export const authClient = createAuthClient({ baseURL });

export const { signIn, signOut, signUp, useSession } = authClient;
