"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

type TableRow = Awaited<ReturnType<typeof fetchTables>>[number];

function tableLabel(t: TableRow) {
  const caption = String(t.orderCaption ?? "").trim();
  const base = caption || `Table ${t.tableNo}`;
  if (t.inUse) return `${base} (In use)`;
  return base;
}

export function WaiterOrderDialog({
  item,
  open,
  onClose,
  onSuccess,
  session,
}: {
  item: MenuItem | null;
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  session: WaiterSession;
}) {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [tableNo, setTableNo] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  useEffect(() => {
    if (!open || !item) return;
    setQty(1);
    setTableNo("");
    setLoadingTables(true);
    void fetchTables()
      .then(setTables)
      .catch(() => toast.error("Failed to load tables"))
      .finally(() => setLoadingTables(false));
  }, [open, item]);

  const selectable = useMemo(
    () => tables.filter((t) => !t.inUse),
    [tables],
  );

  if (!item) return null;

  const total = Number(item.price) * qty;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm order</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 rounded-lg border bg-muted/30 p-3">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
            {item.imageUrl ? (
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.name}</p>
            <p className="text-sm font-semibold text-primary">
              {Number(item.price).toFixed(2)} ETB
            </p>
            <p className="text-xs text-muted-foreground">Waiter · {session.name}</p>
          </div>
        </div>

        <div className="space-y-4">
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
            {selectable.length === 0 && !loadingTables ? (
              <p className="text-xs text-muted-foreground">
                All tables are in use until payment is completed. Use My orders
                to update your open tables.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Quantity</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) =>
                setQty(Math.max(1, Math.floor(Number(e.target.value) || 1)))
              }
            />
          </div>
        </div>

        <Separator />
        <div className="flex items-center justify-between text-sm font-bold">
          <span>Total</span>
          <span className="text-lg text-primary">{total.toFixed(2)} ETB</span>
        </div>

        <DialogFooter>
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={busy || tableNo === ""}
            onClick={async () => {
              const tn = Number(tableNo);
              if (!Number.isFinite(tn)) {
                toast.error("Select a table");
                return;
              }
              setBusy(true);
              try {
                await createWaiterOrders([
                  {
                    title: item.name,
                    imageUrl: item.imageUrl,
                    tableNo: tn,
                    orderAmount: qty,
                    category: item.category,
                    type: item.type,
                    price: item.price,
                  },
                ]);
                toast.success("Order sent to kitchen / bar");
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
              "Confirm order"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
