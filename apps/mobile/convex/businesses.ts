import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUser, getOrCreateUser } from "./helpers";

// Create a new business (user becomes a seller)
export const createBusiness = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    country: v.string(),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    // Check if user already has a business
    if (user.businessId) {
      throw new Error("You already have a registered business");
    }

    const now = Date.now();
    const businessId = await ctx.db.insert("businesses", {
      ownerId: user._id,
      name: args.name,
      description: args.description,
      country: args.country,
      city: args.city,
      address: args.address,
      phone: args.phone,
      website: args.website,
      category: args.category,
      verificationStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Update user to seller role and link business
    await ctx.db.patch(user._id, {
      role: "seller",
      businessId: businessId,
    });

    const business = await ctx.db.get(businessId);
    
    // Return business with owner info for email notifications
    return {
      ...business,
      ownerEmail: user.email,
      ownerName: user.name,
    };
  },
});

// Update business profile (seller only, own business)
export const updateBusiness = mutation({
  args: {
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    country: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    phone: v.optional(v.string()),
    website: v.optional(v.string()),
    category: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      throw new Error("You don't have a registered business");
    }

    const business = await ctx.db.get(user.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    // Only owner can update their business
    if (business.ownerId !== user._id) {
      throw new Error("Unauthorized: You can only update your own business");
    }

    const updates: Partial<typeof args & { updatedAt: number }> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.country !== undefined) updates.country = args.country;
    if (args.city !== undefined) updates.city = args.city;
    if (args.address !== undefined) updates.address = args.address;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.website !== undefined) updates.website = args.website;
    if (args.category !== undefined) updates.category = args.category;
    if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl;

    await ctx.db.patch(user.businessId, updates);

    return await ctx.db.get(user.businessId);
  },
});

// Get business by ID
export const getBusiness = query({
  args: {
    businessId: v.id("businesses"),
  },
  handler: async (ctx, args) => {
    const business = await ctx.db.get(args.businessId);
    if (!business) {
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
            email: owner.email,
            imageUrl: owner.imageUrl,
          }
        : null,
    };
  },
});

// Get current user's business
export const getMyBusiness = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);

    if (!user.businessId) {
      return null;
    }

    return await ctx.db.get(user.businessId);
  },
});

// List all businesses with filters (admin only)
export const listBusinesses = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("verified"), v.literal("rejected"))
    ),
    country: v.optional(v.string()),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let businesses;

    if (args.status) {
      businesses = await ctx.db
        .query("businesses")
        .withIndex("by_status", (q) => q.eq("verificationStatus", args.status!))
        .collect();
    } else {
      businesses = await ctx.db.query("businesses").collect();
    }

    // Apply additional filters
    if (args.country) {
      businesses = businesses.filter((b) => b.country === args.country);
    }

    if (args.category) {
      businesses = businesses.filter((b) => b.category === args.category);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      businesses = businesses.filter(
        (b) =>
          b.name.toLowerCase().includes(searchLower) ||
          b.description?.toLowerCase().includes(searchLower)
      );
    }

    // Fetch owner info for each business
    const businessesWithOwner = await Promise.all(
      businesses.map(async (business) => {
        const owner = await ctx.db.get(business.ownerId);
        return {
          ...business,
          owner: owner
            ? {
                _id: owner._id,
                name: owner.name,
                email: owner.email,
              }
            : null,
        };
      })
    );

    return businessesWithOwner.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// Verify or reject business (admin only)
export const verifyBusiness = mutation({
  args: {
    businessId: v.id("businesses"),
    status: v.union(v.literal("verified"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const business = await ctx.db.get(args.businessId);
    if (!business) {
      throw new Error("Business not found");
    }

    await ctx.db.patch(args.businessId, {
      verificationStatus: args.status,
      updatedAt: Date.now(),
    });

    const updatedBusiness = await ctx.db.get(args.businessId);
    
    // Get owner info for email notification
    const owner = await ctx.db.get(business.ownerId);
    
    return {
      ...updatedBusiness,
      ownerEmail: owner?.email,
      ownerName: owner?.name,
    };
  },
});

// Get unique countries from businesses (for filters)
export const getCountries = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db.query("businesses").collect();
    const countries = [...new Set(businesses.map((b) => b.country))];
    return countries.sort();
  },
});

// Get unique categories from businesses (for filters)
export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const businesses = await ctx.db.query("businesses").collect();
    const categories = [...new Set(businesses.map((b) => b.category))];
    return categories.sort();
  },
});

// Public directory - list verified businesses
export const publicDirectory = query({
  args: {
    country: v.optional(v.string()),
    category: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let businesses = await ctx.db
      .query("businesses")
      .withIndex("by_status", (q) => q.eq("verificationStatus", "verified"))
      .collect();

    // Apply filters
    if (args.country) {
      businesses = businesses.filter((b) => b.country === args.country);
    }

    if (args.category) {
      businesses = businesses.filter((b) => b.category === args.category);
    }

    if (args.search) {
      const searchLower = args.search.toLowerCase();
      businesses = businesses.filter(
        (b) =>
          b.name.toLowerCase().includes(searchLower) ||
          b.description?.toLowerCase().includes(searchLower)
      );
    }

    const sorted = businesses.sort((a, b) => b.createdAt - a.createdAt);

    if (args.limit && args.limit > 0) {
      return sorted.slice(0, args.limit);
    }

    return sorted;
  },
});
