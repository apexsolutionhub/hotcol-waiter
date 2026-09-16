"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Store } from "lucide-react";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import { getWaiterToken, waiterLogin } from "@/lib/api";

export default function WaiterLoginPage() {
  const router = useRouter();
  const [passkey, setPasskey] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (getWaiterToken()) router.replace("/portal");
  }, [router]);

  const ready = useMemo(() => /^\d{6}$/.test(passkey), [passkey]);

  const onSubmit = async () => {
    if (!ready) return;
    setPending(true);
    try {
      const { waiter } = await waiterLogin(passkey);
      toast.success(`Welcome, ${waiter.name}`);
      router.replace("/portal");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-svh w-full bg-muted/40 text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center p-4 md:p-6">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background shadow-lg ring-1 ring-black/5 dark:ring-white/10">
          <header className="app-chrome-header flex h-16 items-center gap-3 border-b px-5 md:px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <Store className="h-4 w-4 text-[#d4b896]" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#d4b896]/70">
                HotCol Waiter
              </p>
              <h1 className="truncate text-sm font-semibold tracking-tight md:text-base">
                Floor terminal
              </h1>
            </div>
          </header>

          <div className="space-y-6 p-6 md:p-8">
            <div className="space-y-2">
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-tight md:text-3xl">
                Sign in
              </h2>
              <p className="text-sm text-muted-foreground">
                Enter your 6-digit passkey to open the menu and manage your
                tables.
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border bg-muted/20 p-5">
              <div className="flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4 text-primary" />
                Passkey
              </div>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={passkey}
                  onChange={setPasskey}
                  containerClassName="gap-2"
                >
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPGroup key={i}>
                      <InputOTPSlot
                        index={i}
                        className="h-12 w-10 text-lg"
                      />
                    </InputOTPGroup>
                  ))}
                </InputOTP>
              </div>
              <Button
                className="h-11 w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!ready || pending}
                onClick={() => void onSubmit()}
              >
                {pending ? "Signing in…" : "Enter floor"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
