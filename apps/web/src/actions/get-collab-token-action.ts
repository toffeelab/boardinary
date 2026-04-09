"use server";

import { auth } from "@/auth";
import { createHmac } from "crypto";
import type { CollabTokenPayload } from "@repo/types";

export async function getCollabTokenAction(): Promise<
  { token: string } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Unauthorized" };
  }

  const secret = process.env.INTERNAL_API_SECRET ?? "";
  const payload: CollabTokenPayload = {
    userId: session.user.id,
    name: session.user.name ?? session.user.email ?? "Unknown",
    exp: Date.now() + 24 * 60 * 60_000, // 24시간 유효 (dev)
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("hex");

  return { token: `${payloadB64}.${sig}` };
}
