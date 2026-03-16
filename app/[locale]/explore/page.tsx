"use client";

import { useState, useMemo } from "react";
import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, ShoppingCart, ImageIcon } from "lucide-react";
import Image from "next/image";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { USD_TO_ETB_RATE } from "@/lib/pricing";

export default function ExplorePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");

  const allProducts = useQuery(api.products.publicMarketplace, {});
  const products = useQuery(api.products.publicMarketplace, {
    search: searchQuery || undefined,
    category: categoryFilter || undefined,
  });

  const categories = useMemo(() => {
    if (!allProducts) return [];
    return Array.from(
      new Set(allProducts.map((p) => p.category).filter((c) => c) as string[])
    );
  }, [allProducts]);

  const getPrimaryUsdPrice = (priceEtb: number, usdPrice?: number) => {
    if (usdPrice !== undefined) return { value: usdPrice, approximate: false };
    return { value: priceEtb / USD_TO_ETB_RATE, approximate: true };
  };

  const formatStockLabel = (quantity: number) => {
    if (quantity > 1000) return "1000+ in stock";
    return `${quantity} in stock`;
  };

  return (
    <>
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <PublicHeader />

        <main className="flex-1 pt-24">
          <div className="mx-auto max-w-6xl px-6">
            {/* Page Header */}
            <div className="mb-10">
              <p className="text-xs font-medium tracking-widest uppercase text-primary mb-3">Explore</p>
              <h1 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold leading-tight tracking-tight mb-3">
                Marketplace
              </h1>
              <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
                Discover products from verified businesses across the continent.
              </p>
            </div>

            {/* Search and Filter */}
            <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="relative w-full max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 rounded-xl border-border/60"
                />
              </div>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={categoryFilter === "" ? "default" : "outline"}
                    size="sm"
                    className="rounded-lg text-xs"
                    onClick={() => setCategoryFilter("")}
                  >
                    All
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category}
                      variant={categoryFilter === category ? "default" : "outline"}
                      size="sm"
                      className="rounded-lg text-xs"
                      onClick={() => setCategoryFilter(category)}
                    >
                      {category}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* Products Grid */}
            {products === undefined ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-sm text-muted-foreground">Loading products...</div>
              </div>
            ) : products.length === 0 ? (
              <div className="py-24 text-center">
                <Package className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" />
                <h2 className="text-xl font-semibold mb-2">No products found</h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {searchQuery || categoryFilter
                    ? "No products match your search. Try adjusting your filters."
                    : "No products available yet. Be the first to list your products!"}
                </p>
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button className="mt-6 rounded-xl">Start Selling</Button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <Link href="/products">
                    <Button className="mt-6 rounded-xl">Add Your Products</Button>
                  </Link>
                </SignedIn>
              </div>
            ) : (
              <>
                <p className="mb-4 text-xs text-muted-foreground">
                  {products.length} product{products.length !== 1 ? "s" : ""} found
                </p>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {products.map((product) => (
                    <Card key={product._id} className="group flex flex-col overflow-hidden rounded-xl border-border/50 transition-all hover:shadow-md hover:-translate-y-0.5">
                      <div className="relative aspect-square overflow-hidden bg-muted/30">
                        {product.primaryImageUrl ? (
                          <Image
                            src={product.primaryImageUrl}
                            alt={product.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                          </div>
                        )}

                        {product.category && (
                          <Badge
                            variant="secondary"
                            className="absolute left-2.5 top-2.5 bg-background/80 backdrop-blur-sm text-[10px]"
                          >
                            {product.category}
                          </Badge>
                        )}

                        {product.country && (
                          <Badge
                            variant="outline"
                            className="absolute right-2.5 top-2.5 bg-background/80 backdrop-blur-sm text-[10px]"
                          >
                            {product.country}
                          </Badge>
                        )}

                        {product.quantity === 0 && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                            <Badge variant="destructive" className="text-xs">Out of Stock</Badge>
                          </div>
                        )}
                      </div>

                      <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="line-clamp-1 text-sm font-medium group-hover:text-primary transition-colors">
                          {product.name}
                        </CardTitle>
                        <CardDescription className="line-clamp-2 text-xs">
                          {product.description || "No description available"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 flex-col justify-between gap-3 px-4 pb-4">
                        <div>
                          <div className="text-lg font-semibold text-primary">
                            {(() => {
                              const usd = getPrimaryUsdPrice(product.price, product.usdPrice);
                              return `${usd.approximate ? "~" : ""}$${usd.value.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}`;
                            })()}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{product.price.toLocaleString()} ETB</div>
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            {product.quantity > 0 ? (
                              <span className="flex items-center gap-1">
                                <Package className="h-3 w-3" />
                                {formatStockLabel(product.quantity)}
                              </span>
                            ) : (
                              <span className="text-destructive">Out of stock</span>
                            )}
                          </div>
                        </div>
                        <SignedIn>
                          <Link href={`/marketplace/${product._id}`}>
                            <Button className="w-full rounded-lg text-xs" size="sm" disabled={product.quantity === 0}>
                              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                              View Details
                            </Button>
                          </Link>
                        </SignedIn>
                        <SignedOut>
                          <SignInButton mode="modal">
                            <Button className="w-full rounded-lg text-xs" size="sm" variant="outline">
                              <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
                              Sign in to Buy
                            </Button>
                          </SignInButton>
                        </SignedOut>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        </main>

        <div className="mt-16">
          <PublicFooter />
        </div>
      </div>
    </>
  );
}
