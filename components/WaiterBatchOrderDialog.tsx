"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { createWaiterOrders, fetchTables, type WaiterSession } from "@/lib/api";

type MenuItem = {
  id: number;
  name: string;
  price: number;
  category: string;
  type: string;
  imageUrl: string;
};

type CartLine = { item: MenuItem; qty: number };
type TableRow = Awaited<ReturnType<typeof fetchTables>>[number];

function tableLabel(t: TableRow) {
  const caption = String(t.orderCaption ?? "").trim();
  const base = caption || `Table ${t.tableNo}`;
  if (t.inUse) return `${base} (In use)`;
  return base;
}

export function WaiterBatchOrderDialog({
  lines,
  open,
  onClose,
  onSuccess,
  session,
}: {
  lines: CartLine[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: WaiterSession;
}) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableNo, setTableNo] = useState<string>("");
  const [items, setItems] = useState<CartLine[]>(lines);
  const [busy, setBusy] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    const justOpened = open && !wasOpen.current;
    wasOpen.current = open;
    if (!justOpened) return;
    setItems(lines);
    setTableNo("");
    setLoadingTables(true);
    void fetchTables()
      .then(setTables)
      .catch(() => toast.error("Failed to load tables"))
      .finally(() => setLoadingTables(false));
  }, [open, lines]);

  const total = useMemo(
    () =>
      items.reduce((sum, l) => sum + Number(l.item.price) * Number(l.qty), 0),
    [items],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Batch order</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Waiter · {session.name} — pick a free table (or one you already own),
          then send all lines together.
        </p>

        <div className="w-full space-y-1.5">
          <Label>Table</Label>
          <Select
            value={tableNo}
            onValueChange={setTableNo}
            disabled={loadingTables}
          >
            <SelectTrigger className="h-10 w-full min-w-0 justify-between">
              <SelectValue
                placeholder={loadingTables ? "Loading tables…" : "Select table"}
              />
            </SelectTrigger>
            <SelectContent
              position="popper"
              align="start"
              className="w-(--radix-select-trigger-width)"
            >
              {tables.map((t) => (
                  <SelectItem
                    key={t.id}
                    value={String(t.tableNo)}
                    disabled={t.inUse}
                  >
                    {tableLabel(t)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          {items.map((l) => (
            <div
              key={l.item.id}
              className="flex items-center gap-3 rounded-lg border bg-muted/20 p-2.5"
            >
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                {l.item.imageUrl ? (
                  <Image
                    src={l.item.imageUrl}
                    alt={l.item.name}
                    fill
                    className="object-cover"
                    sizes="48px"
                  />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{l.item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(Number(l.item.price) * l.qty).toFixed(2)} ETB
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.item.id === l.item.id
                          ? { ...x, qty: Math.max(1, x.qty - 1) }
                          : x,
                      ),
                    )
                  }
                >
                  <Minus className="h-3.5 w-3.5" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold tabular-nums">
                  {l.qty}
                </span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() =>
                    setItems((prev) =>
                      prev.map((x) =>
                        x.item.id === l.item.id
                          ? { ...x, qty: x.qty + 1 }
                          : x,
                      ),
                    )
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() =>
                    setItems((prev) =>
                      prev.filter((x) => x.item.id !== l.item.id),
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No items left in this batch
            </p>
          ) : null}
        </div>

        <Separator />
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Total</span>
          <span className="text-lg text-primary">{total.toFixed(2)} ETB</span>
        </div>

        <DialogFooter>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={busy || tableNo === "" || items.length === 0}
            onClick={async () => {
              const tn = Number(tableNo);
              if (!Number.isFinite(tn)) {
                toast.error("Select a table");
                return;
              }
              setBusy(true);
              try {
                await createWaiterOrders(
                  items.map((l) => ({
                    title: l.item.name,
                    imageUrl: l.item.imageUrl,
                    tableNo: tn,
                    orderAmount: l.qty,
                    category: l.item.category,
                    type: l.item.type,
                    price: l.item.price,
                  })),
                );
                toast.success("Batch order sent");
                onSuccess();
                onClose();
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Order failed",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              "Confirm batch order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
