"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ShoppingCart, 
  Package, 
  ArrowLeft, 
  Info, 
  MapPin, 
  Building2,
  CheckCircle2,
  Clock,
  Tag,
  Layers,
  MessageCircle
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Id } from "@/convex/_generated/dataModel";
import { ImageGallery } from "@/components/products";
import Image from "next/image";
import { COMMERCE_ENABLED } from "@/lib/features";
import { useTranslations } from "next-intl";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tChat = useTranslations("chat");
  const tMarketplace = useTranslations("marketplace");
  const productId = params.id as Id<"products">;
  const [quantity, setQuantity] = useState(1);
  const [isContactingLoading, setIsContactingLoading] = useState(false);

  const currentUser = useQuery(api.users.getCurrentUser);
  const myBusiness = useQuery(api.businesses.getMyBusiness);
  const productData = useQuery(api.products.getProductWithImages, { id: productId });
  const relatedProducts = useQuery(api.products.getRelatedProducts, { 
    productId, 
    limit: 4 
  });
  const addToCart = useMutation(api.cart.add);
  const channelInfo = useQuery(api.chat.getProductChannelInfo, { productId });

  const handleContactSeller = async () => {
    if (!channelInfo || channelInfo.isOwnProduct) return;
    
    setIsContactingLoading(true);
    try {
      // Navigate to messages with channel info including members and their names
      const params = new URLSearchParams({
        channel: channelInfo.channelId,
        product: productId,
        productName: channelInfo.productName || "",
        members: channelInfo.members.join(","),
        memberNames: channelInfo.memberNames.join(","),
        sellerName: channelInfo.sellerName || "",
      });
      router.push(`/messages?${params.toString()}`);
    } catch (error) {
      console.error("Failed to contact seller:", error);
      toast.error("Failed to start conversation");
    } finally {
      setIsContactingLoading(false);
    }
  };

  // Check if current user is the owner of this product
  // sellerId is stored as clerkId, not the Convex _id
  const isOwnProduct = currentUser && productData && productData.sellerId === currentUser.clerkId;
  const isMyBusinessLoading = myBusiness === undefined;
  const requiresBuyerVerification =
    !!currentUser &&
    !isMyBusinessLoading &&
    !isOwnProduct &&
    (!currentUser.businessId || myBusiness?.verificationStatus !== "verified");

  const handleAddToCart = async () => {
    if (!productData) return;
    if (isMyBusinessLoading) return;

    if (requiresBuyerVerification) {
      const targetRoute = currentUser?.businessId ? "/business/profile" : "/business/verify";
      toast.error(
        currentUser?.businessId
          ? tMarketplace("verify.businessBeforeAdd")
          : tMarketplace("verify.completeBusinessBeforeAdd")
      );
      router.push(targetRoute);
      return;
    }

    const minQty = productData.minOrderQuantity || 1;
    if (quantity < minQty) {
      toast.error(`Minimum order quantity is ${minQty}`);
      return;
    }

    if (quantity > productData.quantity) {
      toast.error("Insufficient stock");
      return;
    }

    try {
      await addToCart({
        productId: productData._id,
        quantity,
      });
      toast.success("Added to cart");
      router.push("/cart");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error 
        ? error.message 
        : (error as { data?: string })?.data || "Failed to add to cart";
      toast.error(errorMessage);
    }
  };

  if (productData === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (productData === null) {
    return (
      <div className="space-y-6">
        <Link href="/marketplace">
          <Button variant="ghost">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Marketplace
          </Button>
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Product not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxQuantity = Math.min(productData.quantity, 100);
  const minQuantity = productData.minOrderQuantity || 1;
  const isOrderable = productData.isOrderable !== false;
  const getPrimaryUsdPrice = (priceEtb: number, usdPrice?: number) => {
    if (usdPrice !== undefined) return { value: usdPrice, approximate: false };
    return { value: priceEtb / USD_TO_ETB_RATE, approximate: true };
  };
  const formatUsd = (amount: number) =>
    amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  const primaryUsd = getPrimaryUsdPrice(productData.price, productData.usdPrice);
  const subtotalUsd = primaryUsd.value * quantity;
  const subtotalEtb = productData.price * quantity;
  const subtotalKes =
    productData.kesPrice !== undefined ? productData.kesPrice * quantity : undefined;

  // Parse specifications if available
  let specifications: Record<string, string> = {};
  if (productData.specifications) {
    try {
      specifications = JSON.parse(productData.specifications);
    } catch {
      // Invalid JSON, ignore
    }
  }

  return (
    <div className="space-y-8">
      <Link href="/marketplace">
        <Button variant="ghost">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Button>
      </Link>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left Column - Images */}
        <div>
          <ImageGallery 
            images={productData.images || []} 
            productName={productData.name} 
          />
        </div>

        {/* Right Column - Details */}
        <div className="space-y-6">
          {/* Product Header */}
          <div>
            <div className="flex flex-wrap items-start gap-2 mb-2">
              {productData.category && (
                <Badge variant="secondary">{productData.category}</Badge>
              )}
              {productData.country && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {productData.country}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold">{productData.name}</h1>
            <div className="mt-2">
              <p className="text-3xl font-bold text-primary">
                {`${primaryUsd.approximate ? "~" : ""}$${formatUsd(primaryUsd.value)}`}
              </p>
              <p className="text-sm text-muted-foreground">{productData.price.toLocaleString()} ETB</p>
              {productData.kesPrice !== undefined && (
                <p className="text-sm text-muted-foreground">{productData.kesPrice.toLocaleString()} KES</p>
              )}
            </div>
          </div>

          {/* Stock & Min Order */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
                {productData.quantity > 0 ? (
                <span>
                  {productData.quantity} {productData.quantity === 1 ? "item" : "items"} in stock
                </span>
              ) : (
                <span className="text-destructive">Out of stock</span>
              )}
            </div>
              {!isOrderable && (
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Not orderable</span>
                </div>
              )}
            {productData.minOrderQuantity && productData.minOrderQuantity > 1 && (
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <span>Min. order: {productData.minOrderQuantity} units</span>
              </div>
            )}
          </div>

          {/* Tags */}
          {productData.tags && productData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {productData.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <Separator />

          {/* Purchase / Own Product Section */}
          {isOwnProduct ? (
            <Card>
              <CardContent className="py-4">
                <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                  <Info className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    This is your product. You can manage it from your{" "}
                    <Link href="/products" className="text-primary hover:underline font-medium">
                      Products page
                    </Link>.
                  </p>
                </div>
                <Link href="/products" className="block mt-4">
                  <Button variant="outline" className="w-full">
                    Manage My Products
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Add to Cart</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Quantity</Label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.max(minQuantity, quantity - 1))}
                      disabled={quantity <= minQuantity}
                    >
                      -
                    </Button>
                    <Input
                      id="quantity"
                      type="number"
                      min={minQuantity}
                      max={maxQuantity}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || minQuantity;
                        setQuantity(Math.max(minQuantity, Math.min(maxQuantity, val)));
                      }}
                      className="text-center w-20"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                      disabled={quantity >= maxQuantity}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between text-sm py-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      {`${primaryUsd.approximate ? "~" : ""}$${formatUsd(subtotalUsd)}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {subtotalEtb.toLocaleString()} ETB
                    </div>
                    {subtotalKes !== undefined && (
                      <div className="text-xs text-muted-foreground">
                        {subtotalKes.toLocaleString()} KES
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleAddToCart}
                  disabled={
                    isMyBusinessLoading ||
                    productData.quantity === 0 ||
                    quantity > productData.quantity ||
                    !isOrderable ||
                    !COMMERCE_ENABLED
                  }
                >
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  {COMMERCE_ENABLED ? (isOrderable ? "Add to Cart" : "Not Orderable") : "Coming Soon"}
                </Button>
                {!COMMERCE_ENABLED && (
                  <p className="text-sm text-muted-foreground text-center flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    Shopping cart feature is coming soon
                  </p>
                )}
                {COMMERCE_ENABLED && !isOrderable && (
                  <p className="text-sm text-muted-foreground text-center">
                    This product is visible in catalog but currently not available for purchase.
                  </p>
                )}
                {COMMERCE_ENABLED && productData.quantity === 0 && (
                  <p className="text-sm text-destructive text-center">
                    This product is currently out of stock
                  </p>
                )}
                {COMMERCE_ENABLED && requiresBuyerVerification && (
                  <p className="text-sm text-muted-foreground text-center">
                    {currentUser?.businessId
                      ? tMarketplace("verify.businessBeforeAdd")
                      : tMarketplace("verify.completeBusinessBeforeAdd")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Seller Info */}
          {productData.business && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Seller Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4">
                  {productData.business.logoUrl ? (
                    <div className="relative h-12 w-12 overflow-hidden rounded-lg border">
                      <Image
                        src={productData.business.logoUrl}
                        alt={productData.business.name}
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg border bg-muted">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{productData.business.name}</h3>
                      {productData.business.verificationStatus === "verified" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {productData.business.verificationStatus === "pending" && (
                        <Clock className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {productData.business.country}
                    </p>
                  </div>
                </div>
                {!isOwnProduct && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleContactSeller}
                    disabled={isContactingLoading || !channelInfo}
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {tChat("contactSeller")}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Description Section */}
      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground whitespace-pre-wrap">
            {productData.description || "No description available"}
          </p>
        </CardContent>
      </Card>

      {/* Specifications Section */}
      {Object.keys(specifications).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.entries(specifications).map(([key, value]) => (
                <div key={key} className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Related Products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Related Products</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {relatedProducts.map((product) => (
              <Link key={product._id} href={`/marketplace/${product._id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="relative aspect-square bg-muted">
                    {product.primaryImageUrl ? (
                      <Image
                        src={product.primaryImageUrl}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <Package className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-sm line-clamp-1">{product.name}</CardTitle>
                    <CardDescription className="font-bold text-foreground">
                      {product.price.toLocaleString()} ETB
                    </CardDescription>
                    {product.usdPrice !== undefined && (
                      <div className="text-xs text-muted-foreground">${product.usdPrice.toLocaleString()}</div>
                    )}
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
