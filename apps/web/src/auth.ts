import NextAuth, { type NextAuthResult } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
  organizations,
  orgMembers,
} from "@/db/schema";
import authConfig from "./auth.config";

const nextAuth = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Resend({
      from: process.env.AUTH_EMAIL_FROM ?? "noreply@boardinary.com",
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      const slug =
        user.name?.toLowerCase().replace(/\s+/g, "-") ??
        `user-${user.id.slice(0, 8)}`;
      try {
        await db.transaction(async (tx) => {
          let [org] = await tx
            .insert(organizations)
            .values({
              name: `${user.name ?? "내"}의 워크스페이스`,
              slug: `${slug}-${user.id!.slice(0, 6)}`,
              ownerId: user.id!,
              isPersonal: true,
            })
            .onConflictDoNothing()
            .returning();

          if (!org) {
            [org] = await tx
              .select()
              .from(organizations)
              .where(
                and(
                  eq(organizations.ownerId, user.id!),
                  eq(organizations.isPersonal, true),
                ),
              )
              .limit(1);
          }

          if (org) {
            await tx
              .insert(orgMembers)
              .values({ orgId: org.id, userId: user.id!, role: "owner" })
              .onConflictDoNothing();
          }
        });
      } catch {
        // Prevent app crash on unexpected errors
      }
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
