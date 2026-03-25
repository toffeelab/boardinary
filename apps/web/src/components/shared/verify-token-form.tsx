"use client";

import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface VerifyTokenFormProps {
  email: string;
}

export function VerifyTokenForm({ email }: VerifyTokenFormProps) {
  return (
    <form method="GET" action="/api/auth/callback/resend" className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="callbackUrl" value="/dashboard" />
      <div className="space-y-2">
        <Label
          htmlFor="token"
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          <KeyRound className="h-3.5 w-3.5" />
          인증 코드
        </Label>
        <Input
          id="token"
          name="token"
          type="text"
          placeholder="이메일의 인증 코드를 붙여넣으세요"
          required
          autoComplete="off"
          className="h-11 font-mono text-center tracking-wider"
        />
      </div>
      <Button type="submit" className="w-full">
        인증하기
      </Button>
    </form>
  );
}
