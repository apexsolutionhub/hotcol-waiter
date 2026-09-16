"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { changePasskey } from "@/lib/api";
import { cn } from "@/lib/utils";

export function ChangeWaiterPasskeyButton({
  className,
  variant = "ghost",
  size = "icon",
}: {
  className?: string;
  variant?: "ghost" | "outline" | "secondary";
  size?: "icon" | "sm" | "default";
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [currentPasskey, setCurrent] = useState("");
  const [newPasskey, setNew] = useState("");
  const [confirmPasskey, setConfirm] = useState("");

  const reset = () => {
    setCurrent("");
    setNew("");
    setConfirm("");
  };

  const ready =
    /^\d{6}$/.test(currentPasskey) &&
    /^\d{6}$/.test(newPasskey) &&
    newPasskey === confirmPasskey;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn("shrink-0 border-white/15 bg-white/5 hover:bg-white/10", className)}
          title="Change passkey"
          aria-label="Change passkey"
        >
          <KeyRound className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change your passkey</DialogTitle>
          <DialogDescription>
            Enter your current 6-digit passkey, then choose a new one. Only you
            can update your HotCol Waiter login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label>Current passkey</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={currentPasskey}
                onChange={setCurrent}
                containerClassName="gap-2"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPGroup key={i}>
                    <InputOTPSlot index={i} className="h-11 w-9" />
                  </InputOTPGroup>
                ))}
              </InputOTP>
            </div>
          </div>
          <div className="space-y-2">
            <Label>New passkey</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={newPasskey}
                onChange={setNew}
                containerClassName="gap-2"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPGroup key={i}>
                    <InputOTPSlot index={i} className="h-11 w-9" />
                  </InputOTPGroup>
                ))}
              </InputOTP>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Confirm new passkey</Label>
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={confirmPasskey}
                onChange={setConfirm}
                containerClassName="gap-2"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <InputOTPGroup key={i}>
                    <InputOTPSlot index={i} className="h-11 w-9" />
                  </InputOTPGroup>
                ))}
              </InputOTP>
            </div>
            {confirmPasskey.length === 6 && newPasskey !== confirmPasskey ? (
              <p className="text-center text-xs text-destructive">
                Passkeys do not match
              </p>
            ) : null}
          </div>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!ready || pending}
            onClick={async () => {
              setPending(true);
              try {
                await changePasskey(currentPasskey, newPasskey);
                toast.success("Passkey updated");
                reset();
                setOpen(false);
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Update failed",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Updating…" : "Update passkey"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
