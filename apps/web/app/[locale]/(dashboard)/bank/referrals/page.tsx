"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { useRequireBank } from "@/lib/hooks/useRole";
import { useLocale, useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Copy, Link2, Loader2, MailPlus } from "lucide-react";

export default function BankReferralsPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireBank();
  const locale = useLocale();
  const t = useTranslations("bankPortal");
  const [companyName, setCompanyName] = useState("");
  const [invitedEmail, setInvitedEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const referralsData = useQuery(api.banks.getMyBankReferrals, isAuthorized ? {} : "skip");
  const createReferral = useMutation(api.banks.createReferral);

  const baseUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }
    return `${window.location.origin}/${locale}/sign-up?bank_ref=`;
  }, [locale]);

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

  const referrals = referralsData?.referrals ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("referrals.title")}</h1>
        <p className="text-muted-foreground">
          {t("referrals.description")}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("referrals.create.title")}</CardTitle>
            <CardDescription>
              {t("referrals.create.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder={t("referrals.create.organizationPlaceholder")}
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
            />
            <Input
              placeholder={t("referrals.create.emailPlaceholder")}
              value={invitedEmail}
              onChange={(event) => setInvitedEmail(event.target.value)}
            />
            <Input
              placeholder={t("referrals.create.notesPlaceholder")}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
            <Button
              disabled={isSubmitting || (!companyName.trim() && !invitedEmail.trim())}
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const created = await createReferral({
                    companyName: companyName.trim() || undefined,
                    invitedEmail: invitedEmail.trim() || undefined,
                    notes: notes.trim() || undefined,
                  });
                  setCompanyName("");
                  setInvitedEmail("");
                  setNotes("");
                  toast.success(t("referrals.create.success", { code: created?.referralCode ?? "" }));
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : t("referrals.create.error"));
                } finally {
                  setIsSubmitting(false);
                }
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("referrals.create.creating")}
                </>
              ) : (
                <>
                  <MailPlus className="mr-2 h-4 w-4" />
                  {t("referrals.create.action")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("referrals.playbook.title")}</CardTitle>
            <CardDescription>
              {t("referrals.playbook.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-lg border p-4">
              <p className="font-medium text-foreground">{t("referrals.playbook.howItWorks")}</p>
              <p className="mt-2">{t("referrals.playbook.step1")}</p>
              <p>{t("referrals.playbook.step2")}</p>
              <p>{t("referrals.playbook.step3")}</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="font-medium text-foreground">{t("referrals.playbook.defaultSignupBase")}</p>
              <p className="mt-2 font-mono text-xs break-all">
                {baseUrl || t("referrals.playbook.baseUrlFallback")}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("referrals.register.title")}</CardTitle>
          <CardDescription>
            {t("referrals.register.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referralsData === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              {t("referrals.register.empty")}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("referrals.register.columns.lead")}</TableHead>
                    <TableHead>{t("referrals.register.columns.referralCode")}</TableHead>
                    <TableHead>{t("referrals.register.columns.status")}</TableHead>
                    <TableHead>{t("referrals.register.columns.linkedSme")}</TableHead>
                    <TableHead>{t("referrals.register.columns.created")}</TableHead>
                    <TableHead className="text-right">{t("referrals.register.columns.copyLink")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map((referral) => {
                    const signupLink = `${baseUrl}${referral.referralCode}`;
                    return (
                      <TableRow key={referral._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {referral.companyName || referral.invitedEmail || t("referrals.unnamedLead")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {referral.invitedEmail || referral.notes || t("referrals.noExtraMetadata")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {referral.referralCode}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t(`stages.${referral.effectiveStatus}`)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {referral.business?.name || referral.acceptedUser?.email || "-"}
                        </TableCell>
                        <TableCell>
                          {new Date(referral.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            aria-label={t("referrals.register.columns.copyLink")}
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(signupLink);
                                toast.success(t("referrals.register.copySuccess"));
                              } catch {
                                toast.error(t("referrals.register.copyError"));
                              }
                            }}
                          >
                            <Copy className="mr-2 h-4 w-4" />
                            <Link2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
