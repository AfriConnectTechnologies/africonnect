"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useRequireAdmin } from "@/lib/hooks/useRole";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, Link2, Loader2, UserPlus, Users } from "lucide-react";

export default function AdminBanksPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireAdmin();
  const t = useTranslations("adminBanks");
  const [bankName, setBankName] = useState("");
  const [bankDescription, setBankDescription] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedBankId, setSelectedBankId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const banks = useQuery(api.banks.listBanks, isAuthorized ? {} : "skip");
  const users = useQuery(
    api.users.listUsers,
    isAuthorized
      ? {
          search: userSearch || undefined,
        }
      : "skip"
  );

  const createBank = useMutation(api.banks.createBank);
  const assignUserToBank = useMutation(api.banks.assignUserToBank);

  const assignableUsers = useMemo(
    () => (users ?? []).filter((user) => user.role !== "admin"),
    [users]
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
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("description")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.partnerBanks")}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{banks?.length ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.bankUsers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {banks?.reduce((sum, bank) => sum + bank.bankUsersCount, 0) ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("stats.trackedReferrals")}</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {banks?.reduce((sum, bank) => sum + bank.referralsCount, 0) ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("createBank.title")}</CardTitle>
            <CardDescription>
              {t("createBank.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder={t("createBank.namePlaceholder")}
              value={bankName}
              onChange={(event) => setBankName(event.target.value)}
            />
            <Input
              placeholder={t("createBank.descriptionPlaceholder")}
              value={bankDescription}
              onChange={(event) => setBankDescription(event.target.value)}
            />
            <Button
              disabled={isCreating || !bankName.trim()}
              onClick={async () => {
                setIsCreating(true);
                try {
                  await createBank({
                    name: bankName.trim(),
                    description: bankDescription.trim() || undefined,
                  });
                  setBankName("");
                  setBankDescription("");
                  toast.success(t("createBank.success"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("createBank.error"));
                } finally {
                  setIsCreating(false);
                }
              }}
            >
              {isCreating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("createBank.creating")}
                </>
              ) : (
                t("createBank.action")
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("assignUser.title")}</CardTitle>
            <CardDescription>
              {t("assignUser.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder={t("assignUser.searchPlaceholder")}
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
            />
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder={t("assignUser.selectUser")} />
              </SelectTrigger>
              <SelectContent>
                {assignableUsers.map((user) => (
                  <SelectItem key={user._id} value={user._id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedBankId} onValueChange={setSelectedBankId}>
              <SelectTrigger>
                <SelectValue placeholder={t("assignUser.selectBank")} />
              </SelectTrigger>
              <SelectContent>
                {(banks ?? []).map((bank) => (
                  <SelectItem key={bank._id} value={bank._id}>
                    {bank.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={isAssigning || !selectedUserId || !selectedBankId}
              onClick={async () => {
                setIsAssigning(true);
                try {
                  await assignUserToBank({
                    userId: selectedUserId as never,
                    bankId: selectedBankId as never,
                  });
                  setSelectedUserId("");
                  toast.success(t("assignUser.success"));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("assignUser.error"));
                } finally {
                  setIsAssigning(false);
                }
              }}
            >
              {isAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("assignUser.assigning")}
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("assignUser.action")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("directory.title")}</CardTitle>
          <CardDescription>
            {t("directory.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {banks === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : banks.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {t("directory.empty")}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("directory.columns.bank")}</TableHead>
                    <TableHead>{t("directory.columns.status")}</TableHead>
                    <TableHead>{t("directory.columns.referralPrefix")}</TableHead>
                    <TableHead>{t("directory.columns.users")}</TableHead>
                    <TableHead>{t("directory.columns.referrals")}</TableHead>
                    <TableHead>{t("directory.columns.portfolio")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banks.map((bank) => (
                    <TableRow key={bank._id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{bank.name}</span>
                          <span className="text-xs text-muted-foreground">{bank.slug}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={bank.status === "active" ? "default" : "secondary"}>
                          {bank.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {bank.referralCodePrefix}
                      </TableCell>
                      <TableCell>{bank.bankUsersCount}</TableCell>
                      <TableCell>{bank.referralsCount}</TableCell>
                      <TableCell>{bank.portfolioCount}</TableCell>
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
