"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@africonnect/convex/_generated/api";
import type { Id } from "@africonnect/convex/_generated/dataModel";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, History, Plus, Minus, PackageSearch } from "lucide-react";
import { toast } from "sonner";

type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

const statusBadge: Record<StockStatus, "default" | "secondary" | "destructive"> = {
  in_stock: "default",
  low_stock: "secondary",
  out_of_stock: "destructive",
};

export default function InventoryPage() {
  const t = useTranslations("inventory");
  const tCommon = useTranslations("common");
  const tToast = useTranslations("toast");
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | "all">("all");
  const [adjustProductId, setAdjustProductId] = useState<Id<"products"> | null>(null);
  const [historyProductId, setHistoryProductId] = useState<Id<"products"> | null>(null);
  const [thresholdProductId, setThresholdProductId] = useState<Id<"products"> | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"restock" | "adjustment" | "return" | "correction">("restock");
  const [lowStockThreshold, setLowStockThreshold] = useState("");
  const [reorderQuantity, setReorderQuantity] = useState("");

  const currentUser = useQuery(api.users.getCurrentUser);
  const isSeller = currentUser?.role === "seller" || currentUser?.role === "admin";
  const inventory = useQuery(
    api.inventory.list,
    currentUser && isSeller
      ? {
          status: statusFilter === "all" ? undefined : statusFilter,
        }
      : "skip"
  );
  const activityTransactions = useQuery(
    api.inventory.getTransactions,
    currentUser && isSeller ? { limit: 50 } : "skip"
  );
  const productTransactions = useQuery(
    api.inventory.getTransactions,
    currentUser && isSeller && historyProductId
      ? { productId: historyProductId, limit: 20 }
      : "skip"
  );

  const adjustStock = useMutation(api.inventory.adjustStock);
  const updateThresholds = useMutation(api.inventory.updateThresholds);
  const isInventoryLoading = inventory === undefined;
  const isActivityLoading = activityTransactions === undefined;

  useEffect(() => {
    if (currentUser !== undefined && !isSeller) {
      router.push("/business/profile");
    }
  }, [currentUser, isSeller, router]);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter((item) => {
      return (
        item.name.toLowerCase().includes(query) ||
        item.sku?.toLowerCase().includes(query)
      );
    });
  }, [inventory, searchQuery]);

  const summary = useMemo(() => {
    if (!inventory) {
      return {
        totalProducts: 0,
        totalUnits: 0,
        lowStock: 0,
        outOfStock: 0,
      };
    }
    return inventory.reduce(
      (acc, item) => {
        acc.totalProducts += 1;
        acc.totalUnits += item.quantity;
        if (item.stockStatus === "low_stock") acc.lowStock += 1;
        if (item.stockStatus === "out_of_stock") acc.outOfStock += 1;
        return acc;
      },
      { totalProducts: 0, totalUnits: 0, lowStock: 0, outOfStock: 0 }
    );
  }, [inventory]);

  const resetAdjustDialog = () => {
    setAdjustDelta("");
    setAdjustReason("");
    setAdjustType("restock");
    setAdjustProductId(null);
  };

  const handleAdjust = async () => {
    if (!adjustProductId) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      toast.error(t("invalidAdjustment"));
      return;
    }
    try {
      await adjustStock({
        productId: adjustProductId,
        delta,
        reason: adjustReason || undefined,
        type: adjustType,
      });
      toast.success(t("adjustmentSaved"));
      resetAdjustDialog();
    } catch (error) {
      const message = error instanceof Error ? error.message : tToast("failedToUpdate");
      toast.error(message);
    }
  };

  const handleOpenThresholds = (
    productId: Id<"products">,
    currentThreshold?: number,
    currentReorder?: number
  ) => {
    setThresholdProductId(productId);
    setLowStockThreshold(currentThreshold?.toString() ?? "");
    setReorderQuantity(currentReorder?.toString() ?? "");
  };

  const handleSaveThresholds = async () => {
    if (!thresholdProductId) return;
    const thresholdValue = lowStockThreshold === "" ? undefined : Number(lowStockThreshold);
    const reorderValue = reorderQuantity === "" ? undefined : Number(reorderQuantity);
    if (thresholdValue !== undefined && thresholdValue < 0) {
      toast.error(t("invalidThreshold"));
      return;
    }
    if (reorderValue !== undefined && reorderValue < 0) {
      toast.error(t("invalidReorder"));
      return;
    }
    try {
      await updateThresholds({
        productId: thresholdProductId,
        lowStockThreshold: thresholdValue,
        reorderQuantity: reorderValue,
      });
      toast.success(t("thresholdsSaved"));
      setThresholdProductId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : tToast("failedToUpdate");
      toast.error(message);
    }
  };

  if (currentUser !== undefined && !isSeller) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.totalProducts")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.totalProducts}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.totalUnits")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.totalUnits}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.lowStock")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.lowStock}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t("summary.outOfStock")}</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{summary.outOfStock}</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="inventory" className="space-y-4">
        <TabsList>
          <TabsTrigger value="inventory">{t("tabs.inventory")}</TabsTrigger>
          <TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Input
                placeholder={t("searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-72"
              />
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StockStatus | "all")}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder={t("filterStatus")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tCommon("all")}</SelectItem>
                  <SelectItem value="in_stock">{t("status.inStock")}</SelectItem>
                  <SelectItem value="low_stock">{t("status.lowStock")}</SelectItem>
                  <SelectItem value="out_of_stock">{t("status.outOfStock")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.product")}</TableHead>
                    <TableHead>{t("table.sku")}</TableHead>
                    <TableHead className="text-right">{t("table.onHand")}</TableHead>
                    <TableHead className="text-right">{t("table.threshold")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                    <TableHead className="text-right">{t("table.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isInventoryLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {tCommon("loading")}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isInventoryLoading && filteredInventory.map((item) => (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.sku ? item.sku : t("noSku")}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{item.lowStockThreshold ?? 0}</TableCell>
                      <TableCell>
                      <Badge variant={statusBadge[item.stockStatus]}>
                        {t(`status.${item.stockStatus}`)}
                      </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setAdjustProductId(item._id)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            {t("actions.adjust")}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenThresholds(item._id, item.lowStockThreshold, item.reorderQuantity)}
                          >
                            <PackageSearch className="h-4 w-4" />
                            <span className="sr-only">{t("actions.thresholds")}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setHistoryProductId(item._id)}
                          >
                            <History className="h-4 w-4" />
                            <span className="sr-only">{t("actions.history")}</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isInventoryLoading && filteredInventory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>{t("activityTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("activity.date")}</TableHead>
                    <TableHead>{t("activity.product")}</TableHead>
                    <TableHead>{t("activity.type")}</TableHead>
                    <TableHead className="text-right">{t("activity.quantity")}</TableHead>
                    <TableHead className="text-right">{t("activity.newQuantity")}</TableHead>
                    <TableHead>{t("activity.reason")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isActivityLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {tCommon("loading")}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isActivityLoading && (activityTransactions ?? []).map((tx) => (
                    <TableRow key={tx._id}>
                      <TableCell>
                        {new Date(tx.createdAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {tx.productName
                          ? `${tx.productName}${tx.productSku ? ` (${tx.productSku})` : ""}`
                          : tx.productId}
                      </TableCell>
                      <TableCell>{t(`types.${tx.type}`)}</TableCell>
                      <TableCell className="text-right">{tx.direction === "out" ? "-" : "+"}{tx.quantity}</TableCell>
                      <TableCell className="text-right">{tx.newQuantity}</TableCell>
                      <TableCell>{tx.reason ?? t("activity.none")}</TableCell>
                    </TableRow>
                  ))}
                  {!isActivityLoading && (activityTransactions ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                        {t("activity.empty")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={adjustProductId !== null} onOpenChange={(open) => !open && resetAdjustDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("adjustDialog.title")}</DialogTitle>
            <DialogDescription>{t("adjustDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="adjustType">{t("adjustDialog.type")}</Label>
              <Select value={adjustType} onValueChange={(value) => setAdjustType(value as typeof adjustType)}>
                <SelectTrigger id="adjustType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restock">{t("types.restock")}</SelectItem>
                  <SelectItem value="adjustment">{t("types.adjustment")}</SelectItem>
                  <SelectItem value="return">{t("types.return")}</SelectItem>
                  <SelectItem value="correction">{t("types.correction")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustDelta">{t("adjustDialog.delta")}</Label>
              <Input
                id="adjustDelta"
                type="number"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(e.target.value)}
                placeholder={t("adjustDialog.deltaPlaceholder")}
              />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAdjustDelta("1")}>
                  <Plus className="mr-1 h-4 w-4" />
                  {t("adjustDialog.quickAdd")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAdjustDelta("-1")}>
                  <Minus className="mr-1 h-4 w-4" />
                  {t("adjustDialog.quickRemove")}
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjustReason">{t("adjustDialog.reason")}</Label>
              <Input
                id="adjustReason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={t("adjustDialog.reasonPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAdjustDialog}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleAdjust}>{t("adjustDialog.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyProductId !== null} onOpenChange={(open) => !open && setHistoryProductId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{t("historyDialog.title")}</DialogTitle>
            <DialogDescription>{t("historyDialog.description")}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("activity.date")}</TableHead>
                <TableHead>{t("activity.type")}</TableHead>
                <TableHead className="text-right">{t("activity.quantity")}</TableHead>
                <TableHead className="text-right">{t("activity.newQuantity")}</TableHead>
                <TableHead>{t("activity.reason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(productTransactions ?? []).map((tx) => (
                <TableRow key={tx._id}>
                  <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{t(`types.${tx.type}`)}</TableCell>
                  <TableCell className="text-right">{tx.direction === "out" ? "-" : "+"}{tx.quantity}</TableCell>
                  <TableCell className="text-right">{tx.newQuantity}</TableCell>
                  <TableCell>{tx.reason ?? t("activity.none")}</TableCell>
                </TableRow>
              ))}
              {(productTransactions ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t("activity.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <Dialog open={thresholdProductId !== null} onOpenChange={(open) => !open && setThresholdProductId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("thresholdDialog.title")}</DialogTitle>
            <DialogDescription>{t("thresholdDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="lowStockThreshold">{t("thresholdDialog.lowStock")}</Label>
              <Input
                id="lowStockThreshold"
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder={t("thresholdDialog.lowStockPlaceholder")}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="reorderQuantity">{t("thresholdDialog.reorder")}</Label>
              <Input
                id="reorderQuantity"
                type="number"
                value={reorderQuantity}
                onChange={(e) => setReorderQuantity(e.target.value)}
                placeholder={t("thresholdDialog.reorderPlaceholder")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setThresholdProductId(null)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSaveThresholds}>{t("thresholdDialog.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
