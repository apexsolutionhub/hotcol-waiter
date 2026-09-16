"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  ChevronDown,
  ClipboardEdit,
  Coffee,
  LayoutGrid,
  Loader2,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createWaiterOrders,
  updateMyLiveOrder,
  type WaiterSession,
} from "@/lib/api";
import { isSameCafeBusinessDay } from "@/lib/cafeBusinessDay";
import { cn } from "@/lib/utils";

type MenuItem = {
  id: number;
  name: string;
  price: number;
  category: string;
  type: string;
  imageUrl: string;
  recipeJson?: unknown;
};

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

type MenuCategory = "all" | "food" | "beverage" | "others";

function itemCategory(item: MenuItem): Exclude<MenuCategory, "all"> {
  const cat = String(item.category || "").toLowerCase();
  if (cat === "food") return "food";
  if (cat === "beverage") return "beverage";
  return "others";
}

function isOpenToday(order: OrderRow) {
  if (String(order.payment || "").toLowerCase() === "paid") return false;
  const status = String(order.status || "").toLowerCase();
  if (status === "cancelled" || status === "failed") return false;
  return isSameCafeBusinessDay(order.createdAt);
}

function isPendingEditable(order: OrderRow) {
  if (!isOpenToday(order)) return false;
  return String(order.status || "").toLowerCase() === "pending";
}

function tableCaption(orders: OrderRow[], tableNo: number) {
  const hit = orders.find((o) => o.tableNo === tableNo);
  return hit ? `Table ${tableNo}` : `Table ${tableNo}`;
}

function WaiterAddItemsDialog({
  open,
  onClose,
  tableNo,
  menuItems,
  recipeStockBlockedIds,
  recipeMaxServingsById,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  tableNo: number;
  menuItems: MenuItem[];
  recipeStockBlockedIds?: Set<number>;
  recipeMaxServingsById?: Map<number, number>;
  onSuccess: () => void;
}) {
  const [search, setSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState<MenuCategory>("all");
  const [qtyById, setQtyById] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setMenuCategory("all");
    setQtyById({});
  }, [open, tableNo]);

  const categoryCounts = useMemo(() => {
    const counts = { all: menuItems.length, food: 0, beverage: 0, others: 0 };
    for (const item of menuItems) counts[itemCategory(item)] += 1;
    return counts;
  }, [menuItems]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return menuItems.filter((item) => {
      if (menuCategory !== "all" && itemCategory(item) !== menuCategory) {
        return false;
      }
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [menuItems, search, menuCategory]);

  const selected = useMemo(
    () =>
      menuItems
        .filter((i) => (qtyById[i.id] || 0) > 0)
        .map((i) => ({ item: i, qty: qtyById[i.id] })),
    [menuItems, qtyById],
  );

  const selectedUnits = selected.reduce((n, l) => n + l.qty, 0);
  const total = selected.reduce(
    (sum, l) => sum + Number(l.item.price) * l.qty,
    0,
  );

  const bumpQty = (itemId: number, delta: number) => {
    if (
      delta > 0 &&
      recipeStockBlockedIds?.has(itemId)
    ) {
      toast.error("Out of station stock");
      return;
    }
    setQtyById((prev) => {
      const next = { ...prev };
      const max =
        recipeMaxServingsById?.get(itemId) ?? Number.POSITIVE_INFINITY;
      let n = (next[itemId] || 0) + delta;
      if (delta > 0 && Number.isFinite(max)) n = Math.min(n, max);
      if (n <= 0) delete next[itemId];
      else next[itemId] = n;
      return next;
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="space-y-2 border-b px-5 py-4 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle className="text-lg">Add items</DialogTitle>
            <Badge variant="outline" className="font-mono">
              Table {tableNo}
            </Badge>
          </div>
          <DialogDescription>
            Pick menu items to add to this open table. The table stays locked
            until payment is completed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-b px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search menu…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          <Tabs
            value={menuCategory}
            onValueChange={(v) => setMenuCategory(v as MenuCategory)}
            className="w-full"
          >
            <TabsList className="grid h-auto w-full grid-cols-4 gap-1 bg-muted/50 p-1 group-data-horizontal/tabs:h-auto">
              <TabsTrigger
                value="all"
                className="!h-9 gap-1 px-2 text-xs data-active:shadow-none sm:text-sm"
              >
                <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                All
                <span className="tabular-nums text-muted-foreground">
                  {categoryCounts.all}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="food"
                className="!h-9 gap-1 px-2 text-xs data-active:shadow-none sm:text-sm"
              >
                <Utensils className="h-3.5 w-3.5 shrink-0" />
                Kitchen
                <span className="tabular-nums text-muted-foreground">
                  {categoryCounts.food}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="beverage"
                className="!h-9 gap-1 px-2 text-xs data-active:shadow-none sm:text-sm"
              >
                <Coffee className="h-3.5 w-3.5 shrink-0" />
                Bar
                <span className="tabular-nums text-muted-foreground">
                  {categoryCounts.beverage}
                </span>
              </TabsTrigger>
              <TabsTrigger
                value="others"
                className="!h-9 gap-1 px-2 text-xs data-active:shadow-none sm:text-sm"
              >
                Others
                <span className="tabular-nums text-muted-foreground">
                  {categoryCounts.others}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-14 text-center">
              <UtensilsCrossed className="mb-3 h-9 w-9 text-muted-foreground/35" />
              <p className="text-sm font-medium">No items match</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try another category or clear your search.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((item) => {
                const qty = qtyById[item.id] || 0;
                const stockBlocked = Boolean(
                  recipeStockBlockedIds?.has(item.id),
                );
                const maxServings =
                  recipeMaxServingsById?.get(item.id) ??
                  Number.POSITIVE_INFINITY;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-border/70 bg-card p-2.5 shadow-sm transition",
                      qty > 0 &&
                        "border-primary/45 bg-primary/5 ring-1 ring-primary/15",
                      stockBlocked && "border-dashed opacity-70",
                    )}
                  >
                    <button
                      type="button"
                      disabled={stockBlocked}
                      className={cn(
                        "relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted",
                        stockBlocked && "cursor-not-allowed",
                      )}
                      onClick={() => bumpQty(item.id, 1)}
                      aria-label={
                        stockBlocked
                          ? `${item.name} out of station stock`
                          : `Add ${item.name}`
                      }
                    >
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          className={cn(
                            "object-cover",
                            stockBlocked && "grayscale",
                          )}
                          sizes="56px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground/30">
                          <UtensilsCrossed className="h-5 w-5" />
                        </div>
                      )}
                      {stockBlocked ? (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 px-1 text-center text-[8px] font-bold uppercase leading-tight text-white">
                          Out of stock
                        </span>
                      ) : qty > 0 ? (
                        <span className="absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-emerald-950">
                          {qty}
                        </span>
                      ) : null}
                    </button>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {item.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold tabular-nums text-primary">
                          {Number(item.price).toFixed(2)}{" "}
                          <span className="text-[10px] font-medium text-muted-foreground">
                            ETB
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className="h-5 text-[10px] capitalize"
                        >
                          {item.type}
                        </Badge>
                      </div>
                      {stockBlocked ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Recipe ingredients missing at kitchen/bar
                        </p>
                      ) : null}
                    </div>

                    {stockBlocked ? null : (
                      <div className="flex items-center gap-0.5 rounded-lg border bg-muted/30 p-0.5">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={qty <= 0}
                          onClick={() => bumpQty(item.id, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-7 text-center text-sm font-semibold tabular-nums">
                          {qty}
                        </span>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          disabled={
                            Number.isFinite(maxServings) &&
                            qty >= maxServings
                          }
                          onClick={() => bumpQty(item.id, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t bg-muted/15 px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShoppingBag className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {selected.length} selected · {selectedUnits} units
                </p>
                <p className="text-xs text-muted-foreground">
                  Adding to Table {tableNo}
                </p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums text-primary">
              {total.toFixed(2)}{" "}
              <span className="text-xs font-medium text-muted-foreground">
                ETB
              </span>
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              className="h-11 flex-[1.4] bg-emerald-600 hover:bg-emerald-700"
              disabled={busy || selected.length === 0}
              onClick={async () => {
                setBusy(true);
                try {
                  await createWaiterOrders(
                    selected.map((l) => ({
                      title: l.item.name,
                      imageUrl: l.item.imageUrl,
                      tableNo,
                      orderAmount: l.qty,
                      category: l.item.category,
                      type: l.item.type,
                      price: l.item.price,
                    })),
                    { addingToExistingTable: true },
                  );
                  toast.success("Items added to table");
                  onSuccess();
                  onClose();
                } catch (error) {
                  toast.error(
                    error instanceof Error ? error.message : "Add failed",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                `Add ${selectedUnits || ""} item${selectedUnits === 1 ? "" : "s"}`
              )}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function WaiterMyOrdersPanel({
  orders,
  menuItems,
  session,
  busy,
  onRefresh,
  onGoToMenu,
  recipeStockBlockedIds,
  recipeMaxServingsById,
}: {
  orders: OrderRow[];
  menuItems: MenuItem[];
  session: WaiterSession;
  busy: boolean;
  onRefresh: () => void | Promise<void>;
  onGoToMenu: () => void;
  recipeStockBlockedIds?: Set<number>;
  recipeMaxServingsById?: Map<number, number>;
}) {
  const unpaid = useMemo(() => orders.filter(isOpenToday), [orders]);
  const groups = useMemo(() => {
    const map = new Map<number, OrderRow[]>();
    for (const o of unpaid) {
      const list = map.get(o.tableNo) ?? [];
      list.push(o);
      map.set(o.tableNo, list);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([tableNo, lines]) => {
        const pending = lines.filter(isPendingEditable);
        const total = lines.reduce(
          (sum, o) => sum + Number(o.price) * Number(o.orderAmount),
          0,
        );
        const approvalPending = lines.some((o) => o.paymentApprovalRequestId);
        return {
          tableNo,
          lines: [...lines].sort((a, b) => b.id - a.id),
          pending,
          total,
          approvalPending,
        };
      });
  }, [unpaid]);

  const [openTables, setOpenTables] = useState<Record<number, boolean>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [addTableNo, setAddTableNo] = useState<number | null>(null);

  const selected = useMemo(
    () => unpaid.find((o) => o.id === selectedId) ?? null,
    [unpaid, selectedId],
  );

  useEffect(() => {
    if (selected) setEditQty(Math.max(1, Number(selected.orderAmount) || 1));
  }, [selected]);

  const selectedOrderMaxServings = useMemo(() => {
    if (!session.recipeStockEnforced || !selected || !recipeMaxServingsById) {
      return null;
    }
    const menuItem =
      menuItems.find(
        (i) =>
          i.name.trim().toLowerCase() ===
          String(selected.title || "")
            .trim()
            .toLowerCase(),
      ) || null;
    if (!menuItem) return null;
    const max = recipeMaxServingsById.get(menuItem.id);
    if (max == null || !Number.isFinite(max)) return null;
    return max;
  }, [
    session.recipeStockEnforced,
    selected,
    menuItems,
    recipeMaxServingsById,
  ]);

  const bumpEditQty = (delta: number) => {
    setEditQty((q) => {
      const next = Math.max(1, q + delta);
      if (
        delta > 0 &&
        selectedOrderMaxServings != null &&
        next > selectedOrderMaxServings
      ) {
        toast.error(
          selectedOrderMaxServings <= 0
            ? `No station stock for “${selected?.title ?? "this item"}” — cannot increase quantity.`
            : `Cannot increase “${selected?.title ?? "item"}” to ${next} — station can cover up to ${selectedOrderMaxServings}.`,
        );
        return q;
      }
      return next;
    });
  };

  const setEditQtyFromInput = (raw: number) => {
    const next = Math.max(1, Math.floor(raw || 1));
    if (
      selectedOrderMaxServings != null &&
      next > selectedOrderMaxServings
    ) {
      toast.error(
        selectedOrderMaxServings <= 0
          ? `No station stock for “${selected?.title ?? "this item"}” — cannot increase quantity.`
          : `Cannot set “${selected?.title ?? "item"}” to ${next} — station can cover up to ${selectedOrderMaxServings}.`,
      );
      setEditQty(
        Math.max(1, Math.min(next, Math.max(selectedOrderMaxServings, 1))),
      );
      return;
    }
    setEditQty(next);
  };

  const pendingCount = groups.reduce((n, g) => n + g.pending.length, 0);
  const openTotal = groups.reduce((n, g) => n + g.total, 0);

  if (groups.length === 0) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
            My open orders
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Update pending lines or add items to your open tables. Tables stay
            locked until payment is approved.
          </p>
        </div>
        <div className="rounded-2xl border border-dashed bg-muted/20 py-16 text-center">
          <ClipboardEdit className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h3 className="text-lg font-medium">No open tables</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Send a new order from the menu to open a table.
          </p>
          <Button className="mt-4" variant="outline" onClick={onGoToMenu}>
            Go to menu
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
          My open orders
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Expand a table to edit pending lines or add items. New from-scratch
          orders cannot reuse these tables until payment is completed.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/20 p-3 text-center sm:gap-3 sm:p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Pending
          </p>
          <p className="text-lg font-semibold tabular-nums">{pendingCount}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Tables
          </p>
          <p className="text-lg font-semibold tabular-nums">{groups.length}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Open total
          </p>
          <p className="text-lg font-semibold tabular-nums">
            {openTotal.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {groups.map((g) => {
            const isOpen = openTables[g.tableNo] ?? false;
            const allReady = g.pending.length === 0;
            return (
              <Collapsible
                key={g.tableNo}
                open={isOpen}
                onOpenChange={(next) =>
                  setOpenTables((prev) => ({ ...prev, [g.tableNo]: next }))
                }
              >
                <Card
                  className={cn(
                    "overflow-hidden border-border/70 border-l-4 shadow-sm",
                    g.approvalPending
                      ? "border-l-amber-500/80"
                      : "border-l-primary/70",
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {tableCaption(g.lines, g.tableNo)}
                          </Badge>
                          {g.approvalPending ? (
                            <Badge className="bg-amber-500/15 text-amber-200">
                              Approval sent
                            </Badge>
                          ) : null}
                          <Badge
                            variant="secondary"
                            className={cn(
                              allReady &&
                                "bg-emerald-500/15 text-emerald-300",
                            )}
                          >
                            {allReady
                              ? "All ready · add more"
                              : `${g.pending.length} pending`}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Waiter · {session.name}
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

                  <CollapsibleContent>
                    <CardContent className="space-y-3 border-t pt-4">
                      {allReady ? (
                        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-5 text-center text-sm text-muted-foreground">
                          Kitchen / bar finished. Add more items, or request
                          payment.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {g.pending.map((o) => {
                            const isSelected = selectedId === o.id;
                            return (
                              <button
                                key={o.id}
                                type="button"
                                onClick={() => setSelectedId(o.id)}
                                className={cn(
                                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition",
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "hover:bg-muted/40",
                                )}
                              >
                                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
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
                                  <p className="truncate font-semibold">
                                    {o.title}
                                  </p>
                                  <p className="mt-0.5 text-sm text-muted-foreground">
                                    Qty {o.orderAmount} ·{" "}
                                    <span className="font-semibold tabular-nums text-foreground">
                                      {(
                                        Number(o.price) * Number(o.orderAmount)
                                      ).toFixed(2)}{" "}
                                      ETB
                                    </span>
                                  </p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    <Badge variant="outline" className="text-[10px]">
                                      {o.status || "Pending"}
                                    </Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {o.payment || "Unpaid"}
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-full gap-2"
                        disabled={g.approvalPending}
                        onClick={() => setAddTableNo(g.tableNo)}
                      >
                        <Plus className="h-4 w-4" />
                        Add items to Table {g.tableNo}
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>

        <Card className="h-fit border-border/70 shadow-sm lg:sticky lg:top-4">
          <CardHeader className="border-b py-3">
            <p className="font-semibold">
              {selected ? "Edit item" : "Actions"}
            </p>
            <p className="text-sm text-muted-foreground">
              {selected
                ? selected.title
                : "Select a pending line to change quantity"}
            </p>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {!selected ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Tap a pending item on the left to edit quantity.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-lg border bg-muted/20 p-3">
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                    {selected.imageUrl ? (
                      <Image
                        src={selected.imageUrl}
                        alt={selected.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{selected.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Table {selected.tableNo} ·{" "}
                      {Number(selected.price).toFixed(2)} ETB each
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-10 w-10"
                      disabled={busy || saving || editQty <= 1}
                      onClick={() => bumpEditQty(-1)}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min={1}
                      className="h-10 text-center tabular-nums"
                      value={editQty}
                      onChange={(e) =>
                        setEditQtyFromInput(Number(e.target.value))
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-10 w-10"
                      disabled={busy || saving}
                      onClick={() => bumpEditQty(1)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {selectedOrderMaxServings != null ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedOrderMaxServings <= 0
                        ? "No station stock for this recipe — cannot increase quantity."
                        : `Station can cover up to ${selectedOrderMaxServings} total for this recipe.`}
                    </p>
                  ) : null}
                </div>
                <p className="text-sm font-semibold tabular-nums">
                  Line total:{" "}
                  <span className="text-primary">
                    {(Number(selected.price) * editQty).toFixed(2)} ETB
                  </span>
                </p>
                <Button
                  className="h-11 w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={
                    busy ||
                    saving ||
                    editQty === Number(selected.orderAmount) ||
                    Boolean(selected.paymentApprovalRequestId)
                  }
                  onClick={async () => {
                    const prevQty = Math.max(
                      1,
                      Number(selected.orderAmount) || 1,
                    );
                    if (
                      selectedOrderMaxServings != null &&
                      editQty > prevQty &&
                      editQty > selectedOrderMaxServings
                    ) {
                      toast.error(
                        `Cannot increase “${selected.title}” to ${editQty} — not enough kitchen/bar recipe stock on hand.`,
                      );
                      return;
                    }
                    setSaving(true);
                    try {
                      await updateMyLiveOrder({
                        id: selected.id,
                        orderAmount: editQty,
                      });
                      toast.success("Quantity updated");
                      await onRefresh();
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : "Update failed",
                      );
                    } finally {
                      setSaving(false);
                    }
                  }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <WaiterAddItemsDialog
        open={addTableNo != null}
        tableNo={addTableNo ?? 0}
        menuItems={menuItems}
        recipeStockBlockedIds={recipeStockBlockedIds}
        recipeMaxServingsById={recipeMaxServingsById}
        onClose={() => setAddTableNo(null)}
        onSuccess={() => void onRefresh()}
      />
    </div>
  );
}
