"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon, Package } from "lucide-react";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  usdPrice?: number;
  quantity: number;
  category?: string;
  country?: string;
  primaryImageUrl?: string | null;
}

interface ProductGridProps {
  products: Product[] | undefined;
  isLoading?: boolean;
}

function ProductSkeleton() {
  return (
    <div className="rounded-2xl border bg-card overflow-hidden animate-pulse">
      <div className="aspect-square bg-muted" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-6 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

export function ProductGrid({ products, isLoading }: ProductGridProps) {
  const t = useTranslations("marketplace");
  const tCommon = useTranslations("common");

  const getPrimaryUsdPrice = (priceEtb: number, usdPrice?: number) => {
    if (usdPrice !== undefined) return { value: usdPrice, approximate: false };
    return { value: priceEtb / USD_TO_ETB_RATE, approximate: true };
  };

  const formatStockLabel = (quantity: number) =>
    quantity > 1000 ? "1000+" : quantity.toLocaleString();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="py-16 text-center">
        <Package className="mx-auto h-16 w-16 text-muted-foreground/30" />
        <h3 className="mt-4 text-lg font-medium">{t("noProducts")}</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("tryAdjustingFilters")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {products.map((product) => (
        <Link key={product._id} href={`/marketplace/${product._id}`}>
          <Card className="group h-full overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 rounded-2xl">
            {/* Product Image */}
            <div className="relative aspect-square overflow-hidden bg-muted">
              {product.primaryImageUrl ? (
                <Image
                  src={product.primaryImageUrl}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}

              {/* Category Badge */}
              {product.category && (
                <Badge
                  variant="secondary"
                  className="absolute left-2 top-2 bg-background/90 backdrop-blur-sm text-xs"
                >
                  {product.category}
                </Badge>
              )}

              {/* Country Badge */}
              {product.country && (
                <Badge
                  variant="outline"
                  className="absolute right-2 top-2 bg-background/90 backdrop-blur-sm text-xs"
                >
                  {product.country}
                </Badge>
              )}

              {/* Out of Stock Overlay */}
              {product.quantity === 0 && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                  <Badge variant="destructive">{t("outOfStock")}</Badge>
                </div>
              )}
            </div>

            {/* Product Info */}
            <CardContent className="p-3">
              <h3 className="font-medium text-sm line-clamp-1 group-hover:text-primary transition-colors">
                {product.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {product.description || tCommon("noDescription")}
              </p>
              <div className="flex items-end justify-between mt-2">
                <div>
                  <div className="text-2xl font-bold text-primary">
                    {(() => {
                      const usd = getPrimaryUsdPrice(product.price, product.usdPrice);
                      return `${usd.approximate ? "~" : ""}$${usd.value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`;
                    })()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {product.price.toLocaleString()} ETB
                  </div>
                  {product.quantity > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Package className="h-3 w-3" />
                      {formatStockLabel(product.quantity)}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
