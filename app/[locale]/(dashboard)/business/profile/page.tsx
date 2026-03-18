"use client";

import { useState, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentUpload } from "@/components/business";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  MapPin,
  Phone,
  Globe,
  CheckCircle2,
  Clock,
  XCircle,
  Pencil,
  Shield,
  ArrowRight,
  Landmark,
  FileText,
} from "lucide-react";
import { useRouter as useNextIntlRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { isComplianceEnabledForEmail } from "@/lib/features";

// African countries list
const AFRICAN_COUNTRIES = [
  "Algeria",
  "Angola",
  "Benin",
  "Botswana",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cameroon",
  "Central African Republic",
  "Chad",
  "Comoros",
  "Congo (DRC)",
  "Congo (Republic)",
  "Cote d'Ivoire",
  "Djibouti",
  "Egypt",
  "Equatorial Guinea",
  "Eritrea",
  "Eswatini",
  "Ethiopia",
  "Gabon",
  "Gambia",
  "Ghana",
  "Guinea",
  "Guinea-Bissau",
  "Kenya",
  "Lesotho",
  "Liberia",
  "Libya",
  "Madagascar",
  "Malawi",
  "Mali",
  "Mauritania",
  "Mauritius",
  "Morocco",
  "Mozambique",
  "Namibia",
  "Niger",
  "Nigeria",
  "Rwanda",
  "Sao Tome and Principe",
  "Senegal",
  "Seychelles",
  "Sierra Leone",
  "Somalia",
  "South Africa",
  "South Sudan",
  "Sudan",
  "Tanzania",
  "Togo",
  "Tunisia",
  "Uganda",
  "Zambia",
  "Zimbabwe",
];

// Business categories
const BUSINESS_CATEGORIES = [
  "Agriculture & Farming",
  "Manufacturing",
  "Technology & IT",
  "Construction & Real Estate",
  "Energy & Utilities",
  "Healthcare & Pharmaceuticals",
  "Education & Training",
  "Financial Services",
  "Retail & E-commerce",
  "Transportation & Logistics",
  "Hospitality & Tourism",
  "Media & Entertainment",
  "Professional Services",
  "Mining & Natural Resources",
  "Textile & Fashion",
  "Food & Beverage",
  "Telecommunications",
  "Other",
];

const getNullableDocumentUpdate = (
  currentValue: string | null,
  existingValue?: string | null
) => {
  if (currentValue === null) {
    return existingValue ? null : undefined;
  }

  return currentValue;
};

const getNullableTextUpdate = (
  currentValue: string,
  existingValue?: string | null
) => {
  if (currentValue) {
    return currentValue;
  }

  return existingValue ? null : undefined;
};

const getOptionalBooleanUpdate = (
  currentValue: "" | "yes" | "no" | boolean
): boolean | undefined => {
  if (currentValue === "") {
    return undefined;
  }

  if (currentValue === "yes") {
    return true;
  }

  if (currentValue === "no") {
    return false;
  }

  return currentValue;
};

export default function BusinessProfilePage() {
  const intlRouter = useNextIntlRouter();
  const tBusiness = useTranslations("business");
  const tCommon = useTranslations("common");
  const tNavigation = useTranslations("navigation");
  const tCompliance = useTranslations("compliance");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [country, setCountry] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [businessLicenceImageUrl, setBusinessLicenceImageUrl] = useState<string | null>(null);
  const [businessLicenceNumber, setBusinessLicenceNumber] = useState("");
  const [memoOfAssociationImageUrl, setMemoOfAssociationImageUrl] = useState<string | null>(null);
  const [tinCertificateImageUrl, setTinCertificateImageUrl] = useState<string | null>(null);
  const [tinCertificateNumber, setTinCertificateNumber] = useState("");
  const [hasImportExportPermit, setHasImportExportPermit] = useState<"" | "yes" | "no">("");
  const [importExportPermitImageUrl, setImportExportPermitImageUrl] = useState<string | null>(null);
  const [importExportPermitNumber, setImportExportPermitNumber] = useState("");
  const [banks, setBanks] = useState<Array<{ name: string; code: string }>>([]);
  const [loadingBanks, setLoadingBanks] = useState(false);
  const [payoutBankCode, setPayoutBankCode] = useState("");
  const [payoutBankName, setPayoutBankName] = useState("");
  const [payoutAccountNumber, setPayoutAccountNumber] = useState("");
  const [payoutAccountName, setPayoutAccountName] = useState("");
  const [savingPayout, setSavingPayout] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser);
  const business = useQuery(api.businesses.getMyBusiness);
  const isComplianceEnabled = isComplianceEnabledForEmail(currentUser?.email);
  const complianceSummary = useQuery(
    api.compliance.getComplianceSummary,
    isComplianceEnabled ? undefined : "skip"
  );
  const updateBusiness = useMutation(api.businesses.updateBusiness);
  const updatePayoutSettings = useMutation(api.businesses.updatePayoutSettings);
  const statusConfig = {
    pending: {
      label: tBusiness("verificationStatus.pending"),
      variant: "secondary" as const,
      icon: Clock,
      color: "text-yellow-600",
    },
    verified: {
      label: tBusiness("verificationStatus.verified"),
      variant: "default" as const,
      icon: CheckCircle2,
      color: "text-green-600",
    },
    rejected: {
      label: tBusiness("verificationStatus.rejected"),
      variant: "destructive" as const,
      icon: XCircle,
      color: "text-red-600",
    },
  };
  const sellerApplicationStatusConfig = {
    not_applied: {
      label: tBusiness("sellerStatus.not_applied"),
      variant: "outline" as const,
    },
    pending: {
      label: tBusiness("sellerStatus.pending"),
      variant: "secondary" as const,
    },
    approved: {
      label: tBusiness("sellerStatus.approved"),
      variant: "default" as const,
    },
    rejected: {
      label: tBusiness("sellerStatus.rejected"),
      variant: "destructive" as const,
    },
  };

  // Compute effective values - prefer state (for edits), fallback to business data
  const businessData = business as typeof business & { payoutBankName?: string };
  const effectiveBankCode = payoutBankCode || business?.payoutBankCode || "";
  const effectiveBankName = payoutBankName || businessData?.payoutBankName || "";
  const effectiveAccountName = payoutAccountName || business?.payoutAccountName || "";
  const effectiveAccountNumber = payoutAccountNumber || business?.payoutAccountNumber || "";
  const selectedBankName = effectiveBankName || 
    (effectiveBankCode ? banks.find((b) => String(b.code) === String(effectiveBankCode))?.name : undefined);

  const resetFieldsFromBusiness = useCallback(() => {
    if (!business) {
      return;
    }

    const biz = business as typeof business & { payoutBankName?: string };
    setCountry(business.country);
    setCategory(business.category);
    setBusinessLicenceImageUrl(business.businessLicenceImageUrl || null);
    setBusinessLicenceNumber(business.businessLicenceNumber || "");
    setMemoOfAssociationImageUrl(business.memoOfAssociationImageUrl || null);
    setTinCertificateImageUrl(business.tinCertificateImageUrl || null);
    setTinCertificateNumber(business.tinCertificateNumber || "");
    setHasImportExportPermit(
      business.hasImportExportPermit === undefined
        ? ""
        : business.hasImportExportPermit
          ? "yes"
          : "no"
    );
    setImportExportPermitImageUrl(business.importExportPermitImageUrl || null);
    setImportExportPermitNumber(business.importExportPermitNumber || "");
    setPayoutBankCode(business.payoutBankCode || "");
    setPayoutBankName(biz.payoutBankName || "");
    setPayoutAccountNumber(business.payoutAccountNumber || "");
    setPayoutAccountName(business.payoutAccountName || "");
  }, [business]);

  // Redirect if user doesn't have a business
  useEffect(() => {
    if (currentUser !== undefined && !currentUser?.businessId) {
      intlRouter.push("/business/verify");
    }
  }, [currentUser, intlRouter]);

  // Reset editable fields from saved business data when needed
  useEffect(() => {
    if (business && isEditing) {
      resetFieldsFromBusiness();
    }
  }, [business, isEditing, resetFieldsFromBusiness]);

  useEffect(() => {
    const loadBanks = async () => {
      setLoadingBanks(true);
      try {
        const response = await fetch("/api/payouts/banks");
        const data = await response.json();
        const rawBanks =
          data?.data?.data ||
          data?.data ||
          data?.banks ||
          data?.bank;

        const normalized = Array.isArray(rawBanks)
          ? rawBanks
              .map((bank) => ({
                name: bank.name || bank.bank_name || bank.bankName || bank.bank || "",
                code: bank.code || bank.id || bank.bank_code || "",
              }))
              .filter((bank) => bank.name && bank.code)
          : [];

        setBanks(normalized);
      } catch (error) {
        console.error("Failed to load banks", error);
        setBanks([]);
      } finally {
        setLoadingBanks(false);
      }
    };

    loadBanks();
  }, []);

  // Update bank name when banks load and we have a code but no name
  useEffect(() => {
    if (payoutBankCode && !payoutBankName && banks.length > 0) {
      const bank = banks.find((b) => String(b.code) === String(payoutBankCode));
      if (bank) {
        setPayoutBankName(bank.name);
      }
    }
  }, [banks, payoutBankCode, payoutBankName]);

  // Handler for bank selection
  const handleBankSelect = (code: string) => {
    setPayoutBankCode(code);
    const bank = banks.find((b) => b.code === code);
    setPayoutBankName(bank?.name || "");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!business) return;

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    try {
      const hasPermit = getOptionalBooleanUpdate(hasImportExportPermit);
      await updateBusiness({
        name: formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
        country: country,
        city: (formData.get("city") as string) || undefined,
        address: (formData.get("address") as string) || undefined,
        phone: (formData.get("phone") as string) || undefined,
        website: (formData.get("website") as string) || undefined,
        category: category,
        businessLicenceImageUrl: getNullableDocumentUpdate(
          businessLicenceImageUrl,
          business.businessLicenceImageUrl
        ),
        businessLicenceNumber: getNullableTextUpdate(
          businessLicenceNumber,
          business.businessLicenceNumber
        ),
        memoOfAssociationImageUrl: getNullableDocumentUpdate(
          memoOfAssociationImageUrl,
          business.memoOfAssociationImageUrl
        ),
        tinCertificateImageUrl: getNullableDocumentUpdate(
          tinCertificateImageUrl,
          business.tinCertificateImageUrl
        ),
        tinCertificateNumber: getNullableTextUpdate(
          tinCertificateNumber,
          business.tinCertificateNumber
        ),
        hasImportExportPermit: hasPermit,
        importExportPermitImageUrl: hasPermit === true
          ? getNullableDocumentUpdate(
              importExportPermitImageUrl,
              business.importExportPermitImageUrl
            )
          : hasPermit === false
            ? business.importExportPermitImageUrl
              ? null
              : undefined
            : undefined,
        importExportPermitNumber: hasPermit === true
          ? getNullableTextUpdate(
              importExportPermitNumber,
              business.importExportPermitNumber
            )
          : hasPermit === false
            ? business.importExportPermitNumber
              ? null
              : undefined
            : undefined,
      });

      toast.success(tBusiness("profile.profileUpdated"));
      setIsEditing(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : tBusiness("profile.profileUpdateFailed");
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSavePayoutSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (savingPayout) return;

    setSavingPayout(true);
    try {
      await updatePayoutSettings({
        payoutBankCode: effectiveBankCode,
        payoutBankName: effectiveBankName || selectedBankName || "",
        payoutAccountNumber: effectiveAccountNumber,
        payoutAccountName: effectiveAccountName,
      });
      toast.success(tBusiness("profile.payoutSettingsUpdated"));
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : tBusiness("profile.payoutSettingsUpdateFailed");
      toast.error(errorMessage);
    } finally {
      setSavingPayout(false);
    }
  };

  if (currentUser === undefined || business === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!business) {
    return null; // Will redirect via useEffect
  }

  const status = statusConfig[business.verificationStatus];
  const StatusIcon = status.icon;
  const canAccessCompliance =
    (currentUser?.emailVerified ?? false) && business.verificationStatus === "verified";
  const isSellerAccess =
    currentUser?.role === "seller" || currentUser?.role === "admin";
  const sellerApplicationStatus =
    isSellerAccess ? "approved" : currentUser?.sellerApplicationStatus ?? "not_applied";
  const sellerStatus = sellerApplicationStatusConfig[sellerApplicationStatus];
  const verificationStatusMessage =
    business.verificationStatus === "pending"
      ? tBusiness("profile.verificationPendingMessage")
      : business.verificationStatus === "verified"
        ? tBusiness("profile.verificationVerifiedMessage")
        : tBusiness("profile.verificationRejectedMessage");
  const sellerApplicationStatusMessage =
    business.verificationStatus !== "verified"
      ? tBusiness("profile.sellerRequiresVerifiedMessage")
      : sellerApplicationStatus === "approved"
        ? tBusiness("profile.sellerApprovedMessage")
        : sellerApplicationStatus === "pending"
          ? tBusiness("profile.sellerPendingMessage")
          : sellerApplicationStatus === "rejected"
            ? tBusiness("profile.sellerRejectedMessage")
            : tBusiness("profile.sellerReadyMessage");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{tNavigation("myBusiness")}</h1>
          <p className="text-muted-foreground">
            {isSellerAccess
              ? tBusiness("profile.sellerDescription")
              : tBusiness("profile.buyerDescription")}
          </p>
        </div>
        {!isEditing && (
          <Button
            onClick={() => {
              resetFieldsFromBusiness();
              setIsEditing(true);
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {tBusiness("profile.editProfile")}
          </Button>
        )}
      </div>

      {/* Verification Status Card */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className={`rounded-full p-2 ${status.color} bg-muted`}>
            <StatusIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{tBusiness("businessVerificationStatusTitle")}</h3>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{verificationStatusMessage}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="rounded-full bg-muted p-2 text-primary">
            <Shield className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{tBusiness("sellerApplicationCardTitle")}</h3>
              <Badge variant={sellerStatus.variant}>{sellerStatus.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{sellerApplicationStatusMessage}</p>
          </div>
          {business.verificationStatus === "verified" && !isSellerAccess && (
            <Button onClick={() => intlRouter.push("/business/register")}>
              {sellerApplicationStatus === "rejected"
                ? tBusiness("sellerApplicationReapply")
                : tBusiness("sellerApplicationApply")}
            </Button>
          )}
          {isSellerAccess && (
            <Button variant="outline" onClick={() => intlRouter.push("/products")}>
              {tBusiness("sellerApplicationManageProducts")}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Business Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {tBusiness("profile.businessProfileTitle")}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? tBusiness("profile.editDescription")
              : tBusiness("profile.viewDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">{tBusiness("businessName")} *</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={business.name}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">{tBusiness("description")}</Label>
                  <Input
                    id="description"
                    name="description"
                    defaultValue={business.description || ""}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="country">{tBusiness("country")} *</Label>
                    <Select
                      value={country}
                      onValueChange={setCountry}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger id="country">
                        <SelectValue placeholder={tBusiness("selectCountry")} />
                      </SelectTrigger>
                      <SelectContent>
                        {AFRICAN_COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="city">{tBusiness("city")}</Label>
                    <Input
                      id="city"
                      name="city"
                      defaultValue={business.city || ""}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="address">{tBusiness("address")}</Label>
                  <Input
                    id="address"
                    name="address"
                    defaultValue={business.address || ""}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">{tBusiness("category")} *</Label>
                  <Select
                    value={category}
                    onValueChange={setCategory}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder={tBusiness("selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="phone">{tBusiness("phone")}</Label>
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      defaultValue={business.phone || ""}
                      disabled={isSubmitting}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="website">{tBusiness("website")}</Label>
                    <Input
                      id="website"
                      name="website"
                      type="url"
                      defaultValue={business.website || ""}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-4 w-4" />
                      {tBusiness("buyerVerificationDocumentsTitle")}
                    </CardTitle>
                    <CardDescription>
                      {business.verificationStatus === "rejected"
                        ? tBusiness("profile.verificationDocumentsRejectedDescription")
                        : tBusiness("profile.verificationDocumentsDescription")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-2">
                      <Label>{tBusiness("businessLicence")}</Label>
                      <DocumentUpload
                        docType="business-licence"
                        existingUrl={businessLicenceImageUrl}
                        onUploadComplete={setBusinessLicenceImageUrl}
                        onClear={() => {
                          setBusinessLicenceImageUrl(null);
                          setBusinessLicenceNumber("");
                        }}
                        disabled={isSubmitting}
                      />
                      <Input
                        name="businessLicenceNumber"
                        placeholder={tBusiness("businessLicenceNumberPlaceholder")}
                        value={businessLicenceNumber}
                        onChange={(e) => setBusinessLicenceNumber(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>{tBusiness("memoOfAssociation")}</Label>
                      <DocumentUpload
                        docType="memo-of-association"
                        existingUrl={memoOfAssociationImageUrl}
                        onUploadComplete={setMemoOfAssociationImageUrl}
                        onClear={() => setMemoOfAssociationImageUrl(null)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>{tBusiness("tinCertificate")}</Label>
                      <DocumentUpload
                        docType="tin-certificate"
                        existingUrl={tinCertificateImageUrl}
                        onUploadComplete={setTinCertificateImageUrl}
                        onClear={() => {
                          setTinCertificateImageUrl(null);
                          setTinCertificateNumber("");
                        }}
                        disabled={isSubmitting}
                      />
                      <Input
                        name="tinCertificateNumber"
                        placeholder={tBusiness("tinCertificateNumberPlaceholder")}
                        value={tinCertificateNumber}
                        onChange={(e) => setTinCertificateNumber(e.target.value)}
                        disabled={isSubmitting}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="hasImportExportPermit">
                        {tBusiness("hasImportExportPermit")}
                      </Label>
                      <Select
                        value={hasImportExportPermit}
                        onValueChange={(value) =>
                          setHasImportExportPermit(value as "" | "yes" | "no")
                        }
                        disabled={isSubmitting}
                      >
                        <SelectTrigger id="hasImportExportPermit">
                          <SelectValue placeholder={tBusiness("hasImportExportPermitPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">{tBusiness("hasImportExportPermitYes")}</SelectItem>
                          <SelectItem value="no">{tBusiness("hasImportExportPermitNo")}</SelectItem>
                        </SelectContent>
                      </Select>

                      {hasImportExportPermit === "yes" && (
                        <div className="space-y-2 rounded-lg border p-4">
                          <Label>{tBusiness("importExportPermit")}</Label>
                          <DocumentUpload
                            docType="import-export-permit"
                            existingUrl={importExportPermitImageUrl}
                            onUploadComplete={setImportExportPermitImageUrl}
                            onClear={() => {
                              setImportExportPermitImageUrl(null);
                              setImportExportPermitNumber("");
                            }}
                            disabled={isSubmitting}
                          />
                          <Input
                            name="importExportPermitNumber"
                            placeholder={tBusiness("importExportPermitNumberPlaceholder")}
                            value={importExportPermitNumber}
                            onChange={(e) => setImportExportPermitNumber(e.target.value)}
                            disabled={isSubmitting}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetFieldsFromBusiness();
                    setIsEditing(false);
                  }}
                  disabled={isSubmitting}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {tBusiness("profile.saving")}
                    </>
                  ) : (
                    tBusiness("profile.saveChanges")
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold">{business.name}</h3>
                {business.description && (
                  <p className="mt-1 text-muted-foreground">
                    {business.description}
                  </p>
                )}
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {tBusiness("category")}
                  </p>
                  <p className="font-medium">{business.category}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {tBusiness("profile.location")}
                  </p>
                  <p className="flex items-center gap-1 font-medium">
                    <MapPin className="h-4 w-4" />
                    {business.city
                      ? `${business.city}, ${business.country}`
                      : business.country}
                  </p>
                </div>

                {business.address && (
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      {tBusiness("address")}
                    </p>
                    <p className="font-medium">{business.address}</p>
                  </div>
                )}

                {business.phone && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {tBusiness("phone")}
                    </p>
                    <p className="flex items-center gap-1 font-medium">
                      <Phone className="h-4 w-4" />
                      {business.phone}
                    </p>
                  </div>
                )}

                {business.website && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {tBusiness("website")}
                    </p>
                    <a
                      href={business.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <Globe className="h-4 w-4" />
                      {business.website}
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{tBusiness("buyerVerificationDocumentsTitle")}</h4>
                  {business.verificationStatus === "rejected" && (
                    <Badge variant="outline">{tBusiness("profile.resubmitBadge")}</Badge>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">{tBusiness("businessLicence")}</p>
                    <p className="text-sm text-muted-foreground">
                      {business.businessLicenceImageUrl
                        ? tBusiness("profile.documentUploaded")
                        : tBusiness("profile.documentMissing")}
                    </p>
                    {business.businessLicenceNumber && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tBusiness("profile.licenceNumber", {
                          number: business.businessLicenceNumber,
                        })}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">{tBusiness("memoOfAssociation")}</p>
                    <p className="text-sm text-muted-foreground">
                      {business.memoOfAssociationImageUrl
                        ? tBusiness("profile.documentUploaded")
                        : tBusiness("profile.documentMissing")}
                    </p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">{tBusiness("tinCertificate")}</p>
                    <p className="text-sm text-muted-foreground">
                      {business.tinCertificateImageUrl
                        ? tBusiness("profile.documentUploaded")
                        : tBusiness("profile.documentMissing")}
                    </p>
                    {business.tinCertificateNumber && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tBusiness("profile.tinNumber", {
                          number: business.tinCertificateNumber,
                        })}
                      </p>
                    )}
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-sm font-medium">{tBusiness("importExportPermit")}</p>
                    <p className="text-sm text-muted-foreground">
                      {business.hasImportExportPermit
                        ? business.importExportPermitImageUrl
                          ? tBusiness("profile.permitUploaded")
                          : tBusiness("profile.permitMissing")
                        : tBusiness("profile.notProvided")}
                    </p>
                    {business.importExportPermitNumber && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {tBusiness("profile.permitNumber", {
                          number: business.importExportPermitNumber,
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="flex gap-4 text-sm text-muted-foreground">
                <p>
                  {tCommon("created")}:{" "}
                  {new Date(business.createdAt).toLocaleDateString()}
                </p>
                <p>
                  {tCommon("updated")}:{" "}
                  {new Date(business.updatedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {isSellerAccess && (
        <>
          {/* Payout Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Landmark className="h-5 w-5" />
                {tBusiness("profile.payoutSettingsTitle")}
              </CardTitle>
              <CardDescription>
                {tBusiness("profile.payoutSettingsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePayoutSettings} className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="payoutBank">{tBusiness("profile.bank")} *</Label>
                  <Select
                    value={effectiveBankCode}
                    onValueChange={handleBankSelect}
                    disabled={loadingBanks || savingPayout}
                  >
                    <SelectTrigger id="payoutBank" className="w-full">
                      <SelectValue
                        placeholder={
                          loadingBanks
                            ? tBusiness("profile.loadingBanks")
                            : tBusiness("profile.selectBank")
                        }
                      >
                        {selectedBankName}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((bank) => (
                        <SelectItem key={bank.code} value={bank.code}>
                          {bank.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!loadingBanks && banks.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {tBusiness("profile.unableToLoadBanks")}
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payoutAccountName">{tBusiness("profile.accountName")} *</Label>
                  <Input
                    id="payoutAccountName"
                    value={effectiveAccountName}
                    onChange={(e) => setPayoutAccountName(e.target.value)}
                    disabled={savingPayout}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="payoutAccountNumber">
                    {tBusiness("profile.accountNumber")} *
                  </Label>
                  <Input
                    id="payoutAccountNumber"
                    value={effectiveAccountNumber}
                    onChange={(e) => setPayoutAccountNumber(e.target.value)}
                    disabled={savingPayout}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    {business.payoutEnabled
                      ? tBusiness("profile.payoutEnabled")
                      : tBusiness("profile.payoutNotEnabled")}
                  </div>
                  <Button
                    type="submit"
                    disabled={
                      savingPayout ||
                      !effectiveBankCode ||
                      !effectiveAccountNumber ||
                      !effectiveAccountName
                    }
                  >
                    {savingPayout ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {tBusiness("profile.saving")}
                      </>
                    ) : (
                      tBusiness("profile.savePayoutSettings")
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {tBusiness("profile.creditProfileTitle")}
              </CardTitle>
              <CardDescription>
                {tBusiness("profile.creditProfileDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                {tBusiness("profile.creditProfileAvailability")}
              </p>
              <Button
                type="button"
                variant="outline"
                onClick={() => intlRouter.push("/business/credit-profile")}
              >
                {tBusiness("profile.openCreditProfile")}
              </Button>
            </CardContent>
          </Card>

          {/* AfCFTA Compliance Section */}
          {canAccessCompliance && isComplianceEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {tCompliance("afcftaCompliance")}
            </CardTitle>
            <CardDescription>
              {tCompliance("afcftaComplianceDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {complianceSummary === undefined ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : complianceSummary.totalProducts === 0 ? (
              <div className="text-center py-4">
                <p className="text-muted-foreground mb-4">
                  {tCompliance("noComplianceCheckYet")}
                </p>
                <Button onClick={() => intlRouter.push("/compliance")}>
                  {tCompliance("startComplianceCheck")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <div className="text-xl font-bold">{complianceSummary.totalProducts}</div>
                    <div className="text-xs text-muted-foreground">{tCompliance("totalProducts")}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
                    <div className="text-xl font-bold text-green-600 dark:text-green-400">
                      {complianceSummary.compliantProducts}
                    </div>
                    <div className="text-xs text-green-700 dark:text-green-300">{tCompliance("eligible")}</div>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                    <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      {complianceSummary.nonCompliantProducts}
                    </div>
                    <div className="text-xs text-amber-700 dark:text-amber-300">{tCompliance("notEligible")}</div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => intlRouter.push("/compliance")}
                >
                  {tCompliance("manageProducts")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
          )}
        </>
      )}
    </div>
  );
}
