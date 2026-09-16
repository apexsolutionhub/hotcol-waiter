"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Coffee,
  LayoutGrid,
  LogOut,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Store,
  Utensils,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { LiveDateTimeClock } from "@/components/LiveDateTimeClock";
import { ChangeWaiterPasskeyButton } from "@/components/ChangeWaiterPasskeyButton";
import { WaiterOrderDialog } from "@/components/WaiterOrderDialog";
import { WaiterBatchOrderDialog } from "@/components/WaiterBatchOrderDialog";
import { WaiterMyOrdersPanel } from "@/components/WaiterMyOrdersPanel";
import { WaiterPaymentPanel } from "@/components/WaiterPaymentPanel";
import {
  WAITER_LIVE_POLL_MS,
  useVisibleInterval,
} from "@/hooks/useVisibleInterval";
import { useRecipeStockBlockedIds } from "@/hooks/useRecipeStockBlockedIds";
import { isSameCafeBusinessDay } from "@/lib/cafeBusinessDay";
import {
  clearWaiterAuth,
  fetchMe,
  fetchMenuItems,
  fetchMyOrders,
  fetchTables,
  getWaiterSession,
  getWaiterToken,
  requestPaymentApproval,
  type WaiterSession,
} from "@/lib/api";
import { cn } from "@/lib/utils";

type MenuItem = Awaited<ReturnType<typeof fetchMenuItems>>[number];
type OrderRow = Awaited<ReturnType<typeof fetchMyOrders>>[number];
type CartLine = { item: MenuItem; qty: number };
type MenuCategory = "all" | "food" | "beverage" | "others";
type PortalTab = "order" | "orders" | "pay";

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

/** Matches cashier Payment: digital mode only completes kitchen/bar "Completed" lines. */
function isReadyForPaymentApproval(order: OrderRow) {
  if (!isOpenToday(order)) return false;
  return String(order.status || "").toLowerCase() === "completed";
}

export default function WaiterPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<WaiterSession | null>(null);
  const [tab, setTab] = useState<PortalTab>("order");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All");
  const [menuCategory, setMenuCategory] = useState<MenuCategory>("all");
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [payMethod, setPayMethod] = useState("Cash");
  const [payAmount, setPayAmount] = useState("");
  const [payFullyPaid, setPayFullyPaid] = useState(true);
  const [payNote, setPayNote] = useState("");
  const [singleItem, setSingleItem] = useState<MenuItem | null>(null);
  const [singleOpen, setSingleOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);

  const { blockedIds: recipeStockBlockedIds, maxServingsById: recipeMaxServingsById } =
    useRecipeStockBlockedIds(items, {
      enabled: Boolean(session?.recipeStockEnforced),
    });

  useEffect(() => {
    if (recipeStockBlockedIds.size === 0) return;
    setCart((prev) => {
      const next = prev.filter((l) => !recipeStockBlockedIds.has(l.item.id));
      return next.length === prev.length ? prev : next;
    });
  }, [recipeStockBlockedIds]);

  const load = useCallback(async (opts?: { refresh?: boolean; silent?: boolean }) => {
    if (opts?.refresh && !opts.silent) setRefreshing(true);
    else if (!opts?.silent) setLoading(true);
    try {
      const [menu, mine] = await Promise.all([
        fetchMenuItems(),
        fetchMyOrders(),
      ]);
      // Keep table occupancy fresh for dialogs / other terminals.
      void fetchTables().catch(() => undefined);
      setItems(menu.filter((i) => !i.isSuspended));
      setOrders(mine);
    } catch (error) {
      if (!opts?.silent) {
        toast.error(error instanceof Error ? error.message : "Failed to load");
      }
      if (String(error).toLowerCase().includes("auth")) {
        clearWaiterAuth();
        router.replace("/");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    if (!getWaiterToken()) {
      router.replace("/");
      return;
    }
    setSession(getWaiterSession());
    void (async () => {
      try {
        const me = await fetchMe();
        setSession(me);
      } catch {
        /* keep cached session */
      }
      await load();
    })();
  }, [router, load]);

  useVisibleInterval(
    () => {
      if (session) void load({ refresh: true, silent: true });
    },
    session ? WAITER_LIVE_POLL_MS : null,
  );

  const unpaid = useMemo(() => orders.filter(isOpenToday), [orders]);
  const readyForPay = useMemo(
    () => unpaid.filter(isReadyForPaymentApproval),
    [unpaid],
  );

  useEffect(() => {
    const readyIds = new Set(readyForPay.map((o) => o.id));
    setSelectedOrderIds((prev) => {
      const next = prev.filter((id) => readyIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [readyForPay]);

  const uniqueTypes = useMemo(
    () => [...new Set(items.map((item) => item.type).filter(Boolean))],
    [items],
  );

  const categoryCounts = useMemo(() => {
    const counts = { all: items.length, food: 0, beverage: 0, others: 0 };
    for (const item of items) {
      counts[itemCategory(item)] += 1;
    }
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (menuCategory !== "all" && itemCategory(item) !== menuCategory) {
        return false;
      }
      if (selectedType !== "All" && item.type !== selectedType) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.type.toLowerCase().includes(q)
      );
    });
  }, [items, search, menuCategory, selectedType]);

  const cartTotal = useMemo(
    () =>
      cart.reduce((sum, l) => sum + Number(l.item.price) * Number(l.qty), 0),
    [cart],
  );

  const cartUnits = useMemo(
    () => cart.reduce((n, l) => n + l.qty, 0),
    [cart],
  );

  const selectedTotal = useMemo(
    () =>
      readyForPay
        .filter((o) => selectedOrderIds.includes(o.id))
        .reduce((sum, o) => sum + Number(o.price) * Number(o.orderAmount), 0),
    [readyForPay, selectedOrderIds],
  );

  const toggleCartItem = (item: MenuItem, checked: boolean) => {
    if (checked && recipeStockBlockedIds.has(item.id)) {
      toast.error(`“${item.name}” is out of station stock`);
      return;
    }
    setCart((prev) => {
      if (checked) {
        if (prev.some((l) => l.item.id === item.id)) return prev;
        return [...prev, { item, qty: 1 }];
      }
      return prev.filter((l) => l.item.id !== item.id);
    });
  };

  const bumpCartQty = (itemId: number, delta: number) => {
    if (recipeStockBlockedIds.has(itemId) && delta > 0) return;
    setCart((prev) => {
      const hit = prev.find((l) => l.item.id === itemId);
      if (!hit) {
        const item = items.find((i) => i.id === itemId);
        if (!item || delta < 0) return prev;
        if (recipeStockBlockedIds.has(item.id)) return prev;
        return [...prev, { item, qty: 1 }];
      }
      const max =
        recipeMaxServingsById.get(itemId) ?? Number.POSITIVE_INFINITY;
      let next = hit.qty + delta;
      if (delta > 0 && Number.isFinite(max)) {
        next = Math.min(next, max);
      }
      if (next <= 0) return prev.filter((l) => l.item.id !== itemId);
      return prev.map((l) =>
        l.item.id === itemId ? { ...l, qty: next } : l,
      );
    });
  };

  const openSingle = (item: MenuItem) => {
    if (recipeStockBlockedIds.has(item.id)) {
      toast.error(`“${item.name}” is out of station stock`);
      return;
    }
    setSingleItem(item);
    setSingleOpen(true);
  };

  const sendPayRequest = async () => {
    if (!session?.waiterPaymentApprovalEnabled) {
      toast.error("Payment approval is not enabled for this property");
      return;
    }
    if (!selectedOrderIds.length) {
      toast.error("Select completed unpaid orders");
      return;
    }
    const amount = payFullyPaid
      ? selectedTotal
      : Number(String(payAmount).replace(/,/g, "").trim());
    if (!(amount > 0)) {
      toast.error(
        payFullyPaid
          ? "Select completed lines to request payment"
          : `Enter ${payMethod.toLowerCase()} amount paid`,
      );
      return;
    }
    if (amount > selectedTotal + 0.001) {
      toast.error("Amount cannot exceed selected total");
      return;
    }
    setBusy(true);
    try {
      const first = readyForPay.find((o) => selectedOrderIds.includes(o.id));
      await requestPaymentApproval({
        orderIds: selectedOrderIds,
        amountPaid: amount,
        paymentMethod: payMethod,
        withBank: payMethod.toLowerCase() === "bank",
        tableNo: first?.tableNo,
        requestNote: payNote || undefined,
      });
      toast.success("Payment approval requested — cashier notified");
      setSelectedOrderIds([]);
      setPayNote("");
      setPayAmount("");
      setPayFullyPaid(true);
      await load({ refresh: true, silent: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const navItems: {
    id: PortalTab;
    label: string;
    icon: typeof UtensilsCrossed;
  }[] = [
    { id: "order", label: "New order", icon: UtensilsCrossed },
    { id: "orders", label: "My orders", icon: ShoppingBag },
    { id: "pay", label: "Payment", icon: Wallet },
  ];

  if (!session || loading) {
    return (
      <div className="min-h-screen bg-muted/20">
        <header className="app-chrome-header relative flex h-20 items-center justify-between border-b px-6">
          <div className="flex gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-10 w-64 rounded-lg" />
        </header>
        <main className="grid grid-cols-1 gap-6 p-6 md:grid-cols-3 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </main>
      </div>
    );
  }

  const displayName = session.displayName || "Café";

  return (
    <SidebarProvider>
      <div className="flex h-svh w-full overflow-hidden bg-muted/40 text-foreground">
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border shadow-sm"
        >
          <SidebarHeader className="h-16 shrink-0 border-b border-sidebar-border bg-sidebar-accent/25 px-4">
            <div className="flex h-full min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                <Store className="h-4 w-4" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-[10px] font-medium uppercase tracking-wider text-sidebar-foreground/60">
                  Terminal
                </p>
                <span className="block truncate font-semibold leading-tight">
                  Floor waiter
                </span>
              </div>
            </div>
          </SidebarHeader>
          <div className="shrink-0 px-3 pb-2 pt-3">
            <SidebarSeparator className="bg-sidebar-border/80" />
          </div>
          <SidebarContent className="flex-1 gap-0 px-2 pb-4 pt-2">
            <SidebarMenu className="gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={tab === item.id}
                      onClick={() => setTab(item.id)}
                      tooltip={item.label}
                      size="lg"
                      className="h-10 cursor-pointer text-[13px] data-[active=true]:shadow-sm"
                    >
                      <Icon className="opacity-80" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-4 pt-2">
            <Button
              variant="outline"
              className="w-full cursor-pointer justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                clearWaiterAuth();
                router.replace("/");
              }}
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>Sign out</span>
            </Button>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden border-0 bg-linear-to-br from-background via-background to-muted/20 md:m-2 md:ml-0 md:max-h-[calc(100svh-1rem)] md:rounded-xl md:border md:border-border/80 md:bg-background md:shadow-lg md:ring-1 md:ring-black/5 dark:md:ring-white/10">
          <header className="app-chrome-header sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-2 sm:gap-3 sm:px-3 md:h-16 md:px-6">
            <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
              <SidebarTrigger className="shrink-0" />
              <div className="min-w-0">
                <h1 className="max-w-[11rem] truncate text-[11px] font-medium uppercase tracking-wider sm:max-w-[16rem] sm:text-xs md:text-sm">
                  {displayName}
                </h1>
                <p className="hidden truncate text-[10px] text-[#d4b896]/70 sm:block">
                  {session.name}
                </p>
              </div>
            </div>
            <LiveDateTimeClock className="min-w-0 flex-1" />
            <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
              <ChangeWaiterPasskeyButton />
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/15 bg-white/5 sm:h-9 sm:w-9"
                disabled={loading || refreshing}
                onClick={() => void load({ refresh: true })}
                aria-label="Refresh"
              >
                <RefreshCw
                  className={cn(
                    "h-4 w-4",
                    (loading || refreshing) && "animate-spin",
                  )}
                />
              </Button>
              <Avatar className="h-8 w-8 border border-white/15 shadow-sm sm:h-9 sm:w-9">
                <AvatarImage
                  src={session.logoUrl || undefined}
                  alt={displayName}
                />
                <AvatarFallback className="bg-white/10 text-xs font-semibold text-[#d4b896]">
                  <Store className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          <div
            className={
              tab === "order"
                ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
                : "min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6"
            }
          >
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {tab === "order" ? (
                <div className="relative flex min-h-full flex-col bg-linear-to-b from-background to-muted/20">
                  <div className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
                    <div className="mx-auto max-w-400 space-y-4 px-4 py-4 md:px-6 md:py-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold tracking-tight md:text-2xl">
                            Menu
                          </h2>
                          <p className="text-sm text-muted-foreground">
                            Tap a card for a quick order, or batch-select items
                            then confirm the table in the dialog.
                          </p>
                        </div>
                        {cart.length > 0 ? (
                          <Button
                            size="sm"
                            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setBatchOpen(true)}
                          >
                            <ShoppingBag className="h-4 w-4" />
                            Order {cart.length} item
                            {cart.length > 1 ? "s" : ""}
                          </Button>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
                        <div className="relative w-full max-w-sm sm:w-72">
                          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search menu…"
                            className="h-10 pl-9"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                          />
                        </div>
                        <Select
                          value={selectedType}
                          onValueChange={setSelectedType}
                        >
                          <SelectTrigger className="h-10 w-full sm:w-44">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectLabel>Item type</SelectLabel>
                              <SelectItem value="All">All types</SelectItem>
                              {uniqueTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </div>

                      <Tabs
                        value={menuCategory}
                        onValueChange={(v) =>
                          setMenuCategory(v as MenuCategory)
                        }
                        className="w-full"
                      >
                        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/50 p-1 group-data-horizontal/tabs:h-auto sm:grid-cols-4">
                          <TabsTrigger
                            value="all"
                            className="!h-10 gap-1.5 px-3 py-0 data-active:shadow-none"
                          >
                            <LayoutGrid className="h-3.5 w-3.5 shrink-0" />
                            All
                            <Badge
                              variant="secondary"
                              className="ml-1 h-5 px-1.5 text-[10px]"
                            >
                              {categoryCounts.all}
                            </Badge>
                          </TabsTrigger>
                          <TabsTrigger
                            value="food"
                            className="!h-10 gap-1.5 px-3 py-0 data-active:shadow-none"
                          >
                            <Utensils className="h-3.5 w-3.5 shrink-0" />
                            Kitchen
                            <Badge
                              variant="secondary"
                              className="ml-1 h-5 px-1.5 text-[10px]"
                            >
                              {categoryCounts.food}
                            </Badge>
                          </TabsTrigger>
                          <TabsTrigger
                            value="beverage"
                            className="!h-10 gap-1.5 px-3 py-0 data-active:shadow-none"
                          >
                            <Coffee className="h-3.5 w-3.5 shrink-0" />
                            Bar
                            <Badge
                              variant="secondary"
                              className="ml-1 h-5 px-1.5 text-[10px]"
                            >
                              {categoryCounts.beverage}
                            </Badge>
                          </TabsTrigger>
                          <TabsTrigger
                            value="others"
                            className="!h-10 gap-1.5 px-3 py-0 data-active:shadow-none"
                          >
                            Others
                            <Badge
                              variant="secondary"
                              className="ml-1 h-5 px-1.5 text-[10px]"
                            >
                              {categoryCounts.others}
                            </Badge>
                          </TabsTrigger>
                        </TabsList>
                      </Tabs>
                    </div>
                  </div>

                  <div
                    className={cn(
                      "mx-auto w-full max-w-400 flex-1 px-4 py-5 md:px-6 md:py-6",
                      cart.length > 0 && "pb-28",
                    )}
                  >
                    {filteredItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 py-20 text-center">
                        <ShoppingBag className="mb-4 h-12 w-12 text-muted-foreground/30" />
                        <h3 className="text-lg font-medium">No items match</h3>
                        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                          {items.length === 0
                            ? "No menu items available for this property."
                            : "Try another category or clear your search."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                        {filteredItems.map((item) => {
                          const line = cart.find((l) => l.item.id === item.id);
                          const isSelected = Boolean(line);
                          const quantity = line?.qty || 1;
                          const totalPrice = Number(item.price) * quantity;
                          const stockBlocked = recipeStockBlockedIds.has(
                            item.id,
                          );
                          const unavailable = stockBlocked;
                          const unavailableLabel = "Out of station stock";
                          const unavailableHint =
                            "Recipe ingredients missing at kitchen/bar — stock out first";
                          const maxServings =
                            recipeMaxServingsById.get(item.id) ??
                            Number.POSITIVE_INFINITY;

                          return (
                            <Card
                              key={item.id}
                              className={cn(
                                "group flex flex-col overflow-hidden border-border/70 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
                                isSelected &&
                                  "border-primary ring-2 ring-primary/15",
                                unavailable &&
                                  "border-dashed opacity-90 hover:border-border/70 hover:shadow-sm",
                              )}
                              aria-disabled={unavailable}
                            >
                              <button
                                type="button"
                                disabled={unavailable}
                                className={cn(
                                  "relative aspect-square w-full overflow-hidden bg-muted",
                                  unavailable && "cursor-not-allowed",
                                )}
                                onClick={() => {
                                  if (!unavailable) openSingle(item);
                                }}
                              >
                                {item.imageUrl ? (
                                  <Image
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    sizes="(max-width: 640px) 50vw, 200px"
                                    className={cn(
                                      "object-cover transition-transform duration-300 group-hover:scale-105",
                                      unavailable && "grayscale",
                                    )}
                                  />
                                ) : (
                                  <div className="flex h-full items-center justify-center text-muted-foreground/30">
                                    <UtensilsCrossed className="h-10 w-10" />
                                  </div>
                                )}
                                {unavailable ? (
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                                    <Badge
                                      variant="secondary"
                                      className="-rotate-6 bg-background/90 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-md"
                                    >
                                      {unavailableLabel}
                                    </Badge>
                                  </div>
                                ) : null}
                                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pt-8 pb-2">
                                  <p className="line-clamp-2 text-left text-sm leading-snug font-semibold text-white">
                                    {item.name}
                                  </p>
                                </div>
                              </button>

                              <CardFooter className="flex flex-col gap-2.5 p-3">
                                <div className="flex w-full items-center justify-between gap-2">
                                  <span className="text-base font-bold tabular-nums text-primary">
                                    {Number(item.price).toFixed(2)}{" "}
                                    <span className="text-[10px] font-medium text-muted-foreground">
                                      ETB
                                    </span>
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className="shrink-0 text-[10px] capitalize"
                                  >
                                    {item.type}
                                  </Badge>
                                </div>

                                {unavailable ? (
                                  <p className="w-full rounded-lg bg-muted/60 px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                                    {unavailableHint}
                                  </p>
                                ) : null}

                                {isSelected && !unavailable ? (
                                  <div className="flex w-full items-center justify-between rounded-lg bg-primary/5 px-2 py-1.5">
                                    <div className="flex items-center gap-1">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() =>
                                          bumpCartQty(item.id, -1)
                                        }
                                      >
                                        <Minus className="h-3.5 w-3.5" />
                                      </Button>
                                      <span className="w-6 text-center text-sm font-semibold tabular-nums">
                                        {quantity}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        disabled={
                                          Number.isFinite(maxServings) &&
                                          quantity >= maxServings
                                        }
                                        onClick={() =>
                                          bumpCartQty(item.id, 1)
                                        }
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                    <span className="text-xs font-semibold tabular-nums">
                                      {totalPrice.toFixed(2)} ETB
                                    </span>
                                  </div>
                                ) : null}

                                {!unavailable ? (
                                  <div className="flex w-full items-center justify-between gap-2">
                                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) =>
                                          toggleCartItem(
                                            item,
                                            checked === true,
                                          )
                                        }
                                      />
                                      Batch
                                    </label>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="secondary"
                                      className="h-8 text-xs"
                                      onClick={() => openSingle(item)}
                                    >
                                      Order
                                    </Button>
                                  </div>
                                ) : null}
                              </CardFooter>
                            </Card>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {cart.length > 0 ? (
                    <div className="sticky bottom-0 z-20 border-t bg-background/95 px-4 py-3 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur md:px-6">
                      <div className="mx-auto flex max-w-400 flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <ShoppingBag className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">
                              {cart.length} selected · {cartUnits} units
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Ready for batch order
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-lg font-bold tabular-nums text-primary">
                            {cartTotal.toFixed(2)} ETB
                          </p>
                          <Button
                            className="bg-emerald-600 hover:bg-emerald-700"
                            onClick={() => setBatchOpen(true)}
                          >
                            Order now
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {tab === "orders" ? (
                <WaiterMyOrdersPanel
                  orders={orders}
                  menuItems={items}
                  session={session}
                  busy={busy}
                  onRefresh={() => load({ refresh: true, silent: true })}
                  onGoToMenu={() => setTab("order")}
                  recipeStockBlockedIds={recipeStockBlockedIds}
                  recipeMaxServingsById={recipeMaxServingsById}
                />
              ) : null}

              {tab === "pay" ? (
                <WaiterPaymentPanel
                  orders={orders}
                  approvalEnabled={session.waiterPaymentApprovalEnabled}
                  busy={busy}
                  selectedOrderIds={selectedOrderIds}
                  onSelectedOrderIdsChange={setSelectedOrderIds}
                  payMethod={payMethod}
                  onPayMethodChange={setPayMethod}
                  payAmount={payAmount}
                  onPayAmountChange={setPayAmount}
                  payFullyPaid={payFullyPaid}
                  onPayFullyPaidChange={setPayFullyPaid}
                  payNote={payNote}
                  onPayNoteChange={setPayNote}
                  onSubmit={() => void sendPayRequest()}
                />
              ) : null}
            </div>
          </div>
        </SidebarInset>
      </div>

      <WaiterOrderDialog
        item={singleItem}
        open={singleOpen}
        onClose={() => {
          setSingleOpen(false);
          setSingleItem(null);
        }}
        onSuccess={() => {
          setCart([]);
          void load({ refresh: true, silent: true });
          setTab("orders");
        }}
        session={session}
      />

      <WaiterBatchOrderDialog
        lines={cart}
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        onSuccess={() => {
          setCart([]);
          void load({ refresh: true, silent: true });
          setTab("orders");
        }}
        session={session}
      />
    </SidebarProvider>
  );
}
