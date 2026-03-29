"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useRequireBank } from "@/lib/hooks/useRole";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, Search } from "lucide-react";

function formatMoney(value: number) {
  return `$${value.toLocaleString()}`;
}

export default function BankPortfolioPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireBank();
  const t = useTranslations("bankPortal");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [country, setCountry] = useState("all");
  const [category, setCategory] = useState("all");

  const portfolio = useQuery(
    api.banks.getMyBankPortfolio,
    isAuthorized
      ? {
          search: search || undefined,
          status: status !== "all" ? (status as never) : undefined,
          country: country !== "all" ? country : undefined,
          category: category !== "all" ? category : undefined,
        }
      : "skip"
  );

  const countries = useMemo(
    () => Array.from(new Set((portfolio ?? []).map((item) => item.business.country))).sort(),
    [portfolio]
  );
  const categories = useMemo(
    () => Array.from(new Set((portfolio ?? []).map((item) => item.business.category))).sort(),
    [portfolio]
  );

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
        <h1 className="text-3xl font-bold tracking-tight">{t("portfolio.heading")}</h1>
        <p className="text-muted-foreground">
          {t("portfolio.description")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("portfolio.title")}</CardTitle>
          <CardDescription>
            {t("portfolio.filtersDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("portfolio.searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue placeholder={t("portfolio.filterByStage")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("portfolio.allStages")}</SelectItem>
                <SelectItem value="generated">{t("stages.generated")}</SelectItem>
                <SelectItem value="signed_up">{t("stages.signed_up")}</SelectItem>
                <SelectItem value="business_created">{t("stages.business_created")}</SelectItem>
                <SelectItem value="verified">{t("stages.verified")}</SelectItem>
                <SelectItem value="active">{t("stages.active")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger>
                <SelectValue placeholder={t("portfolio.country")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("portfolio.allCountries")}</SelectItem>
                {countries.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder={t("portfolio.category")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("portfolio.allCategories")}</SelectItem>
                {categories.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {portfolio === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : portfolio.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t("portfolio.empty")}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("portfolio.columns.business")}</TableHead>
                    <TableHead>{t("portfolio.columns.owner")}</TableHead>
                    <TableHead>{t("portfolio.columns.stage")}</TableHead>
                    <TableHead>{t("portfolio.columns.products")}</TableHead>
                    <TableHead>{t("portfolio.columns.orders")}</TableHead>
                    <TableHead>{t("portfolio.columns.revenue")}</TableHead>
                    <TableHead className="text-right">{t("portfolio.columns.drillDown")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.map((entry) => (
                    <TableRow key={entry.business._id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{entry.business.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {entry.business.category} · {entry.business.country}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span>{entry.owner?.name || t("portfolio.unknownOwner")}</span>
                          <span className="text-xs text-muted-foreground">
                            {entry.owner?.email || t("portfolio.noEmail")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={entry.metrics.isActive ? "default" : "secondary"}>
                          {t(`stages.${entry.metrics.onboardingStage}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.metrics.productCount}</TableCell>
                      <TableCell>{entry.metrics.orderCount}</TableCell>
                      <TableCell>{formatMoney(entry.metrics.revenue)}</TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/bank/portfolio/${entry.business._id}`}>
                            {t("portfolio.view")}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
