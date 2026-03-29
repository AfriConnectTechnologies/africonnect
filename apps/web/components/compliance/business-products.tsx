"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Package, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { HSCodeSearch, type HSCodeResult } from "./hs-code-search";
import { ComplianceCard } from "./compliance-card";
import { CountrySelector, type TariffCountry } from "./country-selector";

interface BusinessProductsProps {
  showHeader?: boolean;
  maxProducts?: number;
}

export function BusinessProducts({ 
  showHeader = true, 
  maxProducts 
}: BusinessProductsProps) {
  const t = useTranslations("compliance");
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<TariffCountry>("ethiopia");

  const myBusiness = useQuery(api.businesses.getMyBusiness);
  const products = useQuery(api.compliance.getMyBusinessProducts);
  const summary = useQuery(api.compliance.getComplianceSummary);
  const addProduct = useMutation(api.compliance.addBusinessProduct);
  const removeProduct = useMutation(api.compliance.removeBusinessProduct);

  const hasBusiness = !!myBusiness;

  const handleAddProduct = async (result: HSCodeResult) => {
    if (!hasBusiness) {
      toast.info(t("registerToSaveProducts"));
      return;
    }
    setIsAddingProduct(true);
    try {
      await addProduct({
        hsCode: result.hsCode,
        productName: result.englishName,
        productNameAmharic: result.amharicName || undefined,
        isCompliant: result.tariffScheduleStatus === "matched",
        currentRate: result.currentRate,
        rates: JSON.stringify(result.rates),
        country: selectedCountry,
        tariffCategory: result.tariffCategory,
        tariffScheduleStatus: result.tariffScheduleStatus,
        tariffSource: result.tariffSource,
        tariffBaseRate: result.baseRate,
        tariffUnit: result.unit,
      });
      toast.success(t("productAdded"));
      setShowSearch(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("failedToAddProduct");
      toast.error(errorMessage);
    } finally {
      setIsAddingProduct(false);
    }
  };

  const handleRemoveProduct = async (productId: Id<"businessProducts">) => {
    try {
      await removeProduct({ productId });
      toast.success(t("productRemoved"));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("failedToRemoveProduct");
      toast.error(errorMessage);
    }
  };

  const isLoading = products === undefined || summary === undefined;
  const displayProducts = maxProducts && products 
    ? products.slice(0, maxProducts) 
    : products;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {showHeader && summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              {t("complianceSummary")}
            </CardTitle>
            <CardDescription>
              {t("complianceSummaryDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">{summary.totalProducts}</div>
                <div className="text-sm text-muted-foreground">{t("totalProducts")}</div>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {summary.matchedScheduleProducts}
                </div>
                <div className="text-sm text-blue-700 dark:text-blue-300">
                  {t("tariffScheduleMatched")}
                </div>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {summary.unmatchedScheduleProducts}
                </div>
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  {t("tariffScheduleNotMatched")}
                </div>
              </div>
            </div>

            {summary.matchedScheduleProducts > 0 && (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-700 dark:text-amber-300">
                  {t("scheduleMatchMessage", {
                    count: summary.matchedScheduleProducts,
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add Product Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {t("yourProducts")}
              </CardTitle>
              <CardDescription>
                {t("yourProductsDescription")}
              </CardDescription>
            </div>
            {!showSearch && (
              <Button onClick={() => setShowSearch(true)} disabled={isAddingProduct}>
                <Plus className="h-4 w-4 mr-2" />
                {t("addProduct")}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          {showSearch && (
            <div className="p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">{t("addNewProduct")}</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setShowSearch(false)}
                  disabled={isAddingProduct}
                >
                  {t("cancel")}
                </Button>
              </div>
              
              {/* Country Selector */}
              <div className="mb-4 pb-4 border-b">
                <CountrySelector
                  value={selectedCountry}
                  onChange={setSelectedCountry}
                  disabled={isAddingProduct}
                />
              </div>
              
              <HSCodeSearch
                onSelect={handleAddProduct}
                country={selectedCountry}
                disabled={isAddingProduct}
              />
              {isAddingProduct && (
                <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("addingProduct")}
                </div>
              )}
            </div>
          )}

          {/* Product List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayProducts && displayProducts.length > 0 ? (
            <div className="space-y-3">
              {displayProducts.map((product) => (
                <ComplianceCard
                  key={product._id}
                  hsCode={product.hsCode}
                  productName={product.productName}
                  productNameAmharic={product.productNameAmharic}
                  isCompliant={product.isCompliant}
                  currentRate={product.currentRate}
                  rates={product.rates}
                  country={product.country}
                  tariffCategory={product.tariffCategory}
                  tariffScheduleStatus={product.tariffScheduleStatus}
                  tariffSource={product.tariffSource}
                  tariffBaseRate={product.tariffBaseRate}
                  tariffUnit={product.tariffUnit}
                  onRemove={() => handleRemoveProduct(product._id)}
                  compact
                />
              ))}
              
              {maxProducts && products && products.length > maxProducts && (
                <div className="text-center pt-2">
                  <span className="text-sm text-muted-foreground">
                    {t("andMoreProducts", { count: products.length - maxProducts })}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-muted-foreground mb-2">
                {t("noProductsYet")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t("noProductsDescription")}
              </p>
              {!showSearch && (
                <Button onClick={() => setShowSearch(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addFirstProduct")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
