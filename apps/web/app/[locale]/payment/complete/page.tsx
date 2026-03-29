"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";

type PaymentStatus = "loading" | "success" | "failed" | "error";

interface VerificationResult {
  status: string;
  data?: {
    amount: number;
    currency: string;
    reference: string;
    tx_ref: string;
    payment_method: string;
  };
  error?: string;
}

function PaymentCompleteContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus>("loading");
  const [result, setResult] = useState<VerificationResult | null>(null);

  const txRef = searchParams.get("tx_ref");
  const chapaStatus = searchParams.get("status");

  useEffect(() => {
    async function verifyPayment() {
      if (!txRef) {
        setStatus("error");
        setResult({ status: "error", error: "No transaction reference found" });
        return;
      }

      try {
        const response = await fetch(`/api/payments/verify?tx_ref=${txRef}`);
        const data = await response.json();

        if (data.success && data.status === "success") {
          setStatus("success");
          setResult(data);
        } else {
          setStatus("failed");
          setResult(data);
        }
      } catch (error) {
        console.error("Verification error:", error);
        // If API verification fails, use URL params as fallback
        if (chapaStatus === "success") {
          setStatus("success");
          setResult({ status: "success" });
        } else {
          setStatus("failed");
          setResult({ status: "failed", error: "Could not verify payment" });
        }
      }
    }

    verifyPayment();
  }, [txRef, chapaStatus]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Verifying Payment</h2>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <CheckCircle className="h-20 w-20 text-green-500" />
            </div>
            <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
            <CardDescription>
              Your payment has been processed successfully
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {result?.data && (
              <div className="bg-muted rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-medium">
                    {result.data.currency} {result.data.amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{result.data.reference || txRef}</span>
                </div>
                {result.data.payment_method && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Method</span>
                    <span className="capitalize">{result.data.payment_method}</span>
                  </div>
                )}
              </div>
            )}
            
            <div className="flex flex-col gap-3">
              <Link href="/orders">
                <Button className="w-full">View My Orders</Button>
              </Link>
              <Link href="/marketplace">
                <Button variant="outline" className="w-full">
                  Continue Shopping
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <AlertCircle className="h-20 w-20 text-yellow-500" />
            </div>
            <CardTitle className="text-2xl">Something Went Wrong</CardTitle>
            <CardDescription>
              {result?.error || "We couldn't find your payment information"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              If you completed a payment, please check your orders page or contact support.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/orders">
                <Button className="w-full">Check Orders</Button>
              </Link>
              <Link href="/cart">
                <Button variant="outline" className="w-full">
                  Return to Cart
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Failed status
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <XCircle className="h-20 w-20 text-red-500" />
          </div>
          <CardTitle className="text-2xl text-red-600">Payment Failed</CardTitle>
          <CardDescription>
            Your payment could not be processed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            {result?.error || "The payment was not completed. Please try again or use a different payment method."}
          </p>
          {txRef && (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Transaction Reference</span>
                <span className="font-mono text-xs">{txRef}</span>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <Link href="/cart">
              <Button className="w-full">Try Again</Button>
            </Link>
            <Link href="/marketplace">
              <Button variant="outline" className="w-full">
                Continue Shopping
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PaymentCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="pt-8 pb-8 text-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Loading...</h2>
            </CardContent>
          </Card>
        </div>
      }
    >
      <PaymentCompleteContent />
    </Suspense>
  );
}

