"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Search,
  Loader2,
  Building,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ExternalLink,
  Eye,
  FileText,
} from "lucide-react";

type VerificationStatus = "pending" | "verified" | "rejected";

const statusConfig: Record<
  VerificationStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive";
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  pending: {
    label: "Pending",
    variant: "secondary",
    icon: Clock,
  },
  verified: {
    label: "Verified",
    variant: "default",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    variant: "destructive",
    icon: XCircle,
  },
};

export default function AdminBusinessesPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VerificationStatus | "all">(
    "all"
  );
  const [actionDialog, setActionDialog] = useState<{
    businessId: Id<"businesses">;
    businessName: string;
    action: "verify" | "reject";
  } | null>(null);
  const [viewDialogBusiness, setViewDialogBusiness] = useState<
    NonNullable<typeof businesses> extends (infer B)[] ? B | null : null
  >(null);
  const [viewingDocumentUrl, setViewingDocumentUrl] = useState<string | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const documentViewerSrc =
    viewingDocumentUrl &&
    `/api/documents/view?url=${encodeURIComponent(viewingDocumentUrl)}`;

  const businesses = useQuery(
    api.businesses.listBusinesses,
    isAuthorized
      ? {
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery || undefined,
        }
      : "skip"
  );

  const verifyBusiness = useMutation(api.businesses.verifyBusiness);
  const updatePricesToUsd = useMutation(api.subscriptionPlans.updatePricesToUsd);
  const [isMigratingPrices, setIsMigratingPrices] = useState(false);

  const handleVerificationAction = async () => {
    if (!actionDialog) return;

    setIsSubmitting(true);
    try {
      const result = await verifyBusiness({
        businessId: actionDialog.businessId,
        status: actionDialog.action === "verify" ? "verified" : "rejected",
      });

      // Send verification/rejection email to business owner
      if (result?.ownerEmail) {
        const emailType = actionDialog.action === "verify" 
          ? "business-verified" 
          : "business-rejected";
        
        fetch("/api/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: emailType,
            to: result.ownerEmail,
            businessName: actionDialog.businessName,
            ownerName: result.ownerName,
            locale: "en", // Admin panel doesn't have locale context, default to English
          }),
        }).catch((err) => console.error("Failed to send verification email:", err));
      }

      toast.success(
        actionDialog.action === "verify"
          ? "Business verified successfully"
          : "Business rejected"
      );
      setActionDialog(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to update business";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
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
    return null; // Will redirect via hook
  }

  // Count stats
  const pendingCount =
    businesses?.filter((b) => b.verificationStatus === "pending").length ?? 0;
  const verifiedCount =
    businesses?.filter((b) => b.verificationStatus === "verified").length ?? 0;
  const rejectedCount =
    businesses?.filter((b) => b.verificationStatus === "rejected").length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Manage Businesses</h1>
        <p className="text-muted-foreground">
          Review business verification submissions and uploaded documents
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Businesses
            </CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {businesses?.length ?? <Loader2 className="h-6 w-6 animate-spin" />}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Pending Review
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {pendingCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {verifiedCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {rejectedCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Businesses Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Businesses</CardTitle>
          <CardDescription>
            Review business registrations and verify or reject them
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by business name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(v as VerificationStatus | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {businesses === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : businesses.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              {searchQuery || statusFilter !== "all"
                ? "No businesses match your search criteria."
                : "No businesses registered yet."}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Business</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {businesses.map((business) => {
                    const status = statusConfig[business.verificationStatus];
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={business._id}>
                        <TableCell className="max-w-md align-top">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">{business.name}</span>
                            {business.description && (
                              <span className="text-sm text-muted-foreground whitespace-normal break-words">
                                {business.description}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">
                              {business.owner?.name || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {business.owner?.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {business.city
                              ? `${business.city}, ${business.country}`
                              : business.country}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{business.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={status.variant}
                            className="flex w-fit items-center gap-1"
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(business.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setViewDialogBusiness(business)}
                              title="View details and documents"
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View
                            </Button>
                            {business.website && (
                              <Button
                                variant="ghost"
                                size="icon"
                                asChild
                                title="Visit website"
                              >
                                <a
                                  href={business.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                            {business.verificationStatus !== "verified" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActionDialog({
                                    businessId: business._id,
                                    businessName: business.name,
                                    action: "verify",
                                  })
                                }
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Verify
                              </Button>
                            )}
                            {business.verificationStatus !== "rejected" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setActionDialog({
                                    businessId: business._id,
                                    businessName: business.name,
                                    action: "reject",
                                  })
                                }
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Reject
                              </Button>
                            )}
                          </div>
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

      {/* Data Migration: Update plan prices to USD */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Migration</CardTitle>
          <CardDescription>
            Migrate subscription plan prices from ETB to canonical USD values ($29, $79, $149)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            size="sm"
            disabled={isMigratingPrices}
            onClick={async () => {
              setIsMigratingPrices(true);
              try {
                const result = await updatePricesToUsd();
                toast.success(`Updated ${result.updated} plan(s) to USD pricing`);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Migration failed");
              } finally {
                setIsMigratingPrices(false);
              }
            }}
          >
            {isMigratingPrices ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update plan prices to USD"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* View business details and documents dialog */}
      <Dialog
        open={!!viewDialogBusiness}
        onOpenChange={(open) => !open && setViewDialogBusiness(null)}
      >
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-4xl overflow-y-auto p-0 sm:w-[90vw]">
          <DialogHeader className="border-b bg-muted/30 px-6 py-5">
            <DialogTitle className="flex items-center gap-3 text-xl">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold tracking-tight">
                {viewDialogBusiness?.name}
              </span>
            </DialogTitle>
            <DialogDescription className="mt-1 text-base text-muted-foreground">
              Business details and verification documents for review
            </DialogDescription>
          </DialogHeader>
          {viewDialogBusiness && (
            <div className="space-y-0 p-6">
              <section className="rounded-xl border bg-card p-5 shadow-sm">
                <h4 className="mb-4 flex items-center gap-2 border-b pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <Building className="h-4 w-4" />
                  Business information
                </h4>
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  {viewDialogBusiness.description && (
                    <div className="sm:col-span-2">
                      <dt className="mb-0.5 text-muted-foreground">Description</dt>
                      <dd className="rounded-md bg-muted/50 px-3 py-2 text-foreground">
                        {viewDialogBusiness.description}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="mb-0.5 text-muted-foreground">Owner</dt>
                    <dd className="font-medium">
                      {viewDialogBusiness.owner?.name || "—"}
                      <span className="block text-muted-foreground">
                        {viewDialogBusiness.owner?.email || "—"}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-muted-foreground">Location</dt>
                    <dd>
                      {viewDialogBusiness.city
                        ? `${viewDialogBusiness.city}, ${viewDialogBusiness.country}`
                        : viewDialogBusiness.country}
                    </dd>
                  </div>
                  {viewDialogBusiness.address && (
                    <div className="sm:col-span-2">
                      <dt className="mb-0.5 text-muted-foreground">Address</dt>
                      <dd className="rounded-md bg-muted/50 px-3 py-2">
                        {viewDialogBusiness.address}
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="mb-0.5 text-muted-foreground">Category</dt>
                    <dd>
                      <Badge variant="secondary" className="font-medium">
                        {viewDialogBusiness.category}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="mb-0.5 text-muted-foreground">Status</dt>
                    <dd>
                      <Badge
                        variant={
                          statusConfig[viewDialogBusiness.verificationStatus]
                            ?.variant ?? "secondary"
                        }
                        className="font-medium"
                      >
                        {statusConfig[viewDialogBusiness.verificationStatus]?.label ??
                          viewDialogBusiness.verificationStatus}
                      </Badge>
                    </dd>
                  </div>
                  {viewDialogBusiness.phone && (
                    <div>
                      <dt className="mb-0.5 text-muted-foreground">Phone</dt>
                      <dd>{viewDialogBusiness.phone}</dd>
                    </div>
                  )}
                  {viewDialogBusiness.website && (
                    <div>
                      <dt className="mb-0.5 text-muted-foreground">Website</dt>
                      <dd>
                        <a
                          href={viewDialogBusiness.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                        >
                          {viewDialogBusiness.website}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className="mb-0.5 text-muted-foreground">Registered</dt>
                    <dd>
                      {new Date(viewDialogBusiness.createdAt).toLocaleDateString(
                        undefined,
                        {
                          dateStyle: "medium",
                        }
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="rounded-xl border bg-card p-5 shadow-sm">
                <h4 className="mb-4 flex items-center gap-2 border-b pb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  Registration documents
                </h4>
                <dl className="space-y-4 text-sm">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <dt className="mb-1.5 font-medium text-foreground">
                      Business licence
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      {viewDialogBusiness.businessLicenceImageUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            setViewingDocumentUrl(
                              viewDialogBusiness.businessLicenceImageUrl ?? null
                            )
                          }
                        >
                          View document
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                      {viewDialogBusiness.businessLicenceNumber && (
                        <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-xs">
                          {viewDialogBusiness.businessLicenceNumber}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <dt className="mb-1.5 font-medium text-foreground">
                      Memo of association
                    </dt>
                    <dd>
                      {viewDialogBusiness.memoOfAssociationImageUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            setViewingDocumentUrl(
                              viewDialogBusiness.memoOfAssociationImageUrl ?? null
                            )
                          }
                        >
                          View document
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <dt className="mb-1.5 font-medium text-foreground">
                      TIN certificate
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      {viewDialogBusiness.tinCertificateImageUrl ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() =>
                            setViewingDocumentUrl(
                              viewDialogBusiness.tinCertificateImageUrl ?? null
                            )
                          }
                        >
                          View document
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">Not provided</span>
                      )}
                      {viewDialogBusiness.tinCertificateNumber && (
                        <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-xs">
                          {viewDialogBusiness.tinCertificateNumber}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <dt className="mb-1.5 font-medium text-foreground">
                      Import/export permit (foreign)
                      {viewDialogBusiness.hasImportExportPermit !== undefined && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          — {viewDialogBusiness.hasImportExportPermit ? "Yes" : "No"}
                        </span>
                      )}
                    </dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      {viewDialogBusiness.hasImportExportPermit &&
                      viewDialogBusiness.importExportPermitImageUrl ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() =>
                              setViewingDocumentUrl(
                                viewDialogBusiness.importExportPermitImageUrl ??
                                  null
                              )
                            }
                          >
                            View document
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                          {viewDialogBusiness.importExportPermitNumber && (
                            <span className="rounded-md border bg-background px-2.5 py-1 font-mono text-xs">
                              {viewDialogBusiness.importExportPermitNumber}
                            </span>
                          )}
                        </>
                      ) : viewDialogBusiness.hasImportExportPermit ? (
                        <span className="text-muted-foreground">Not provided</span>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Document viewer dialog – renders document in-page via proxy */}
      <Dialog
        open={!!viewingDocumentUrl}
        onOpenChange={(open) => !open && setViewingDocumentUrl(null)}
      >
        <DialogContent className="flex h-[85vh] max-h-[85vh] w-[90vw] max-w-4xl flex-col">
          <DialogHeader>
            <DialogTitle>Document</DialogTitle>
            <DialogDescription>
              Viewing document (served from storage)
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 rounded-md border bg-muted/30">
            {documentViewerSrc && (
              <iframe
                title="Document viewer"
                src={documentViewerSrc}
                className="h-full w-full rounded-md border-0"
                style={{ minHeight: "70vh" }}
              />
            )}
          </div>
          <div className="flex justify-end border-t pt-2">
            <Button
              variant="outline"
              onClick={() => setViewingDocumentUrl(null)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!actionDialog}
        onOpenChange={(open) => !open && setActionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "verify"
                ? "Approve Verification"
                : "Reject Verification"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "verify"
                ? `Are you sure you want to approve "${actionDialog?.businessName}"? This will verify the business and unlock buying access for the owner.`
                : `Are you sure you want to reject "${actionDialog?.businessName}"? They will need to update their information and documents to resubmit.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialog(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={actionDialog?.action === "verify" ? "default" : "destructive"}
              onClick={handleVerificationAction}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : actionDialog?.action === "verify" ? (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Approve Verification
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject Verification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
