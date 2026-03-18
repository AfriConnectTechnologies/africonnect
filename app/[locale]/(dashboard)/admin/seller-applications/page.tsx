"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
  CheckCircle2,
  Clock,
  Loader2,
  Search,
  Shield,
  Store,
  XCircle,
} from "lucide-react";

type SellerApplicationStatus = "pending" | "approved" | "rejected";

const statusConfig: Record<
  SellerApplicationStatus,
  { label: string; variant: "default" | "secondary" | "destructive" }
> = {
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
};

export default function AdminSellerApplicationsPage() {
  const { isLoading: authLoading, isAuthorized } = useRequireAdmin();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SellerApplicationStatus | "all">(
    "all"
  );
  const [actionDialog, setActionDialog] = useState<{
    userId: Id<"users">;
    name: string;
    action: "approve" | "reject";
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const applications = useQuery(
    api.users.listSellerApplications,
    isAuthorized
      ? {
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: searchQuery || undefined,
        }
      : "skip"
  );
  const reviewSellerApplication = useMutation(api.users.reviewSellerApplication);

  const handleReview = async () => {
    if (!actionDialog) return;

    setIsSubmitting(true);
    try {
      await reviewSellerApplication({
        userId: actionDialog.userId,
        status: actionDialog.action === "approve" ? "approved" : "rejected",
      });
      toast.success(
        actionDialog.action === "approve"
          ? "Seller application approved"
          : "Seller application rejected"
      );
      setActionDialog(null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to review seller application";
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
    return null;
  }

  const pendingCount =
    applications?.filter(
      (application) => application.effectiveSellerApplicationStatus === "pending"
    )
      .length ?? 0;
  const approvedCount =
    applications?.filter(
      (application) => application.effectiveSellerApplicationStatus === "approved"
    )
      .length ?? 0;
  const rejectedCount =
    applications?.filter(
      (application) => application.effectiveSellerApplicationStatus === "rejected"
    )
      .length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Seller Applications</h1>
        <p className="text-muted-foreground">
          Review verified businesses that have applied to sell on the marketplace
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{approvedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{rejectedCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Applications</CardTitle>
          <CardDescription>
            Seller approval is separate from business verification. Review only seller access here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by business owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as SellerApplicationStatus | "all")
              }
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {applications === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : applications.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No seller applications match your filters.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map((application) => {
                    const status =
                      statusConfig[
                        application.effectiveSellerApplicationStatus as SellerApplicationStatus
                      ];

                    return (
                      <TableRow key={application._id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {application.name || "Unknown"}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {application.email}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {application.business?.name || "No business"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {application.business?.verificationStatus === "verified"
                                  ? "Business verified"
                                  : "Business not verified"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {application.sellerApplicationSubmittedAt
                            ? new Date(
                                application.sellerApplicationSubmittedAt
                              ).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {application.effectiveSellerApplicationStatus !== "approved" && (
                              <Button
                                size="sm"
                                onClick={() =>
                                  setActionDialog({
                                    userId: application._id,
                                    name: application.name || application.email,
                                    action: "approve",
                                  })
                                }
                              >
                                <CheckCircle2 className="mr-1 h-4 w-4" />
                                Approve
                              </Button>
                            )}
                            {application.effectiveSellerApplicationStatus !== "rejected" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setActionDialog({
                                    userId: application._id,
                                    name: application.name || application.email,
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

      <Dialog
        open={!!actionDialog}
        onOpenChange={(open) => !open && setActionDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approve"
                ? "Approve seller application"
                : "Reject seller application"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === "approve"
                ? `Approve seller access for "${actionDialog?.name}"? This will grant marketplace selling permissions.`
                : `Reject seller access for "${actionDialog?.name}"? They can apply again later from their business profile.`}
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
              variant={actionDialog?.action === "approve" ? "default" : "destructive"}
              onClick={handleReview}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : actionDialog?.action === "approve" ? (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Approve seller access
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject application
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
