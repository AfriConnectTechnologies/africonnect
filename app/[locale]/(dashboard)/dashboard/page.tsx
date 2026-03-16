"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { ShoppingCart, DollarSign, Clock, CheckCircle2, Search, TrendingUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { WelcomeHeader } from "@/components/dashboard/WelcomeHeader";
import { CategoryChips } from "@/components/dashboard/CategoryChips";
import { ProductGrid } from "@/components/dashboard/ProductGrid";

const STAT_CONFIG = [
  { key: "totalOrders", icon: ShoppingCart, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40" },
  { key: "totalRevenue", icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
  { key: "pendingOrders", icon: Clock, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40" },
  { key: "completedOrders", icon: CheckCircle2, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" },
] as const;

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const tOrders = useTranslations("orders");
  
  const ensureUser = useMutation(api.users.ensureUser);
  const stats = useQuery(api.stats.getDashboardStats);
  
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const products = useQuery(api.products.marketplace, {
    search: debouncedSearch || undefined,
    category: selectedCategory === "all" ? undefined : selectedCategory,
  });

  useEffect(() => {
    ensureUser().catch(() => {});
  }, [ensureUser]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
  };

  const formatStatValue = (key: string, stats: { totalOrders: number; totalRevenue: number; pendingOrders: number; completedOrders: number }) => {
    if (key === "totalRevenue") return `$${stats.totalRevenue.toLocaleString()}`;
    return stats[key as keyof typeof stats].toLocaleString();
  };

  const getStatLabel = (key: string) => {
    if (key === "completedOrders") return tOrders("completed");
    return t(key);
  };

  return (
    <div className="space-y-8">
      <WelcomeHeader />

      {/* Stats Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats === undefined
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border bg-card p-4 animate-pulse">
                <div className="h-10 w-10 rounded-lg bg-muted shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-3 w-16 rounded bg-muted" />
                  <div className="h-6 w-12 rounded bg-muted" />
                </div>
              </div>
            ))
          : STAT_CONFIG.map(({ key, icon: Icon, color, bg }) => (
              <div
                key={key}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {getStatLabel(key)}
                  </p>
                  <p className="truncate text-xl font-bold tabular-nums tracking-tight">
                    {formatStatValue(key, stats)}
                  </p>
                </div>
              </div>
            ))}
        <Link
          href="/orders"
          className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-dashed bg-card/50 p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:col-span-4"
        >
          <TrendingUp className="h-4 w-4" />
          {tOrders("title")}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-12 pl-12 pr-4 rounded-xl bg-card border text-base"
        />
      </div>

      <CategoryChips
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">
              {selectedCategory === "all" ? t("discoverProducts") : selectedCategory}
            </h2>
            <p className="text-sm text-muted-foreground">
              {products?.length ?? 0} products available
            </p>
          </div>
          <Link href="/marketplace">
            <Button variant="ghost" size="sm">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <ProductGrid products={products} isLoading={products === undefined} />
      </div>
    </div>
  );
}
