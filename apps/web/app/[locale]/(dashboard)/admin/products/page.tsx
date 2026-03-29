"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { Loader2, Database, ShieldAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useRequireAdmin } from "@/lib/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function AdminProductsPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireAdmin();
  const generateDummyProducts = useMutation(api.products.generateDummyProducts);
  const [count, setCount] = useState("12");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastInserted, setLastInserted] = useState<number | null>(null);

  const handleGenerate = async () => {
    const parsedCount = Number.parseInt(count, 10);
    if (Number.isNaN(parsedCount) || parsedCount < 1 || parsedCount > 100) {
      toast.error("Enter a number between 1 and 100");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateDummyProducts({ count: parsedCount });
      setLastInserted(result.inserted);
      toast.success(`Generated ${result.inserted} dummy product(s)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate dummy products");
    } finally {
      setIsGenerating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Products</h1>
        <p className="text-muted-foreground">
          Generate non-orderable dummy products for demos and testing
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dummy Product Generator
          </CardTitle>
          <CardDescription>
            Generated products are marked as non-orderable and cannot be added to cart.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <label htmlFor="dummy-count" className="text-sm font-medium">
              Number of products
            </label>
            <Input
              id="dummy-count"
              type="number"
              min={1}
              max={100}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>

          <Button onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              "Generate Dummy Products"
            )}
          </Button>

          {lastInserted !== null && (
            <p className="text-sm text-muted-foreground">
              Last run inserted {lastInserted} dummy product(s).
            </p>
          )}

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This tool is intended for admin testing/demo data only. It creates products with
              <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-900/50">
                isOrderable=false
              </code>
              so buyers cannot purchase them.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
