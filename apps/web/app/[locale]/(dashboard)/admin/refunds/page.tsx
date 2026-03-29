"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Loader2, AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";

interface Payment {
  _id: Id<"payments">;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  paymentType: string;
  chapaTransactionRef: string;
  chapaTrxRef?: string;
  metadata?: string;
  refundedAt?: number;
  refundAmount?: number;
  refundReason?: string;
  createdAt: number;
  user?: {
    name?: string;
    email?: string;
  } | null;
}

export default function RefundsPage() {
  const [isRefunding, setIsRefunding] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");

  const payments = useQuery(api.payments.listSubscriptionPayments, { limit: 100 });
  const currentUser = useQuery(api.users.getCurrentUser);

  // Check if user is admin
  if (currentUser && currentUser.role !== "admin") {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              You do not have permission to access this page.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (amount: number, currency: string) => {
    if (currency === "ETB") {
      return `${amount.toLocaleString()} ETB`;
    }
    return `$${amount.toFixed(2)}`;
  };

  const getStatusBadge = (payment: Payment) => {
    if (payment.refundedAt) {
      return <Badge variant="outline" className="bg-orange-100 text-orange-800">Refunded</Badge>;
    }
    switch (payment.status) {
      case "success":
        return <Badge className="bg-green-500">Success</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{payment.status}</Badge>;
    }
  };

  const handleRefund = async () => {
    if (!selectedPayment) return;

    // Validate partialAmount if provided
    if (partialAmount) {
      const parsed = parseFloat(partialAmount);
      if (isNaN(parsed) || !Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Invalid Amount", {
          description: "Please enter a valid positive number for the refund amount.",
        });
        return;
      }
      if (parsed > selectedPayment.amount) {
        toast.error("Amount Too High", {
          description: `Refund amount cannot exceed the original payment of ${formatPrice(selectedPayment.amount, selectedPayment.currency)}.`,
        });
        return;
      }
    }

    setIsRefunding(true);
    try {
      const validatedAmount = partialAmount ? parseFloat(partialAmount) : undefined;
      const response = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: selectedPayment._id,
          reason: refundReason || undefined,
          amount: validatedAmount,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process refund");
      }

      toast.success("Refund Processed", {
        description: `Successfully refunded ${formatPrice(
          data.refund.amount,
          data.refund.currency
        )}`,
      });

      setSelectedPayment(null);
      setRefundReason("");
      setPartialAmount("");
    } catch (error) {
      toast.error("Refund Failed", {
        description: error instanceof Error ? error.message : "Something went wrong",
      });
    } finally {
      setIsRefunding(false);
    }
  };

  const openRefundDialog = (payment: Payment) => {
    setSelectedPayment(payment);
    setRefundReason("");
    setPartialAmount("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Subscription Refunds</h1>
        <p className="text-muted-foreground">
          Process refunds for subscription payments (admin only)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Subscription Payments
          </CardTitle>
          <CardDescription>
            View and manage subscription payment refunds. Only successful subscription
            payments can be refunded.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments === undefined ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No subscription payments found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment._id}>
                    <TableCell className="text-sm">
                      {formatDate(payment.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {payment.user?.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {payment.user?.email || "-"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {payment.chapaTransactionRef}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatPrice(payment.amount, payment.currency)}
                      {payment.refundAmount && (
                        <p className="text-xs text-orange-600">
                          Refunded: {formatPrice(payment.refundAmount, payment.currency)}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment)}</TableCell>
                    <TableCell className="text-right">
                      {payment.status === "success" && !payment.refundedAt ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRefundDialog(payment)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Refund
                        </Button>
                      ) : payment.refundedAt ? (
                        <span className="text-xs text-muted-foreground">
                          {payment.refundReason || "Refunded"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Refund Dialog */}
      <Dialog open={!!selectedPayment} onOpenChange={(open) => !open && setSelectedPayment(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Process Refund
            </DialogTitle>
            <DialogDescription>
              Refund this subscription payment. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Transaction:</span>
                  <span className="font-mono">{selectedPayment.chapaTransactionRef}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Original Amount:</span>
                  <span className="font-semibold">
                    {formatPrice(selectedPayment.amount, selectedPayment.currency)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">User:</span>
                  <span>{selectedPayment.user?.email || "Unknown"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partialAmount">Refund Amount (optional)</Label>
                <Input
                  id="partialAmount"
                  type="number"
                  placeholder={`Leave empty for full refund (${selectedPayment.amount})`}
                  value={partialAmount}
                  onChange={(e) => setPartialAmount(e.target.value)}
                  max={selectedPayment.amount}
                  min={1}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to refund the full amount
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  placeholder="e.g., Customer requested cancellation"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  maxLength={500}
                />
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800 dark:text-yellow-200">
                    <p className="font-medium">Important:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Chapa transaction fees are non-refundable</li>
                      <li>This will cancel the user&apos;s subscription</li>
                      <li>The refund amount will be deducted from your balance</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedPayment(null)}
              disabled={isRefunding}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={isRefunding}
            >
              {isRefunding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Process Refund
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
