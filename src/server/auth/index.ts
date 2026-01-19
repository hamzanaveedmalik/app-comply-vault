import NextAuth from "next-auth";
import { cache } from "react";

import { authConfig } from "./config";

// Use AUTH_URL if set, otherwise fall back to NEXT_PUBLIC_APP_URL
// This ensures NextAuth uses the correct base URL for redirect URIs
const baseUrl = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

// NextAuth will validate AUTH_SECRET and providers internally
// We just need to ensure trustHost is set for custom domains
const { auth: uncachedAuth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  // Explicitly set trustHost to true for custom domains
  trustHost: true,
});

const auth = cache(uncachedAuth);

export { auth, handlers, signIn, signOut };
