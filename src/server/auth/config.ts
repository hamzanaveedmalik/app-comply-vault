import { PrismaAdapter } from "@auth/prisma-adapter";
import { type DefaultSession, type NextAuthConfig } from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
export const authConfig = {
  providers: [
    // GoogleProvider - Primary authentication provider
    // Requires AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET
    GoogleProvider({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      allowDangerousEmailAccountLinking: true, // Allow linking accounts with same email
    }),
  ],
  adapter: PrismaAdapter(db),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
    updateAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production", // HTTPS-only in production
      },
    },
  },
  callbacks: {
    signIn: async ({ user, account }) => {
      // Allow sign-in - account linking will be handled by allowDangerousEmailAccountLinking
      // or manually if needed
      return true;
    },
    session: async ({ session, user }) => {
      // Fetch user's primary workspace and role
      // Priority: 1) First OWNER_CCO workspace, 2) First workspace alphabetically
      const userWorkspace = await db.userWorkspace.findFirst({
        where: {
          userId: user.id,
        },
        orderBy: [
          { role: "asc" }, // OWNER_CCO comes before MEMBER alphabetically
          { workspace: { name: "asc" } }, // Then by workspace name
        ],
        include: {
          workspace: true,
        },
      });

      // If user has no workspace, return session without workspaceId/role
      // This allows them to create a workspace
      if (!userWorkspace) {
        return {
          ...session,
          user: {
            ...session.user,
            id: user.id,
            workspaceId: "",
            role: "MEMBER" as const, // Default role, will be updated when workspace is created
          },
        };
      }

      return {
      ...session,
      user: {
        ...session.user,
        id: user.id,
          workspaceId: userWorkspace.workspaceId,
          role: userWorkspace.role,
        },
      };
      },
  },
} satisfies NextAuthConfig;
