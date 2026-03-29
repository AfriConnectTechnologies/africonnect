import { query } from "./_generated/server";
import { v } from "convex/values";

// List verified businesses with filters (public)
export const listBusinesses = query({
  args: {
    country: v.optional(v.string()),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Only show verified businesses
    let businesses = await ctx.db
      .query("businesses")
      .withIndex("by_status", (q) => q.eq("verificationStatus", "verified"))
      .collect();

    // Apply country filter
    if (args.country) {
      businesses = businesses.filter((b) => b.country === args.country);
    }

    // Apply category filter
    if (args.category) {
      businesses = businesses.filter((b) => b.category === args.category);
    }

    // Apply search filter
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      businesses = businesses.filter(
        (b) =>
          b.name.toLowerCase().includes(searchLower) ||
          b.description?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by newest first
    const sorted = businesses.sort((a, b) => b.createdAt - a.createdAt);

    // Apply limit if specified
    const limited = args.limit && args.limit > 0 ? sorted.slice(0, args.limit) : sorted;

    // Get product counts for each business
    const businessesWithStats = await Promise.all(
      limited.map(async (business) => {
        // Get owner to find their products
        const owner = await ctx.db.get(business.ownerId);
        let productCount = 0;

        if (owner) {
          const products = await ctx.db
            .query("products")
            .withIndex("by_seller_status", (q) =>
              q.eq("sellerId", owner._id).eq("status", "active")
            )
            .collect();
          productCount = products.length;
        }

        return {
          ...business,
          productCount,
        };
      })
    );

    return businessesWithStats;
  },
});

// Get a single business with full details
export const getBusiness = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) {
      return null;
    }

    // Only show verified businesses publicly
    if (business.verificationStatus !== "verified") {
      return null;
    }

    // Get owner info
    const owner = await ctx.db.get(business.ownerId);

    return {
      ...business,
      owner: owner
        ? {
            _id: owner._id,
            name: owner.name,
            imageUrl: owner.imageUrl,
          }
        : null,
    };
  },
});

// Get products for a specific business
export const getBusinessProducts = query({
  args: {
    businessId: v.id("businesses"),
    category: v.optional(v.string()),
    sortBy: v.optional(
      v.union(
        v.literal("newest"),
        v.literal("price_asc"),
        v.literal("price_desc")
      )
    ),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business || business.verificationStatus !== "verified") {
      return [];
    }

    // Get owner to find their products
    const owner = await ctx.db.get(business.ownerId);
    if (!owner) {
      return [];
    }

    let products = await ctx.db
      .query("products")
      .withIndex("by_seller_status", (q) =>
        q.eq("sellerId", owner._id).eq("status", "active")
      )
      .collect();

    // Apply category filter
    if (args.category) {
      products = products.filter((p) => p.category === args.category);
    }

    // Apply sorting
    const sortBy = args.sortBy ?? "newest";
    let sorted: typeof products;
    switch (sortBy) {
      case "price_asc":
        sorted = products.sort((a, b) => a.price - b.price);
        break;
      case "price_desc":
        sorted = products.sort((a, b) => b.price - a.price);
        break;
      case "newest":
      default:
        sorted = products.sort((a, b) => b.createdAt - a.createdAt);
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

// Get business statistics (product count, categories)
export const getBusinessStats = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business || business.verificationStatus !== "verified") {
      return null;
    }

    // Get owner to find their products
    const owner = await ctx.db.get(business.ownerId);
    if (!owner) {
      return {
        productCount: 0,
        categories: [],
      };
    }

    const products = await ctx.db
      .query("products")
      .withIndex("by_seller_status", (q) =>
        q.eq("sellerId", owner._id).eq("status", "active")
      )
      .collect();

    const categories = [
      ...new Set(products.map((p) => p.category).filter((c): c is string => !!c)),
    ];

    return {
      productCount: products.length,
      categories: categories.sort(),
    };
  },
});

// Get unique countries from verified businesses
export const getCountries = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_status", (q) => q.eq("verificationStatus", "verified"))
      .collect();

    const countries = [...new Set(businesses.map((b) => b.country))];
    return countries.sort();
  },
});

// Get unique categories from verified businesses
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_status", (q) => q.eq("verificationStatus", "verified"))
      .collect();

    const categories = [...new Set(businesses.map((b) => b.category))];
    return categories.sort();
  },
});

// Search businesses by name or description
export const searchBusinesses = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) {
      return [];
    }

    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_status", (q) => q.eq("verificationStatus", "verified"))
      .collect();

    const searchLower = args.query.toLowerCase();
    const filtered = businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(searchLower) ||
        b.description?.toLowerCase().includes(searchLower) ||
        b.category.toLowerCase().includes(searchLower) ||
        b.country.toLowerCase().includes(searchLower)
    );

    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    const limited = args.limit && args.limit > 0 ? sorted.slice(0, args.limit) : sorted;

    return limited;
  },
});
