"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Calculator,
  ArrowRight,
  ArrowLeft,
  Check,
  Info,
  Loader2,
  Package,
  DollarSign,
  RotateCcw,
} from "lucide-react";
import { OriginResultCard } from "./origin-result-card";

interface CalculatorData {
  productName: string;
  // Step 1: EXW components
  costOfMaterials: number;
  laborCosts: number;
  factoryOverheads: number;
  profitMargin: number;
  // Step 2: VNM
  nonOriginatingMaterials: number;
  // Currency
  currency: string;
}

const initialData: CalculatorData = {
  productName: "",
  costOfMaterials: 0,
  laborCosts: 0,
  factoryOverheads: 0,
  profitMargin: 0,
  nonOriginatingMaterials: 0,
  currency: "ETB",
};

const currencies = [
  { value: "ETB", label: "ETB (Ethiopian Birr)" },
  { value: "USD", label: "USD (US Dollar)" },
  { value: "EUR", label: "EUR (Euro)" },
  { value: "KES", label: "KES (Kenyan Shilling)" },
  { value: "NGN", label: "NGN (Nigerian Naira)" },
  { value: "ZAR", label: "ZAR (South African Rand)" },
];

interface OriginEligibilityCalculatorProps {
  showHeader?: boolean;
}

export function OriginEligibilityCalculator({
  showHeader = true,
}: OriginEligibilityCalculatorProps) {
  const t = useTranslations("originEligibility");
  const tCommon = useTranslations("common");

  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<CalculatorData>(initialData);
  const [showCalculator, setShowCalculator] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);

  const myBusiness = useQuery(api.businesses.getMyBusiness);
  const summary = useQuery(api.originCalculations.getOriginCalculationsSummary);
  const calculations = useQuery(api.originCalculations.getMyOriginCalculations);
  const saveCalculation = useMutation(api.originCalculations.saveOriginCalculation);
  const deleteCalculation = useMutation(api.originCalculations.deleteOriginCalculation);

  const hasBusiness = !!myBusiness;

  // Calculations
  const exWorksPrice =
    data.costOfMaterials +
    data.laborCosts +
    data.factoryOverheads +
    data.profitMargin;

  const vnmPercentage =
    exWorksPrice > 0
      ? Math.round((data.nonOriginatingMaterials / exWorksPrice) * 10000) / 100
      : 0;

  const isEligible = vnmPercentage <= 60;

  const steps = [
    { title: t("step1Title"), description: t("step1Description") },
    { title: t("step2Title"), description: t("step2Description") },
    { title: t("step3Title"), description: t("formulaExplanation") },
    { title: t("step4Title"), description: t("resultDescription") },
  ];

  const handleInputChange = (field: keyof CalculatorData, value: string | number) => {
    setData((prev) => ({
      ...prev,
      [field]: typeof value === "string" && field !== "productName" && field !== "currency" 
        ? parseFloat(value) || 0 
        : value,
    }));
  };

  const canProceedFromStep = (step: number) => {
    switch (step) {
      case 0:
        return (
          data.productName.trim() !== "" &&
          data.costOfMaterials > 0
        );
      case 1:
        return data.nonOriginatingMaterials >= 0;
      case 2:
        return exWorksPrice > 0;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleSave = async () => {
    if (!hasBusiness) {
      toast.info(t("registerToSaveCalculation"));
      return;
    }
    setIsSaving(true);
    try {
      await saveCalculation({
        productName: data.productName,
        costOfMaterials: data.costOfMaterials,
        laborCosts: data.laborCosts,
        factoryOverheads: data.factoryOverheads,
        profitMargin: data.profitMargin,
        nonOriginatingMaterials: data.nonOriginatingMaterials,
        currency: data.currency,
      });
      toast.success(t("calculationSaved"));
      setHasSaved(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("failedToSave");
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setData(initialData);
    setCurrentStep(0);
    setShowCalculator(false);
    setHasSaved(false);
  };

  const handleDeleteCalculation = async (calculationId: Id<"originCalculations">) => {
    try {
      await deleteCalculation({ calculationId });
      toast.success(t("calculationDeleted"));
    } catch {
      toast.error(t("failedToDelete"));
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  // Show summary and start button when calculator is not active
  if (!showCalculator) {
    return (
      <div className="space-y-6">
        {/* Summary Card */}
        {showHeader && summary && (
          <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                <Calculator className="h-5 w-5" />
                {t("title")}
              </CardTitle>
              <CardDescription className="text-purple-700 dark:text-purple-300">
                {t("description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* What is the 60% Rule */}
              <div className="rounded-lg bg-white dark:bg-purple-900/20 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-sm">{t("whatIsTheRule")}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("ruleExplanation")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Stats */}
              {summary.hasCalculations && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-white dark:bg-purple-900/20">
                    <div className="text-xl font-bold">{summary.totalCalculations}</div>
                    <div className="text-xs text-muted-foreground">{t("totalCalculations")}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {summary.eligibleCount}
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300">
                      {t("eligible")}
                    </div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {summary.notEligibleCount}
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">
                      {t("notEligible")}
                    </div>
                  </div>
                </div>
              )}

              <Button onClick={() => setShowCalculator(true)} className="w-full">
                <Calculator className="h-4 w-4 mr-2" />
                {t("startCalculation")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Previous Calculations List */}
        {calculations && calculations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("previousCalculations")}</CardTitle>
              <CardDescription>{t("previousCalculationsDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {calculations.slice(0, 5).map((calc) => (
                  <OriginResultCard
                    key={calc._id}
                    productName={calc.productName}
                    exWorksPrice={calc.exWorksPrice}
                    nonOriginatingMaterials={calc.nonOriginatingMaterials}
                    vnmPercentage={calc.vnmPercentage}
                    isEligible={calc.isEligible}
                    currency={calc.currency}
                    compact
                    showDelete
                    onDelete={() => handleDeleteCalculation(calc._id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription>{t("description")}</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {t("reset")}
          </Button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mt-6">
          {steps.map((step, index) => (
            <div key={index} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                  index < currentStep
                    ? "bg-green-600 text-white"
                    : index === currentStep
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {index < currentStep ? (
                  <Check className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "w-12 sm:w-20 h-1 mx-2",
                    index < currentStep ? "bg-green-600" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Current Step Title */}
        <div className="mt-4">
          <h3 className="font-medium">{steps[currentStep].title}</h3>
          <p className="text-sm text-muted-foreground">
            {steps[currentStep].description}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Step 1: Ex-Works Price */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="productName">{t("productName")}</Label>
                <Input
                  id="productName"
                  placeholder={t("productNamePlaceholder")}
                  value={data.productName}
                  onChange={(e) => handleInputChange("productName", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">{t("currency")}</Label>
                <Select
                  value={data.currency}
                  onValueChange={(value) => handleInputChange("currency", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.value} value={currency.value}>
                        {currency.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="costOfMaterials">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {t("costOfMaterials")}
                    </span>
                  </Label>
                  <Input
                    id="costOfMaterials"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={data.costOfMaterials || ""}
                    onChange={(e) => handleInputChange("costOfMaterials", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("costOfMaterialsHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="laborCosts">{t("laborCosts")}</Label>
                  <Input
                    id="laborCosts"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={data.laborCosts || ""}
                    onChange={(e) => handleInputChange("laborCosts", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("laborCostsHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factoryOverheads">{t("factoryOverheads")}</Label>
                  <Input
                    id="factoryOverheads"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={data.factoryOverheads || ""}
                    onChange={(e) => handleInputChange("factoryOverheads", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("factoryOverheadsHint")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profitMargin">{t("profitMargin")}</Label>
                  <Input
                    id="profitMargin"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={data.profitMargin || ""}
                    onChange={(e) => handleInputChange("profitMargin", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">{t("profitMarginHint")}</p>
                </div>
              </div>
            </div>

            {/* Running Total */}
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{t("totalExWorks")}</span>
                <span className="text-xl font-bold">
                  {data.currency} {formatCurrency(exWorksPrice)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Non-originating Materials */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/30 p-4 mb-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm text-blue-800 dark:text-blue-200">
                    {t("vnmExplanationTitle")}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {t("vnmExplanation")}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nonOriginatingMaterials">
                <span className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {t("vnmValue")}
                </span>
              </Label>
              <Input
                id="nonOriginatingMaterials"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={data.nonOriginatingMaterials || ""}
                onChange={(e) => handleInputChange("nonOriginatingMaterials", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t("vnmValueHint")}</p>
            </div>

            {/* Summary So Far */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("totalExWorks")}</span>
                <span className="font-medium">
                  {data.currency} {formatCurrency(exWorksPrice)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t("vnmValue")}</span>
                <span className="font-medium">
                  {data.currency} {formatCurrency(data.nonOriginatingMaterials)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Formula Application */}
        {currentStep === 2 && (
          <div className="space-y-6">
            {/* Formula Display */}
            <div className="rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-6 text-center">
              <div className="text-sm text-muted-foreground mb-2">{t("formula")}</div>
              <div className="text-lg font-mono font-medium">
                % VNM = (VNM ÷ EXW) × 100
              </div>
            </div>

            {/* Calculation Breakdown */}
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="text-xs text-muted-foreground mb-1">VNM</div>
                  <div className="font-bold">
                    {data.currency} {formatCurrency(data.nonOriginatingMaterials)}
                  </div>
                </div>
                <div className="flex items-center justify-center text-2xl text-muted-foreground">
                  ÷
                </div>
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="text-xs text-muted-foreground mb-1">EXW</div>
                  <div className="font-bold">
                    {data.currency} {formatCurrency(exWorksPrice)}
                  </div>
                </div>
              </div>

              <div className="text-center text-2xl text-muted-foreground">× 100</div>

              <div
                className={cn(
                  "rounded-lg p-6 text-center",
                  isEligible
                    ? "bg-green-50 dark:bg-green-950/30"
                    : "bg-amber-50 dark:bg-amber-950/30"
                )}
              >
                <div className="text-sm text-muted-foreground mb-1">{t("result")}</div>
                <div
                  className={cn(
                    "text-4xl font-bold",
                    isEligible
                      ? "text-green-600 dark:text-green-400"
                      : "text-amber-600 dark:text-amber-400"
                  )}
                >
                  {vnmPercentage}%
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  {t("maxThreshold")}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Result */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <OriginResultCard
              productName={data.productName}
              exWorksPrice={exWorksPrice}
              nonOriginatingMaterials={data.nonOriginatingMaterials}
              vnmPercentage={vnmPercentage}
              isEligible={isEligible}
              currency={data.currency}
            />

            {/* Save Button – requires business to save */}
            {!hasSaved && (
              <div className="space-y-2">
                <Button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="w-full"
                  size="lg"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {t("saving")}
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      {t("saveCalculation")}
                    </>
                  )}
                </Button>
                {!hasBusiness && (
                  <p className="text-center text-xs text-muted-foreground">
                    {t("registerToSaveCalculation")}
                  </p>
                )}
              </div>
            )}

            {hasSaved && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 p-4 text-center">
                <Check className="h-8 w-8 mx-auto text-green-600 dark:text-green-400 mb-2" />
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {t("calculationSaved")}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {tCommon("back")}
          </Button>

          {currentStep < steps.length - 1 ? (
            <Button
              onClick={handleNext}
              disabled={!canProceedFromStep(currentStep)}
            >
              {tCommon("next")}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("newCalculation")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
