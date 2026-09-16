"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Banknote,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  ShoppingBag,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isSameCafeBusinessDay } from "@/lib/cafeBusinessDay";
import { cn } from "@/lib/utils";

type OrderRow = {
  id: number;
  title: string;
  imageUrl: string;
  tableNo: number;
  orderAmount: number;
  category: string;
  type: string;
  price: number;
  status?: string | null;
  payment?: string | null;
  paymentApprovalRequestId?: number | null;
  createdAt: string;
};

function isOpenToday(order: OrderRow) {
  if (String(order.payment || "").toLowerCase() === "paid") return false;
  const status = String(order.status || "").toLowerCase();
  if (status === "cancelled" || status === "failed") return false;
  return isSameCafeBusinessDay(order.createdAt);
}

function isReadyForPaymentApproval(order: OrderRow) {
  if (!isOpenToday(order)) return false;
  return String(order.status || "").toLowerCase() === "completed";
}

function formatETB(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function WaiterPaymentPanel({
  orders,
  approvalEnabled,
  busy,
  selectedOrderIds,
  onSelectedOrderIdsChange,
  payMethod,
  onPayMethodChange,
  payAmount,
  onPayAmountChange,
  payFullyPaid,
  onPayFullyPaidChange,
  payNote,
  onPayNoteChange,
  onSubmit,
}: {
  orders: OrderRow[];
  approvalEnabled: boolean;
  busy: boolean;
  selectedOrderIds: number[];
  onSelectedOrderIdsChange: (ids: number[]) => void;
  payMethod: string;
  onPayMethodChange: (method: string) => void;
  payAmount: string;
  onPayAmountChange: (amount: string) => void;
  payFullyPaid: boolean;
  onPayFullyPaidChange: (fullyPaid: boolean) => void;
  payNote: string;
  onPayNoteChange: (note: string) => void;
  onSubmit: () => void;
}) {
  const unpaid = useMemo(() => orders.filter(isOpenToday), [orders]);
  const ready = useMemo(
    () => unpaid.filter(isReadyForPaymentApproval),
    [unpaid],
  );
  const waitingCount = unpaid.length - ready.length;

  const groups = useMemo(() => {
    const map = new Map<number, OrderRow[]>();
    for (const o of ready) {
      const list = map.get(o.tableNo) ?? [];
      list.push(o);
      map.set(o.tableNo, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tableNo, lines]) => {
        const sorted = [...lines].sort((a, b) => b.id - a.id);
        const total = sorted.reduce(
          (sum, o) => sum + Number(o.price) * Number(o.orderAmount),
          0,
        );
        const selectable = sorted.filter((o) => !o.paymentApprovalRequestId);
        const allSelected =
          selectable.length > 0 &&
          selectable.every((o) => selectedOrderIds.includes(o.id));
        return { tableNo, lines: sorted, total, selectable, allSelected };
      });
  }, [ready, selectedOrderIds]);

  const selectedLines = useMemo(
    () => ready.filter((o) => selectedOrderIds.includes(o.id)),
    [ready, selectedOrderIds],
  );
  const selectedTotal = selectedLines.reduce(
    (sum, o) => sum + Number(o.price) * Number(o.orderAmount),
    0,
  );
  const selectedUnits = selectedLines.reduce(
    (n, o) => n + Number(o.orderAmount || 0),
    0,
  );

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const primaryIsBank = payMethod.toLowerCase() === "bank";
  const primaryLabel = primaryIsBank ? "Bank" : "Cash";
  const otherLabel = primaryIsBank ? "Cash" : "Bank";

  const parsedPrimary = useMemo(() => {
    const value = Number(String(payAmount).replace(/,/g, "").trim());
    return Number.isFinite(value) ? value : NaN;
  }, [payAmount]);

  const effectivePrimary = useMemo(() => {
    if (payFullyPaid) return selectedTotal;
    if (!Number.isFinite(parsedPrimary)) return 0;
    return Math.min(Math.max(0, parsedPrimary), selectedTotal);
  }, [payFullyPaid, parsedPrimary, selectedTotal]);

  const remainderAmount = useMemo(
    () => Math.max(0, selectedTotal - effectivePrimary),
    [selectedTotal, effectivePrimary],
  );

  useEffect(() => {
    if (payFullyPaid && selectedTotal > 0) {
      onPayAmountChange(selectedTotal.toFixed(2));
    }
  }, [payFullyPaid, selectedTotal, onPayAmountChange]);

  const toggleLine = (id: number, checked: boolean) => {
    onSelectedOrderIdsChange(
      checked
        ? [...selectedOrderIds, id]
        : selectedOrderIds.filter((x) => x !== id),
    );
  };

  const toggleTable = (group: (typeof groups)[number], checked: boolean) => {
    const ids = group.selectable.map((o) => o.id);
    if (checked) {
      onSelectedOrderIdsChange([
        ...new Set([...selectedOrderIds, ...ids]),
      ]);
    } else {
      const drop = new Set(ids);
      onSelectedOrderIdsChange(selectedOrderIds.filter((id) => !drop.has(id)));
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Wallet className="h-4 w-4" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          Payment approval
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Select kitchen/bar completed lines, enter what the guest paid, then
          send the request to cashier. Pending station tickets stay under My
          orders.
        </p>
      </div>

      {!approvalEnabled ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Ban className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">Payment approval is off</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Ask your manager or admin to enable Waiter payment approval in
                Waiter & tables.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/20 p-3 text-center sm:gap-3 sm:p-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Ready
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {ready.length}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Waiting
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {Math.max(0, waitingCount)}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Selected
              </p>
              <p className="text-lg font-semibold tabular-nums text-primary">
                {selectedTotal.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              {groups.length === 0 ? (
                <div className="rounded-2xl border border-dashed bg-muted/20 py-16 text-center">
                  <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/35" />
                  <p className="text-base font-medium">
                    No completed lines ready
                  </p>
                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    {waitingCount > 0
                      ? `${waitingCount} open line${waitingCount === 1 ? "" : "s"} still waiting on kitchen/bar.`
                      : "When stations mark items Completed, they will appear here."}
                  </p>
                </div>
              ) : (
                groups.map((g) => {
                  const isOpen = expanded[g.tableNo] ?? false;
                  const selectedOnTable = g.lines.filter((o) =>
                    selectedOrderIds.includes(o.id),
                  ).length;
                  return (
                    <Collapsible
                      key={g.tableNo}
                      open={isOpen}
                      onOpenChange={(next) =>
                        setExpanded((prev) => ({
                          ...prev,
                          [g.tableNo]: next,
                        }))
                      }
                    >
                      <Card className="overflow-hidden border-border/70 border-l-4 border-l-emerald-500/70 shadow-sm">
                        <div className="flex items-center gap-2 bg-muted/20 px-3 py-2.5">
                          <Checkbox
                            checked={g.allSelected}
                            disabled={g.selectable.length === 0}
                            onCheckedChange={(v) =>
                              toggleTable(g, v === true)
                            }
                            aria-label={`Select all on table ${g.tableNo}`}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex min-w-0 flex-1 items-center gap-3 text-left hover:opacity-90"
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge
                                    variant="outline"
                                    className="font-mono"
                                  >
                                    Table {g.tableNo}
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="bg-emerald-500/15 text-emerald-300"
                                  >
                                    {g.lines.length} ready
                                  </Badge>
                                  {selectedOnTable > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px]"
                                    >
                                      {selectedOnTable} selected
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {isOpen
                                    ? `${g.selectable.length} available to request`
                                    : "Tap to expand lines"}
                                </p>
                              </div>
                              <p className="shrink-0 text-base font-bold tabular-nums">
                                {g.total.toFixed(2)}{" "}
                                <span className="text-xs font-medium text-muted-foreground">
                                  ETB
                                </span>
                              </p>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                                  isOpen && "rotate-180",
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>
                        </div>

                        <CollapsibleContent>
                          <CardContent className="space-y-2 border-t p-3">
                            {g.lines.map((o) => {
                              const checked = selectedOrderIds.includes(o.id);
                              const locked = Boolean(
                                o.paymentApprovalRequestId,
                              );
                              return (
                                <label
                                  key={o.id}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 transition",
                                    checked &&
                                      "border-primary/45 bg-primary/5 ring-1 ring-primary/15",
                                    locked && "cursor-not-allowed opacity-55",
                                  )}
                                >
                                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                                    {o.imageUrl ? (
                                      <Image
                                        src={o.imageUrl}
                                        alt={o.title}
                                        fill
                                        className="object-cover"
                                        sizes="48px"
                                      />
                                    ) : (
                                      <div className="flex h-full items-center justify-center text-muted-foreground/30">
                                        <ShoppingBag className="h-5 w-5" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold">
                                      {o.title}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      Qty {o.orderAmount} ·{" "}
                                      <span className="font-semibold tabular-nums text-foreground">
                                        {(
                                          Number(o.price) *
                                          Number(o.orderAmount)
                                        ).toFixed(2)}{" "}
                                        ETB
                                      </span>
                                    </p>
                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                      <Badge className="h-5 bg-emerald-500/15 text-[10px] text-emerald-300">
                                        Completed
                                      </Badge>
                                      {locked ? (
                                        <Badge className="h-5 bg-amber-500/15 text-[10px] text-amber-200">
                                          Approval sent
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                  <Checkbox
                                    disabled={locked}
                                    checked={checked}
                                    onCheckedChange={(v) =>
                                      toggleLine(o.id, v === true)
                                    }
                                  />
                                </label>
                              );
                            })}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  );
                })
              )}
            </div>

            <Card className="h-fit border-border/70 shadow-sm lg:sticky lg:top-4">
              <CardHeader className="border-b py-3">
                <p className="font-semibold">Request details</p>
                <p className="text-sm text-muted-foreground">
                  Cashier will approve or dismiss this request.
                </p>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                <div className="flex items-center gap-3 rounded-xl border bg-muted/20 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <Banknote className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {selectedLines.length} line
                      {selectedLines.length === 1 ? "" : "s"} · {selectedUnits}{" "}
                      units
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Selected total{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatETB(selectedTotal)} ETB
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label>Method</Label>
                    <Select
                      value={payMethod}
                      onValueChange={onPayMethodChange}
                    >
                      <SelectTrigger className="h-10 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Bank">Bank</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/15 p-3">
                    <Checkbox
                      checked={payFullyPaid}
                      onCheckedChange={(v) => {
                        const next = v === true;
                        onPayFullyPaidChange(next);
                        if (next && selectedTotal > 0) {
                          onPayAmountChange(selectedTotal.toFixed(2));
                        } else if (!next) {
                          onPayAmountChange("");
                        }
                      }}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Fully paid</p>
                      <p className="text-xs text-muted-foreground">
                        {payFullyPaid
                          ? `Entire ${formatETB(selectedTotal)} ETB via ${primaryLabel}`
                          : `Enter how much was paid by ${primaryLabel}; the rest goes to ${otherLabel}`}
                      </p>
                    </div>
                  </label>

                  <div className="space-y-1.5">
                    <Label>
                      {payFullyPaid ? "Amount paid" : `${primaryLabel} amount`}
                    </Label>
                    {payFullyPaid ? (
                      <div className="flex h-10 items-center rounded-md border bg-muted/30 px-3 text-sm font-semibold tabular-nums">
                        {selectedTotal > 0
                          ? `${formatETB(selectedTotal)} ETB`
                          : "—"}
                      </div>
                    ) : (
                      <>
                        <Input
                          type="number"
                          inputMode="decimal"
                          className="h-10 tabular-nums"
                          value={payAmount}
                          placeholder={
                            selectedTotal > 0
                              ? selectedTotal.toFixed(2)
                              : "0.00"
                          }
                          onChange={(e) => onPayAmountChange(e.target.value)}
                        />
                        <div
                          className={cn(
                            "rounded-xl border px-3 py-2.5",
                            primaryIsBank
                              ? "border-emerald-500/25 bg-emerald-500/10"
                              : "border-sky-500/25 bg-sky-500/10",
                          )}
                        >
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {primaryIsBank ? (
                              <Banknote className="h-3.5 w-3.5" />
                            ) : (
                              <Building2 className="h-3.5 w-3.5" />
                            )}
                            {otherLabel} (auto)
                          </div>
                          <p className="mt-1 text-xl font-bold tabular-nums tracking-tight">
                            {formatETB(remainderAmount)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {remainderAmount < 0.001
                              ? `Full ${primaryLabel} — no remainder`
                              : `${formatETB(remainderAmount)} ETB will go as ${otherLabel}`}
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Note (optional)</Label>
                    <Input
                      className="h-10"
                      value={payNote}
                      onChange={(e) => onPayNoteChange(e.target.value)}
                      placeholder="Message for cashier"
                    />
                  </div>
                </div>

                <Button
                  className="h-11 w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={busy || selectedLines.length === 0}
                  onClick={onSubmit}
                >
                  {busy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Request cashier approval"
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
