import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  getOrCreateUser,
  checkProductLimit,
  PlanLimitError,
  requireAdmin,
  hasSellerAccess,
} from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

export const list = query({
  args: {
    sellerId: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    let products;

    if (args.sellerId && args.status) {
      products = await ctx.db
        .query("products")
        .withIndex("by_seller_status", (q) =>
          q.eq("sellerId", args.sellerId!).eq("status", args.status!)
        )
        .collect();
    } else if (args.sellerId) {
      products = await ctx.db
        .query("products")
        .withIndex("by_seller", (q) => q.eq("sellerId", args.sellerId!))
        .collect();
    } else if (args.status) {
      products = await ctx.db
        .query("products")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .collect();
    } else {
      products = await ctx.db.query("products").collect();
    }

    return products.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const get = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const product = await ctx.db.get(args.id);
    if (!product) {
      return null;
    }

    return product;
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    price: v.number(),
    usdPrice: v.number(),
    kesPrice: v.optional(v.number()),
    quantity: v.number(),
    sku: v.optional(v.string()),
    lowStockThreshold: v.optional(v.number()),
    reorderQuantity: v.optional(v.number()),
    category: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    country: v.optional(v.string()),
    minOrderQuantity: v.optional(v.number()),
    specifications: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const log = createLogger("products.create");
    
    try {
      log.info("Product creation initiated", {
        name: args.name,
        price: args.price,
        usdPrice: args.usdPrice,
        kesPrice: args.kesPrice,
        quantity: args.quantity,
        category: args.category,
        country: args.country,
        status: args.status ?? "active",
      });

      const user = await getOrCreateUser(ctx);
      log.setContext({ userId: user.clerkId });

      if (!hasSellerAccess(user)) {
        throw new Error("Unauthorized: Seller access required");
      }

      // Admin users bypass all product limit and subscription checks
      const isAdmin = user.role === "admin";

      // Allow the first product without a paid subscription, but require payment afterwards.
      const existingProducts = await ctx.db
        .query("products")
        .withIndex("by_seller", (q) => q.eq("sellerId", user.clerkId))
        .collect();

      if (!isAdmin && existingProducts.length > 0) {
        let hasPaidSubscription = false;
        if (user.businessId) {
          const subscription = await ctx.db
            .query("subscriptions")
            .withIndex("by_business", (q) => q.eq("businessId", user.businessId!))
            .first();
          hasPaidSubscription = subscription?.status === "active";
        }

        if (!hasPaidSubscription) {
          log.warn("Product creation failed - paid subscription required", {
            existingProducts: existingProducts.length,
            hasBusiness: !!user.businessId,
          });
          await flushLogs();
          throw new Error("Paid subscription required to add additional products");
        }
      }

      // Check product limit based on subscription plan
      if (!isAdmin) {
        const productLimit = await checkProductLimit(ctx, user._id);
        if (!productLimit.allowed) {
          log.warn("Product creation failed - plan limit reached", {
            currentProducts: productLimit.current,
            limit: productLimit.limit,
          });
          await flushLogs();
          throw new PlanLimitError("products", productLimit.current, productLimit.limit);
        }

        log.debug("Product limit check passed", {
          currentProducts: productLimit.current,
          limit: productLimit.limit,
        });
      } else {
        log.debug("Admin user - bypassing product limit checks");
      }

      if (args.lowStockThreshold !== undefined && args.lowStockThreshold < 0) {
        throw new Error("Low stock threshold must be 0 or greater");
      }
      if (args.reorderQuantity !== undefined && args.reorderQuantity < 0) {
        throw new Error("Reorder quantity must be 0 or greater");
      }
      if (args.usdPrice <= 0) {
        throw new Error("USD price must be greater than 0");
      }
      if (args.kesPrice !== undefined && args.kesPrice < 0) {
        throw new Error("KES price must be 0 or greater");
      }

      if (args.sku && args.sku.trim()) {
        const existingSku = await ctx.db
          .query("products")
          .withIndex("by_seller_sku", (q) =>
            q.eq("sellerId", user.clerkId).eq("sku", args.sku)
          )
          .first();
        if (existingSku) {
          throw new Error("SKU already exists for another product");
        }
      }

      const now = Date.now();
      const productId = await ctx.db.insert("products", {
        sellerId: user.clerkId,
        name: args.name,
        description: args.description,
        price: args.price,
        usdPrice: args.usdPrice,
        kesPrice: args.kesPrice,
        quantity: args.quantity,
        sku: args.sku,
        lowStockThreshold: args.lowStockThreshold,
        reorderQuantity: args.reorderQuantity,
        category: args.category,
        status: args.status ?? "active",
        isOrderable: true,
        country: args.country,
        minOrderQuantity: args.minOrderQuantity,
        specifications: args.specifications,
        tags: args.tags,
        createdAt: now,
        updatedAt: now,
      });

      if (args.quantity > 0) {
        await ctx.db.insert("inventoryTransactions", {
          productId,
          sellerId: user.clerkId,
          type: "restock",
          direction: "in",
          quantity: args.quantity,
          previousQuantity: 0,
          newQuantity: args.quantity,
          reason: "Initial stock",
          createdBy: user._id,
          createdAt: now,
        });
      }

      log.info("Product created successfully", {
        productId,
        name: args.name,
        price: args.price,
        usdPrice: args.usdPrice,
        kesPrice: args.kesPrice,
        quantity: args.quantity,
        category: args.category,
        status: args.status ?? "active",
      });

      await flushLogs();
      return await ctx.db.get(productId);
    } catch (error) {
      log.error("Product creation failed", error, {
        name: args.name,
        price: args.price,
        usdPrice: args.usdPrice,
        kesPrice: args.kesPrice,
      });
      await flushLogs();
      throw error;
    }
  },
});

export const update = mutation({
  args: {
    id: v.id("products"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    price: v.optional(v.number()),
    usdPrice: v.number(),
    kesPrice: v.optional(v.number()),
    quantity: v.optional(v.number()),
    sku: v.optional(v.string()),
    lowStockThreshold: v.optional(v.number()),
    reorderQuantity: v.optional(v.number()),
    category: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
    country: v.optional(v.string()),
    minOrderQuantity: v.optional(v.number()),
    specifications: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const log = createLogger("products.update");
    
    try {
      log.info("Product update initiated", {
        productId: args.id,
        fieldsToUpdate: Object.keys(args).filter(k => k !== "id" && args[k as keyof typeof args] !== undefined),
      });

      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        log.warn("Product update failed - not authenticated");
        await flushLogs();
        throw new Error("Not authenticated");
      }

      log.setContext({ userId: identity.subject });

      const product = await ctx.db.get(args.id);
      if (!product) {
        log.error("Product update failed - not found", undefined, { productId: args.id });
        await flushLogs();
        throw new Error("Product not found");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (!user || !hasSellerAccess(user)) {
        log.warn("Product update failed - seller access required");
        await flushLogs();
        throw new Error("Unauthorized: Seller access required");
      }

      // sellerId is stored as clerkId, not the Convex _id
      if (product.sellerId !== user.clerkId) {
        log.warn("Product update failed - unauthorized", {
          productId: args.id,
          productOwnerId: product.sellerId,
          requestingUserId: user?.clerkId,
        });
        await flushLogs();
        throw new Error("Unauthorized");
      }

      if (args.lowStockThreshold !== undefined && args.lowStockThreshold < 0) {
        throw new Error("Low stock threshold must be 0 or greater");
      }
      if (args.reorderQuantity !== undefined && args.reorderQuantity < 0) {
        throw new Error("Reorder quantity must be 0 or greater");
      }
      if (args.usdPrice <= 0) {
        throw new Error("USD price must be greater than 0");
      }
      if (args.kesPrice !== undefined && args.kesPrice < 0) {
        throw new Error("KES price must be 0 or greater");
      }

      if (args.sku && args.sku.trim() && args.sku !== product.sku) {
        const existingSku = await ctx.db
          .query("products")
          .withIndex("by_seller_sku", (q) =>
            q.eq("sellerId", user.clerkId).eq("sku", args.sku)
          )
          .first();
        if (existingSku && existingSku._id !== args.id) {
          throw new Error("SKU already exists for another product");
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id: _id, ...updates } = args;
      const now = Date.now();
      await ctx.db.patch(args.id, {
        ...updates,
        updatedAt: now,
      });

      if (args.quantity !== undefined && args.quantity !== product.quantity) {
        const delta = args.quantity - product.quantity;
        await ctx.db.insert("inventoryTransactions", {
          productId: args.id,
          sellerId: product.sellerId,
          type: "correction",
          direction: delta > 0 ? "in" : "out",
          quantity: Math.abs(delta),
          previousQuantity: product.quantity,
          newQuantity: args.quantity,
          reason: "Manual inventory update",
          createdBy: user._id,
          createdAt: now,
        });
      }

      log.info("Product updated successfully", {
        productId: args.id,
        productName: args.name || product.name,
        fieldsUpdated: Object.keys(updates).filter(k => updates[k as keyof typeof updates] !== undefined),
      });

      await flushLogs();
      return await ctx.db.get(args.id);
    } catch (error) {
      log.error("Product update failed", error, { productId: args.id });
      await flushLogs();
      throw error;
    }
  },
});

export const remove = mutation({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const log = createLogger("products.remove");
    
    try {
      log.info("Product removal initiated", { productId: args.id });

      const identity = await ctx.auth.getUserIdentity();
      if (identity === null) {
        log.warn("Product removal failed - not authenticated");
        await flushLogs();
        throw new Error("Not authenticated");
      }

      log.setContext({ userId: identity.subject });

      const product = await ctx.db.get(args.id);
      if (!product) {
        log.error("Product removal failed - not found", undefined, { productId: args.id });
        await flushLogs();
        throw new Error("Product not found");
      }

      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
        .first();

      if (!user || !hasSellerAccess(user)) {
        log.warn("Product removal failed - seller access required");
        await flushLogs();
        throw new Error("Unauthorized: Seller access required");
      }

      // sellerId is stored as clerkId, not the Convex _id
      if (product.sellerId !== user.clerkId) {
        log.warn("Product removal failed - unauthorized", {
          productId: args.id,
          productOwnerId: product.sellerId,
          requestingUserId: user?.clerkId,
        });
        await flushLogs();
        throw new Error("Unauthorized");
      }

      // Delete all associated images from Convex (R2 cleanup should be done via API)
      const images = await ctx.db
        .query("productImages")
        .withIndex("by_product", (q) => q.eq("productId", args.id))
        .collect();

      const r2Keys: string[] = [];
      for (const image of images) {
        r2Keys.push(image.r2Key);
        await ctx.db.delete(image._id);
      }

      await ctx.db.delete(args.id);

      log.info("Product removed successfully", {
        productId: args.id,
        productName: product.name,
        imagesDeleted: images.length,
        r2KeysToCleanup: r2Keys.length,
      });

      await flushLogs();

      // Return the R2 keys so the caller can delete them from R2
      return { r2Keys };
    } catch (error) {
      log.error("Product removal failed", error, { productId: args.id });
      await flushLogs();
      throw error;
    }
  },
});

export const generateDummyProducts = mutation({
  args: {
    count: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const adminUser = await requireAdmin(ctx);
    const now = Date.now();
    const count = Math.min(Math.max(Math.floor(args.count ?? 12), 1), 100);
    const countries = ["Ethiopia", "Kenya", "Ghana", "Nigeria", "Rwanda", "Tanzania"];
    const seedProducts = [
      {
        name: "Single-Origin Arabica Coffee Beans",
        description: "Premium grade Arabica beans sourced from highland farms.",
        category: "Food & Beverages",
        price: 420,
      },
      {
        name: "Cold-Pressed Avocado Oil (5L)",
        description: "Refined avocado oil suitable for food processing and export.",
        category: "Food & Beverages",
        price: 260,
      },
      {
        name: "Organic Dried Hibiscus Flowers",
        description: "Sun-dried hibiscus calyx ready for tea and beverage blending.",
        category: "Agriculture",
        price: 190,
      },
      {
        name: "Industrial Grade Cotton Yarn Spools",
        description: "Consistent-strength yarn for textile manufacturing lines.",
        category: "Textiles",
        price: 315,
      },
      {
        name: "Woven Polypropylene Feed Sacks",
        description: "Heavy-duty sacks for grain, feed, and fertilizer packaging.",
        category: "Industrial Equipment",
        price: 145,
      },
      {
        name: "Solar Inverter 5kVA (Hybrid)",
        description: "Hybrid inverter designed for SME facilities and warehouse backup.",
        category: "Electronics",
        price: 980,
      },
      {
        name: "Deep-Cycle AGM Battery 200Ah",
        description: "Long-life battery optimized for backup and solar storage systems.",
        category: "Electronics",
        price: 760,
      },
      {
        name: "Galvanized Roofing Sheets (0.5mm)",
        description: "Corrosion-resistant roofing sheets for commercial construction.",
        category: "Construction",
        price: 215,
      },
      {
        name: "Portland Cement 50kg Bags",
        description: "General purpose cement for structural and masonry applications.",
        category: "Construction",
        price: 88,
      },
      {
        name: "Processed Shea Butter Blocks",
        description: "Cosmetic and food-grade shea butter blocks for bulk buyers.",
        category: "Agriculture",
        price: 335,
      },
      {
        name: "Stainless Steel Water Storage Tank 2000L",
        description: "Food-safe stainless steel tank for commercial water storage.",
        category: "Industrial Equipment",
        price: 1240,
      },
      {
        name: "Natural Rubber Gasket Sheets",
        description: "Durable gasket sheets for sealing and light industrial use.",
        category: "Industrial Equipment",
        price: 170,
      },
      {
        name: "Instant Ginger Drink Mix",
        description: "Concentrated ginger blend for hot and cold beverage preparation.",
        category: "Food & Beverages",
        price: 132,
      },
      {
        name: "Premium Sesame Seed (Hulled)",
        description: "Cleaned hulled sesame seed for food manufacturing and export.",
        category: "Agriculture",
        price: 275,
      },
      {
        name: "Commercial LED Floodlight 200W",
        description: "Energy-efficient outdoor floodlight for yards and logistics sites.",
        category: "Electronics",
        price: 155,
      },
    ];

    for (let i = 0; i < count; i += 1) {
      const index = i + 1;
      const productTemplate = seedProducts[i % seedProducts.length];
      const quantity = 12 + ((i * 17) % 137);
      await ctx.db.insert("products", {
        sellerId: adminUser.clerkId,
        name: `${productTemplate.name} - Batch ${index}`,
        description: `${productTemplate.description} Seeded for catalog demonstration and intentionally non-orderable.`,
        price: productTemplate.price + ((i * 9) % 65),
        quantity,
        sku: `DEMO-${now}-${index}`,
        category: productTemplate.category,
        status: "active",
        isOrderable: false,
        country: countries[i % countries.length],
        minOrderQuantity: 1,
        tags: ["demo", "seeded", "non-orderable"],
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      inserted: count,
      nonOrderable: true,
    };
  },
});

export const marketplace = query({
  args: {
    category: v.optional(v.string()),
    country: v.optional(v.string()),
    search: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("price_asc"),
        v.literal("price_desc")
      )
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      throw new Error("Not authenticated");
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let filtered = products;

    // Apply category filter
    if (args.category) {
      filtered = filtered.filter((p) => p.category === args.category);
    }

    // Apply country filter
    if (args.country) {
      filtered = filtered.filter((p) => p.country === args.country);
    }

    // Apply search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply price range filters
    if (args.minPrice !== undefined) {
      filtered = filtered.filter((p) => p.price >= args.minPrice!);
    }
    if (args.maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.price <= args.maxPrice!);
    }

    // Apply sorting
    const sortBy = args.sortBy ?? "newest";
    let sorted: typeof filtered;
    switch (sortBy) {
      case "price_asc":
        sorted = filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        sorted = filtered.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    // Include primary image for each product
    const productsWithImages = await Promise.all(
      sorted.map(async (product) => {
        const primaryImage = await ctx.db
          .query("productImages")
          .withIndex("by_product_primary", (q) =>
            q.eq("productId", product._id).eq("isPrimary", true)
          )
          .first();

        return {
          ...product,
          primaryImageUrl: primaryImage?.url ?? null,
        };
      })
    );

    return productsWithImages;
  },
});

// Public marketplace query - no authentication required
export const publicMarketplace = query({
  args: {
    category: v.optional(v.string()),
    country: v.optional(v.string()),
    search: v.optional(v.string()),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("price_asc"),
        v.literal("price_desc")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    let filtered = products;

    // Apply category filter
    if (args.category) {
      filtered = filtered.filter((p) => p.category === args.category);
    }

    // Apply country filter
    if (args.country) {
      filtered = filtered.filter((p) => p.country === args.country);
    }

    // Apply search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply price range filters
    if (args.minPrice !== undefined) {
      filtered = filtered.filter((p) => p.price >= args.minPrice!);
    }
    if (args.maxPrice !== undefined) {
      filtered = filtered.filter((p) => p.price <= args.maxPrice!);
    }

    // Apply sorting
    const sortBy = args.sortBy ?? "newest";
    let sorted: typeof filtered;
    switch (sortBy) {
      case "price_asc":
        sorted = filtered.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        sorted = filtered.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }

    // Apply limit if specified
    if (args.limit && args.limit > 0) {
      sorted = sorted.slice(0, args.limit);
    }

    // Include primary image for each product
    const productsWithImages = await Promise.all(
      sorted.map(async (product) => {
        const primaryImage = await ctx.db
          .query("productImages")
          .withIndex("by_product_primary", (q) =>
            q.eq("productId", product._id).eq("isPrimary", true)
          )
          .first();

        return {
          ...product,
          primaryImageUrl: primaryImage?.url ?? null,
        };
      })
    );

    return productsWithImages;
  },
});

// Get price range of active products
export const getProductPriceRange = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    if (products.length === 0) {
      return { min: 0, max: 1000 };
    }

    const prices = products.map((p) => p.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
    };
  },
});

// Get unique countries from active products
export const getProductCountries = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const countries = [
      ...new Set(products.map((p) => p.country).filter((c): c is string => !!c)),
    ];
    return countries.sort();
  },
});

// Get unique categories from active products
export const getProductCategories = query({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    const categories = [
      ...new Set(products.map((p) => p.category).filter((c): c is string => !!c)),
    ];
    return categories.sort();
  },
});

// Get product with all images
export const getProductWithImages = query({
  args: { id: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.id);
    if (!product) {
      return null;
    }

    const images = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", args.id))
      .collect();

    const sortedImages = images.sort((a, b) => a.order - b.order);

    // Get seller information (sellerId can be clerkId or Convex _id depending on legacy data)
    const normalizedSellerId = ctx.db.normalizeId("users", product.sellerId);
    let seller = normalizedSellerId
      ? await ctx.db.get(normalizedSellerId)
      : null;

    if (!seller) {
      seller = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", product.sellerId))
        .first();
    }
    
    // Get seller's business if they have one
    let business = null;
    if (seller?.businessId) {
      business = await ctx.db.get(seller.businessId);
    }

    return {
      ...product,
      images: sortedImages,
      seller: seller ? {
        _id: seller._id,
        clerkId: seller.clerkId,
        name: seller.name,
        imageUrl: seller.imageUrl,
      } : null,
      business: business ? {
        _id: business._id,
        name: business.name,
        country: business.country,
        verificationStatus: business.verificationStatus,
        logoUrl: business.logoUrl,
      } : null,
    };
  },
});

// Get related products (same category)
export const getRelatedProducts = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.category) {
      return [];
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Filter by same category, excluding current product
    const related = products
      .filter((p) => p.category === product.category && p._id !== args.productId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, args.limit ?? 4);

    // Include primary image for each product
    const relatedWithImages = await Promise.all(
      related.map(async (p) => {
        const primaryImage = await ctx.db
          .query("productImages")
          .withIndex("by_product_primary", (q) =>
            q.eq("productId", p._id).eq("isPrimary", true)
          )
          .first();

        return {
          ...p,
          primaryImageUrl: primaryImage?.url ?? null,
        };
      })
    );

    return relatedWithImages;
  },
});
