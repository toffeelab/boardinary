"use client";

import { useActionState } from "react";
import { useEffect } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyTokenAction } from "@/actions/verify-token-action";

type ActionResult = { redirectUrl: string } | { error: string } | null;

export function VerifyTokenForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: ActionResult, formData: FormData): Promise<ActionResult> => {
      return verifyTokenAction(formData);
    },
    null,
  );

  useEffect(() => {
    if (state && "redirectUrl" in state) {
      window.location.href = state.redirectUrl;
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-3">
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
          disabled={isPending}
          className="h-11 font-mono text-center tracking-wider"
        />
      </div>
      {state && "error" in state && (
        <p className="text-center text-sm text-destructive">{state.error}</p>
      )}
      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            인증 중...
          </>
        ) : (
          "인증하기"
        )}
      </Button>
    </form>
  );
}
