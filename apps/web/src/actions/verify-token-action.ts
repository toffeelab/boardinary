"use server";

import { cookies } from "next/headers";

export async function verifyTokenAction(formData: FormData) {
  const token = (formData.get("token") as string)?.trim();
  const cookieStore = await cookies();
  const email = cookieStore.get("verify-email")?.value;

  if (!token || !email) {
    return { error: "인증 코드 또는 이메일 정보가 없습니다." };
  }

  const callbackUrl = new URL(
    "/api/auth/callback/resend",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000",
  );
  callbackUrl.searchParams.set("token", token);
  callbackUrl.searchParams.set("email", email);
  callbackUrl.searchParams.set("callbackUrl", "/dashboard");

  cookieStore.delete("verify-email");

  // redirect() 대신 URL을 반환 — 클라이언트에서 window.location.href로 이동해야
  // Auth.js 콜백이 Set-Cookie를 정상적으로 설정할 수 있음
  return { redirectUrl: callbackUrl.toString() };
}
