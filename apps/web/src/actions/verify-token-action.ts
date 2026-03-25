"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function verifyTokenAction(formData: FormData) {
  const token = (formData.get("token") as string)?.trim();
  const cookieStore = await cookies();
  const email = cookieStore.get("verify-email")?.value;

  if (!token || !email) {
    redirect("/login/verify");
  }

  const callbackUrl = new URL(
    "/api/auth/callback/resend",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:4000",
  );
  callbackUrl.searchParams.set("token", token);
  callbackUrl.searchParams.set("email", email);
  callbackUrl.searchParams.set("callbackUrl", "/dashboard");

  cookieStore.delete("verify-email");
  redirect(callbackUrl.toString());
}
