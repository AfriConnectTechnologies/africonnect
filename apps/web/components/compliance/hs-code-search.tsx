"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Loader2, Plus } from "lucide-react";
import type { TariffCountry } from "./country-selector";

export interface HSCodeResult {
  hsCode: string;
  englishName: string;
  amharicName: string;
  category: string;
  rates: {
    "2026": string;
    "2027": string;
    "2028": string;
    "2029": string;
    "2030": string;
  };
  currentRate: string;
  baseRate?: string;
  unit?: string;
  tariffCategory?: string;
  tariffScheduleStatus?: "matched" | "not_matched";
  tariffSource?: string;
}

interface HSCodeSearchProps {
  onSelect: (result: HSCodeResult) => void;
  country: TariffCountry;
  disabled?: boolean;
  placeholder?: string;
}

export function HSCodeSearch({ onSelect, country, disabled, placeholder }: HSCodeSearchProps) {
  const t = useTranslations("compliance");
  const locale = useLocale();
  
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HSCodeResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [mode, setMode] = useState<"search" | "manual">("manual");
  const [manualHsCode, setManualHsCode] = useState("");
  const [manualLookupResult, setManualLookupResult] = useState<HSCodeResult | null>(null);
  const [manualLookupLoading, setManualLookupLoading] = useState(false);
  const [manualNotFound, setManualNotFound] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset results when country changes
  useEffect(() => {
    setResults([]);
    setIsOpen(false);
    setManualLookupResult(null);
    setManualNotFound(false);
  }, [country]);

  // Debounced search
  useEffect(() => {
    if (mode !== "search" || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/compliance/search?q=${encodeURIComponent(query)}&limit=10&country=${country}`
        );
        const data = await response.json();
        if (data.success && data.results) {
          setResults(data.results);
          setIsOpen(data.results.length > 0);
        }
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, mode, country]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback((result: HSCodeResult) => {
    onSelect(result);
    setQuery("");
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
  }, [onSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleManualLookup = async () => {
    if (!manualHsCode || manualHsCode.length < 4) return;

    setManualLookupLoading(true);
    setManualNotFound(false);
    setManualLookupResult(null);

    try {
      const response = await fetch(
        `/api/compliance/search?hs_code=${encodeURIComponent(manualHsCode)}&country=${country}`
      );
      const data = await response.json();
      
      if (data.success && data.data) {
        const result: HSCodeResult = {
          hsCode: data.data.hs_code,
          englishName: data.data.english_name,
          amharicName: data.data.amharic_name || "",
          category: data.data.category,
          rates: data.data.rates,
          currentRate: data.data.rates["2026"],
          baseRate: data.data.base_rate,
          unit: data.data.unit,
          tariffCategory: data.data.category,
          tariffScheduleStatus: data.tariffScheduleStatus || "matched",
          tariffSource: data.tariffSource,
        };
        setManualLookupResult(result);
        setManualNotFound(result.tariffScheduleStatus !== "matched");
      } else {
        setManualLookupResult({
          hsCode: manualHsCode,
          englishName: "Custom Product",
          amharicName: "",
          category: "N/A",
          rates: { "2026": "N/A", "2027": "N/A", "2028": "N/A", "2029": "N/A", "2030": "N/A" },
          currentRate: "N/A",
          tariffCategory: "N/A",
          tariffScheduleStatus: "not_matched",
          tariffSource: data.tariffSource,
        });
        setManualNotFound(true);
      }
    } catch (error) {
      console.error("Lookup error:", error);
      setManualNotFound(true);
    } finally {
      setManualLookupLoading(false);
    }
  };

  const handleAddManualResult = () => {
    if (manualLookupResult) {
      onSelect(manualLookupResult);
      setManualHsCode("");
      setManualLookupResult(null);
    }
  };

  const getDisplayName = (result: HSCodeResult) => {
    // Only show Amharic name for Ethiopia and if available
    if (country === "ethiopia" && locale === "am" && result.amharicName) {
      return result.amharicName;
    }
    return result.englishName;
  };

  const manualLookupMatched = manualLookupResult?.tariffScheduleStatus === "matched";

  return (
    <div className="space-y-4">
      {/* Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "manual" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("manual")}
          disabled={disabled}
        >
          {t("enterHsCode")}
        </Button>
        <Button
          type="button"
          variant={mode === "search" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("search")}
          disabled={disabled}
        >
          <Search className="mr-2 h-4 w-4" />
          {t("searchByName")}
        </Button>
      </div>

      {/* Search Mode */}
      {mode === "search" && (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder || t("searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => results.length > 0 && setIsOpen(true)}
              disabled={disabled}
              className="pl-10 pr-10"
            />
            {isLoading && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Dropdown Results */}
          {isOpen && results.length > 0 && (
            <div
              ref={dropdownRef}
              className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-lg"
            >
              <ul className="max-h-60 overflow-auto py-1">
                {results.map((result, index) => (
                  <li
                    key={result.hsCode}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3 py-2 hover:bg-accent",
                      selectedIndex === index && "bg-accent"
                    )}
                    onClick={() => handleSelect(result)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {getDisplayName(result)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        HS: {result.hsCode}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-medium text-green-600 dark:text-green-400">
                        {t("rate")}: {result.currentRate}%
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Manual HS Code Entry Mode */}
      {mode === "manual" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="text"
                placeholder={t("hsCodePlaceholder")}
                value={manualHsCode}
                onChange={(e) => {
                  setManualHsCode(e.target.value);
                  setManualNotFound(false);
                  setManualLookupResult(null);
                }}
                disabled={disabled}
                maxLength={12}
              />
            </div>
            <Button
              type="button"
              onClick={handleManualLookup}
              disabled={disabled || manualHsCode.length < 4 || manualLookupLoading}
            >
              {manualLookupLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("lookup")
              )}
            </Button>
          </div>

          {/* Lookup Result */}
          {manualLookupResult && manualLookupMatched && (
            <div className="rounded-md border bg-green-50 dark:bg-green-950/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-sm">
                    {getDisplayName(manualLookupResult)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    HS: {manualLookupResult.hsCode} | {t("tariffScheduleMatched")}
                  </div>
                  <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {t("currentRate")}: {manualLookupResult.currentRate}%
                  </div>
                  {manualLookupResult.baseRate && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("baseRate")}: {manualLookupResult.baseRate}%
                    </div>
                  )}
                  {manualLookupResult.tariffSource && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {t("ruleSource")}: {manualLookupResult.tariffSource}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddManualResult}
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("add")}
                </Button>
              </div>
            </div>
          )}

          {/* Not Found */}
          {manualNotFound && (
            <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {manualLookupResult ? (
                    <>
                      <div className="font-medium text-sm text-amber-800 dark:text-amber-200">
                        {getDisplayName(manualLookupResult)}
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        HS: {manualLookupResult.hsCode} | {t("tariffScheduleNotMatched")}
                      </div>
                      {manualLookupResult.tariffSource && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {t("ruleSource")}: {manualLookupResult.tariffSource}
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="font-medium text-sm text-amber-800 dark:text-amber-200">
                        {t("notFoundInTariffSchedule")}
                      </div>
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        {t("notFoundDescription")}
                      </div>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleAddManualResult}
                  disabled={disabled}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {t("addAnyway")}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
