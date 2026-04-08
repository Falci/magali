import { createAuthClient } from 'better-auth/react';

const authBaseUrl =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env.BETTER_AUTH_URL ?? 'http://localhost:3000');

export const authClient = createAuthClient({
  baseURL: authBaseUrl,
});

export const { signIn, signOut, signUp, useSession } = authClient;
