import NextAuth, { type NextAuthResult } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Resend from "next-auth/providers/resend";
import { Resend as ResendClient } from "resend";
import {
  db,
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@repo/db/auth";
import authConfig from "./auth.config";
import {
  magicLinkEmailHtml,
  magicLinkEmailText,
} from "@/lib/magic-link-email";

const API_URL = process.env.API_URL ?? "http://localhost:4001";
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET ?? "";

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
      async sendVerificationRequest({ identifier: email, url, provider }) {
        // URL에서 토큰 추출 (다른 브라우저에서 수동 입력용)
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get("token") ?? "";

        const resend = new ResendClient(process.env.AUTH_RESEND_KEY!);
        await resend.emails.send({
          from: provider.from!,
          to: email,
          subject: "Boardinary 로그인 링크",
          html: magicLinkEmailHtml(url, token),
          text: magicLinkEmailText(url, token),
        });
      },
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

      const setupPayload = {
        userId: user.id,
        name: user.name ?? null,
      };
      const headers = {
        "Content-Type": "application/json",
        "X-Internal-Secret": INTERNAL_SECRET,
        "X-User-Id": user.id,
      };

      // 최대 3회 재시도 (API 서버 시작 타이밍 이슈 대비)
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`${API_URL}/api/users/setup`, {
            method: "POST",
            headers,
            body: JSON.stringify(setupPayload),
          });
          if (res.ok) return;
        } catch {
          // 재시도
        }
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
      // 3회 실패 — 다음 로그인 시 대시보드에서 lazy init으로 처리 가능
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
