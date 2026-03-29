"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@africonnect/convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Trash2, Plus, Minus, Package, CreditCard, Loader2 } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import type { Id } from "@africonnect/convex/_generated/dataModel";
import { COMMERCE_ENABLED } from "@/lib/features";
import { ComingSoonBanner } from "@/components/ui/coming-soon";
import { AgreementDialog } from "@/components/agreements/AgreementDialog";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

export default function CartPage() {
  const t = useTranslations("cart");
  const tCommon = useTranslations("common");
  const router = useRouter();
  
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showBuyerAgreementDialog, setShowBuyerAgreementDialog] = useState(false);
  const convex = useConvex();

  const ensureUser = useMutation(api.users.ensureUser);
  const currentUser = useQuery(api.users.getCurrentUser);
  const myBusiness = useQuery(api.businesses.getMyBusiness);
  const cart = useQuery(api.cart.get);
  const updateCartItem = useMutation(api.cart.update);
  const removeCartItem = useMutation(api.cart.remove);
  const acceptAgreement = useMutation(api.agreements.acceptAgreement);
  const buyerAgreementState = useQuery(api.agreements.hasAcceptedCurrentAgreement, {
    type: "buyer",
  });
  const myBusinessLoaded = myBusiness !== undefined;
  const buyerVerificationBlocked =
    !!currentUser &&
    myBusinessLoaded &&
    (!currentUser.businessId || myBusiness?.verificationStatus !== "verified");

  useEffect(() => {
    ensureUser().catch(() => {
      // Silently fail if user creation fails
    });
  }, [ensureUser]);

  const handleUpdateQuantity = async (itemId: Id<"cartItems">, newQuantity: number) => {
    try {
      if (newQuantity <= 0) {
        await removeCartItem({ id: itemId });
      } else {
        await updateCartItem({ id: itemId, quantity: newQuantity });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update cart";
      toast.error(errorMessage);
    }
  };

  const handleRemove = async (itemId: Id<"cartItems">) => {
    try {
      await removeCartItem({ id: itemId });
      toast.success(t("removeItem"));
    } catch {
      toast.error("Failed to remove item");
    }
  };

  const proceedToCheckout = async () => {
    if (!cart || cart.length === 0) {
      toast.error(t("emptyCart"));
      return;
    }

    setIsCheckingOut(true);
    try {
      // Calculate subtotal from cart (orders will be created after successful payment)
      const subtotalAmount = cart.reduce((sum, item) => {
        if (!item.product) return sum;
        return sum + item.product.price * item.quantity;
      }, 0);
      const buyerFee = Math.round(subtotalAmount * 0.01 * 100) / 100;
      const totalAmount = subtotalAmount + buyerFee;

      if (totalAmount <= 0) {
        throw new Error("Invalid cart total");
      }

      // Initialize Chapa payment (cart snapshot is saved in payment metadata)
      const response = await fetch("/api/payments/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: totalAmount,
          currency: "ETB",
          paymentType: "order",
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize payment");
      }

      // Redirect to Chapa checkout
      toast.success("Redirecting to payment...");
      window.location.href = data.checkoutUrl;

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Failed to checkout";
      toast.error(errorMessage);
      setIsCheckingOut(false);
    }
  };

  const handleCheckout = async () => {
    if (buyerVerificationBlocked) {
      const targetRoute = currentUser?.businessId ? "/business/profile" : "/business/verify";
      toast.error(
        currentUser?.businessId
          ? "Your business must be verified before checkout."
          : "Verify your business before checkout."
      );
      router.push(targetRoute);
      return;
    }

    if (buyerAgreementState === undefined) {
      toast.error(tCommon("loading"));
      return;
    }

    if (buyerAgreementState.status === "unauthenticated") {
      toast.error("Please sign in to continue checkout.");
      router.push("/sign-in");
      return;
    }

    if (buyerAgreementState.status === "missing_active_version") {
      toast.error("Buyer agreement is not configured. Please contact support.");
      return;
    }

    if (buyerAgreementState.status !== "accepted") {
      toast.error(t("buyerAgreementRequired"));
      setShowBuyerAgreementDialog(true);
      return;
    }

    await proceedToCheckout();
  };

  if (cart === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  const subtotal = cart.reduce((sum, item) => {
    if (!item.product) return sum;
    return sum + item.product.price * item.quantity;
  }, 0);

  const buyerFee = Math.round(subtotal * 0.01 * 100) / 100;
  const total = subtotal + buyerFee;

  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const getPrimaryUsdPrice = (priceEtb: number, usdPrice?: number) => {
    if (usdPrice !== undefined) return { value: usdPrice, approximate: false };
    return { value: priceEtb / USD_TO_ETB_RATE, approximate: true };
  };

  const formatUsd = (amount: number) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const subtotalUsd = cart.reduce((sum, item) => {
    if (!item.product) return sum;
    const usd = getPrimaryUsdPrice(item.product.price, item.product.usdPrice);
    return sum + usd.value * item.quantity;
  }, 0);
  const subtotalUsdApproximate = cart.some(
    (item) => item.product && item.product.usdPrice === undefined
  );
  const buyerFeeUsd = buyerFee / USD_TO_ETB_RATE;
  const totalUsd = total / USD_TO_ETB_RATE;

  return (
    <div className="space-y-6">
      <AgreementDialog
        open={showBuyerAgreementDialog}
        onOpenChange={setShowBuyerAgreementDialog}
        type="buyer"
        onAccept={async () => {
          try {
            await acceptAgreement({
              type: "buyer",
              userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
            });

            const updatedState = await convex.query(
              api.agreements.hasAcceptedCurrentAgreement,
              { type: "buyer" }
            );

            if (updatedState.status === "missing_active_version") {
              throw new Error("Buyer agreement is not configured. Please contact support.");
            }

            if (updatedState.status === "unauthenticated") {
              throw new Error("Please sign in to continue checkout.");
            }

            if (updatedState.status !== "accepted") {
              throw new Error("Buyer agreement acceptance was not confirmed.");
            }

            await proceedToCheckout();
          } catch (error: unknown) {
            const message =
              error instanceof Error ? error.message : t("buyerAgreementRequired");
            toast.error(message);
            throw error;
          }
        }}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("description")}
        </p>
      </div>

      {!COMMERCE_ENABLED && (
        <ComingSoonBanner 
          title={`${t("title")} & ${t("checkout")}`}
          description={t("emptyCartDescription")}
        />
      )}

      {cart.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t("emptyCart")}</p>
            <Link href="/marketplace">
              <Button>{t("browseMarketplace")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            {cart.map((item) => {
              if (!item.product) return null;

              return (
                <Card key={item._id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">
                          {item.product.name}
                        </h3>
                        {item.product.category && (
                          <Badge variant="outline" className="mb-2">
                            {item.product.category}
                          </Badge>
                        )}
                        <p className="text-sm text-muted-foreground mb-2">
                          {item.product.description || tCommon("noDescription")}
                        </p>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col">
                            <div className="text-lg font-semibold">
                              {(() => {
                                const usd = getPrimaryUsdPrice(item.product.price, item.product.usdPrice);
                                return `${usd.approximate ? "~" : ""}$${formatUsd(usd.value)}`;
                              })()}
                            </div>
                            <div className="text-xs text-muted-foreground">{item.product.price.toLocaleString()} ETB</div>
                            {item.product.kesPrice !== undefined && (
                              <div className="text-xs text-muted-foreground">
                                {item.product.kesPrice.toLocaleString()} KES
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Package className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {item.product.quantity} available
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemove(item._id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleUpdateQuantity(item._id, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <Input
                            type="number"
                            min="1"
                            max={item.product.quantity}
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              handleUpdateQuantity(
                                item._id,
                                Math.max(1, Math.min(item.product!.quantity, val))
                              );
                            }}
                            className="w-16 text-center"
                          />
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              handleUpdateQuantity(item._id, item.quantity + 1)
                            }
                            disabled={item.quantity >= item.product.quantity}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">{t("subtotal")}</div>
                          <div className="font-semibold">
                            {(() => {
                              const usd = getPrimaryUsdPrice(item.product.price, item.product.usdPrice);
                              return `${usd.approximate ? "~" : ""}$${formatUsd(usd.value * item.quantity)}`;
                            })()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {(item.product.price * item.quantity).toLocaleString()} ETB
                          </div>
                          {item.product.kesPrice !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {(item.product.kesPrice * item.quantity).toLocaleString()} KES
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>{t("title")}</CardTitle>
                <CardDescription>
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("subtotal")}</span>
                    <div className="text-right">
                      <div>{`${subtotalUsdApproximate ? "~" : ""}$${formatUsd(subtotalUsd)}`}</div>
                      <div className="text-xs text-muted-foreground">{subtotal.toLocaleString()} ETB</div>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Buyer fee (1%)</span>
                    <div className="text-right">
                      <div>{`~$${formatUsd(buyerFeeUsd)}`}</div>
                      <div className="text-xs text-muted-foreground">{buyerFee.toLocaleString()} ETB</div>
                    </div>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-semibold">
                    <span>{t("total")}</span>
                    <div className="text-right">
                      <div>{`~$${formatUsd(totalUsd)}`}</div>
                      <div className="text-xs font-normal text-muted-foreground">{total.toLocaleString()} ETB</div>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full gap-2"
                  onClick={handleCheckout}
                  disabled={
                    isCheckingOut ||
                    cart.length === 0 ||
                    !COMMERCE_ENABLED ||
                    buyerVerificationBlocked ||
                    buyerAgreementState === undefined ||
                    buyerAgreementState?.status === "missing_active_version"
                  }
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {tCommon("loading")}
                    </>
                  ) : !COMMERCE_ENABLED ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      {tCommon("soon")}
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      {t("checkout")}
                    </>
                  )}
                </Button>
                {buyerVerificationBlocked && (
                  <p className="text-sm text-muted-foreground">
                    {currentUser?.businessId
                      ? "Your business verification is not approved yet. Open your business profile to continue."
                      : "Complete business verification before you can continue to checkout."}
                  </p>
                )}
                <Link href="/marketplace">
                  <Button variant="outline" className="w-full">
                    {t("browseMarketplace")}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
