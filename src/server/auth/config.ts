import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { db } from "~/server/db";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      workspaceId: string | null;
      role: "OWNER_CCO" | "MEMBER" | null;
    } & DefaultSession["user"];
  }

  // interface User {
  //   // ...other properties
  //   // role: UserRole;
  // }
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */
// Build providers array
const providers = [];

// Add Credentials Provider for email/password authentication
providers.push(
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        return null;
      }

      // Find user by email
      const user = await db.user.findUnique({
        where: { email: credentials.email as string },
      });

      if (!user) {
        return null;
      }

      // Check if user has a password (stored in Account table for credentials provider)
      const account = await db.account.findFirst({
        where: {
          userId: user.id,
          provider: "credentials",
        },
      });

      if (!account || !account.access_token) {
        return null;
      }

      // Verify password (password hash is stored in access_token field)
      const isValid = await bcrypt.compare(
        credentials.password as string,
        account.access_token,
      );

      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      };
    },
  }),
);

// Add Google Provider if credentials are available
if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
  );
} else {
  // Log warning but don't throw - NextAuth will handle the Configuration error
  if (typeof window === "undefined") {
    // Only log on server side
    console.warn(
      "⚠️ AUTH_GOOGLE_ID or AUTH_GOOGLE_SECRET is missing. Google OAuth will not work.",
    );
  }
}

export const authConfig = {
  providers,
  // Use PrismaAdapter for OAuth providers, but credentials provider needs JWT strategy
  adapter: PrismaAdapter(db),
  session: {
    // Use JWT strategy to support credentials provider
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    // Use Auth.js v5 default names; add domain for complyvault.co so session cookie
    // is shared across subdomains and readable in Edge middleware (fixes redirect loop).
    sessionToken: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.session-token"
          : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        ...(process.env.NODE_ENV === "production" &&
        (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").includes("complyvault.co")
          ? { domain: ".complyvault.co" }
          : {}),
      },
    },
    // Explicit pkceCodeVerifier config fixes InvalidCheck on Vercel/serverless and
    // browser-specific issues (e.g. Brave on macOS). Domain with leading dot
    // enables cookie sharing across subdomains (app.complyvault.co, complyvault.co).
    pkceCodeVerifier: {
      name:
        process.env.NODE_ENV === "production"
          ? "__Secure-authjs.pkce.code_verifier"
          : "authjs.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        ...(process.env.NODE_ENV === "production" &&
        (process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").includes("complyvault.co")
          ? { domain: ".complyvault.co" }
          : {}),
      },
    },
  },
  callbacks: {
    signIn: async ({ user, account }) => {
      // For OAuth providers (Google, etc.), automatically verify email
      // since the OAuth provider has already verified it
      if (account?.provider !== "credentials" && user.email) {
        // Update user to mark email as verified
        await db.user.update({
          where: { email: user.email },
          data: {
            emailVerified: new Date(),
          },
        });
      }
      // Allow sign-in - account linking will be handled by allowDangerousEmailAccountLinking
      // or manually if needed
      return true;
    },
    session: async ({ session, token }) => {
      // For JWT strategy, user data comes from token
      const userId = token.sub as string | undefined;
      
      // Update session with token data
      if (token.email) {
        session.user.email = token.email as string;
      }
      if (token.name) {
        session.user.name = token.name as string;
      }
      if (token.picture) {
        session.user.image = token.picture as string;
      }
      
      if (!userId) {
        return session;
      }

      // Fetch user's primary workspace and role
      // Priority: 1) First OWNER_CCO workspace, 2) First workspace alphabetically
      const userWorkspace = await db.userWorkspace.findFirst({
        where: {
          userId: userId,
        },
        orderBy: [
          { role: "asc" }, // OWNER_CCO comes before MEMBER alphabetically
          { workspace: { name: "asc" } }, // Then by workspace name
        ],
        include: {
          workspace: true,
        },
      });

      // If user has no workspace, return session with null workspaceId/role
      // This allows them to create a workspace
      if (!userWorkspace) {
        return {
          ...session,
          user: {
            ...session.user,
            id: userId,
            workspaceId: null,
            role: null,
          },
        };
      }

      return {
        ...session,
        user: {
          ...session.user,
          id: userId,
          workspaceId: userWorkspace.workspaceId,
          role: userWorkspace.role,
        },
      };
    },
    jwt: async ({ token, user, account }) => {
      // For credentials provider, store user id in token
      if (user) {
        token.sub = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      return token;
    },
  },
} satisfies NextAuthConfig;
