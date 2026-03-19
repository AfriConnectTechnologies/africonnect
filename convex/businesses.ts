import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, requireUser, getOrCreateUser, hasSellerAccess } from "./helpers";
import { createLogger, flushLogs } from "./lib/logger";

const nullableOptionalString = v.optional(v.union(v.string(), v.null()));

// Create a new business (verification starts as pending)
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
    businessLicenceImageUrl: v.optional(v.string()),
    businessLicenceNumber: v.optional(v.string()),
    memoOfAssociationImageUrl: v.optional(v.string()),
    tinCertificateImageUrl: v.optional(v.string()),
    tinCertificateNumber: v.optional(v.string()),
    hasImportExportPermit: v.optional(v.boolean()),
    importExportPermitImageUrl: v.optional(v.string()),
    importExportPermitNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("businesses.createBusiness");
    
    try {
      log.info("Business creation initiated", {
        name: args.name,
        country: args.country,
        city: args.city,
        category: args.category,
      });

      const user = await getOrCreateUser(ctx);
      log.setContext({ userId: user.clerkId });

      if (!args.businessLicenceImageUrl) {
        throw new Error("Business licence document upload is required.");
      }

      if (!args.memoOfAssociationImageUrl) {
        throw new Error("Memo of association document upload is required.");
      }

      if (!args.tinCertificateImageUrl) {
        throw new Error("TIN certificate document upload is required.");
      }

      if (args.hasImportExportPermit && !args.importExportPermitImageUrl) {
        throw new Error("Import/export permit document upload is required.");
      }

      // Check if user already has a business
      if (user.businessId) {
        log.warn("Business creation failed - user already has a business", {
          existingBusinessId: user.businessId,
        });
        await flushLogs();
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
        businessLicenceImageUrl: args.businessLicenceImageUrl,
        businessLicenceNumber: args.businessLicenceNumber,
        memoOfAssociationImageUrl: args.memoOfAssociationImageUrl,
        tinCertificateImageUrl: args.tinCertificateImageUrl,
        tinCertificateNumber: args.tinCertificateNumber,
        hasImportExportPermit: args.hasImportExportPermit,
        importExportPermitImageUrl: args.importExportPermitImageUrl,
        importExportPermitNumber: args.importExportPermitNumber,
        verificationStatus: "pending",
        createdAt: now,
        updatedAt: now,
      });

      log.setContext({ businessId });

      // Link business; seller role is granted only after verification approval.
      await ctx.db.patch(user._id, {
        businessId: businessId,
      });

      log.info("Business created successfully", {
        businessId,
        businessName: args.name,
        country: args.country,
        category: args.category,
        ownerRole: user.role ?? "buyer",
        verificationStatus: "pending",
      });

      const business = await ctx.db.get(businessId);
      
      await flushLogs();
      
      // Return business with owner info for email notifications
      return {
        ...business,
        ownerEmail: user.email,
        ownerName: user.name,
      };
    } catch (error) {
      log.error("Business creation failed", error, {
        name: args.name,
        country: args.country,
        category: args.category,
      });
      await flushLogs();
      throw error;
    }
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
    businessLicenceImageUrl: nullableOptionalString,
    businessLicenceNumber: nullableOptionalString,
    memoOfAssociationImageUrl: nullableOptionalString,
    tinCertificateImageUrl: nullableOptionalString,
    tinCertificateNumber: nullableOptionalString,
    hasImportExportPermit: v.optional(v.boolean()),
    importExportPermitImageUrl: nullableOptionalString,
    importExportPermitNumber: nullableOptionalString,
    payoutBankCode: v.optional(v.string()),
    payoutBankName: v.optional(v.string()),
    payoutAccountNumber: v.optional(v.string()),
    payoutAccountName: v.optional(v.string()),
    payoutEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const log = createLogger("businesses.updateBusiness");
    
    try {
      log.info("Business update initiated", {
        fieldsToUpdate: Object.keys(args).filter(k => args[k as keyof typeof args] !== undefined),
      });

      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId });

      if (!user.businessId) {
        log.warn("Business update failed - no business registered");
        await flushLogs();
        throw new Error("You don't have a registered business");
      }

      const isPayoutUpdateRequested =
        args.payoutBankCode !== undefined ||
        args.payoutBankName !== undefined ||
        args.payoutAccountNumber !== undefined ||
        args.payoutAccountName !== undefined ||
        args.payoutEnabled !== undefined;

      if (isPayoutUpdateRequested && !hasSellerAccess(user)) {
        log.warn("Business update failed - seller access required for payout update");
        await flushLogs();
        throw new Error("Unauthorized: Seller access required");
      }

      log.setContext({ businessId: user.businessId });

      const business = await ctx.db.get(user.businessId);
      if (!business) {
        log.error("Business update failed - not found", undefined, {
          businessId: user.businessId,
        });
        await flushLogs();
        throw new Error("Business not found");
      }

      // Only owner can update their business
      if (business.ownerId !== user._id) {
        log.warn("Business update failed - unauthorized", {
          businessOwnerId: business.ownerId,
          requestingUserId: user._id,
        });
        await flushLogs();
        throw new Error("Unauthorized: You can only update your own business");
      }

      const updates: Partial<
        typeof args & {
          updatedAt: number;
          payoutUpdatedAt: number;
          verificationStatus: "pending" | "verified" | "rejected";
        }
      > = {
        updatedAt: Date.now(),
      };
      const verificationFieldNames = [
        "name",
        "description",
        "country",
        "city",
        "address",
        "phone",
        "website",
        "category",
        "businessLicenceImageUrl",
        "businessLicenceNumber",
        "memoOfAssociationImageUrl",
        "tinCertificateImageUrl",
        "tinCertificateNumber",
        "hasImportExportPermit",
        "importExportPermitImageUrl",
        "importExportPermitNumber",
      ] as const;
      const finalBusinessLicenceImageUrl =
        args.businessLicenceImageUrl !== undefined
          ? args.businessLicenceImageUrl
          : business.businessLicenceImageUrl;
      const finalMemoOfAssociationImageUrl =
        args.memoOfAssociationImageUrl !== undefined
          ? args.memoOfAssociationImageUrl
          : business.memoOfAssociationImageUrl;
      const finalTinCertificateImageUrl =
        args.tinCertificateImageUrl !== undefined
          ? args.tinCertificateImageUrl
          : business.tinCertificateImageUrl;
      const finalHasImportExportPermit =
        args.hasImportExportPermit !== undefined
          ? args.hasImportExportPermit
          : business.hasImportExportPermit;
      const finalImportExportPermitImageUrl =
        args.importExportPermitImageUrl !== undefined
          ? args.importExportPermitImageUrl
          : business.importExportPermitImageUrl;
      const verificationDocumentFieldsChanged =
        (args.businessLicenceImageUrl !== undefined &&
          args.businessLicenceImageUrl !== business.businessLicenceImageUrl) ||
        (args.businessLicenceNumber !== undefined &&
          args.businessLicenceNumber !== business.businessLicenceNumber) ||
        (args.memoOfAssociationImageUrl !== undefined &&
          args.memoOfAssociationImageUrl !== business.memoOfAssociationImageUrl) ||
        (args.tinCertificateImageUrl !== undefined &&
          args.tinCertificateImageUrl !== business.tinCertificateImageUrl) ||
        (args.tinCertificateNumber !== undefined &&
          args.tinCertificateNumber !== business.tinCertificateNumber) ||
        (args.hasImportExportPermit !== undefined &&
          args.hasImportExportPermit !== business.hasImportExportPermit) ||
        ((finalHasImportExportPermit ?? false) &&
          args.importExportPermitImageUrl !== undefined &&
          args.importExportPermitImageUrl !== business.importExportPermitImageUrl) ||
        ((finalHasImportExportPermit ?? false) &&
          args.importExportPermitNumber !== undefined &&
          args.importExportPermitNumber !== business.importExportPermitNumber);

      if (!finalBusinessLicenceImageUrl) {
        throw new Error("Business licence document upload is required.");
      }

      if (!finalMemoOfAssociationImageUrl) {
        throw new Error("Memo of association document upload is required.");
      }

      if (!finalTinCertificateImageUrl) {
        throw new Error("TIN certificate document upload is required.");
      }

      if (finalHasImportExportPermit && !finalImportExportPermitImageUrl) {
        throw new Error("Import/export permit document upload is required.");
      }

      if (args.name !== undefined) updates.name = args.name;
      if (args.description !== undefined) updates.description = args.description;
      if (args.country !== undefined) updates.country = args.country;
      if (args.city !== undefined) updates.city = args.city;
      if (args.address !== undefined) updates.address = args.address;
      if (args.phone !== undefined) updates.phone = args.phone;
      if (args.website !== undefined) updates.website = args.website;
      if (args.category !== undefined) updates.category = args.category;
      if (args.logoUrl !== undefined) updates.logoUrl = args.logoUrl;
      if (args.businessLicenceImageUrl !== undefined) updates.businessLicenceImageUrl = args.businessLicenceImageUrl;
      if (args.businessLicenceNumber !== undefined) updates.businessLicenceNumber = args.businessLicenceNumber;
      if (args.memoOfAssociationImageUrl !== undefined) updates.memoOfAssociationImageUrl = args.memoOfAssociationImageUrl;
      if (args.tinCertificateImageUrl !== undefined) updates.tinCertificateImageUrl = args.tinCertificateImageUrl;
      if (args.tinCertificateNumber !== undefined) updates.tinCertificateNumber = args.tinCertificateNumber;
      if (args.hasImportExportPermit !== undefined) updates.hasImportExportPermit = args.hasImportExportPermit;
      if (args.importExportPermitImageUrl !== undefined) updates.importExportPermitImageUrl = args.importExportPermitImageUrl;
      if (args.importExportPermitNumber !== undefined) updates.importExportPermitNumber = args.importExportPermitNumber;
      if (isPayoutUpdateRequested) {
        if (args.payoutBankCode !== undefined) updates.payoutBankCode = args.payoutBankCode;
        if (args.payoutBankName !== undefined) updates.payoutBankName = args.payoutBankName;
        if (args.payoutAccountNumber !== undefined) updates.payoutAccountNumber = args.payoutAccountNumber;
        if (args.payoutAccountName !== undefined) updates.payoutAccountName = args.payoutAccountName;
        if (args.payoutEnabled !== undefined) updates.payoutEnabled = args.payoutEnabled;
        updates.payoutUpdatedAt = Date.now();
      }

      const shouldResubmitForReview =
        (business.verificationStatus === "rejected" &&
          verificationFieldNames.some(
            (fieldName) =>
              args[fieldName] !== undefined &&
              args[fieldName] !== business[fieldName]
          )) ||
        (business.verificationStatus === "verified" &&
          verificationDocumentFieldsChanged);

      if (shouldResubmitForReview) {
        updates.verificationStatus = "pending";
      }

      await ctx.db.patch(user.businessId, updates);

      log.info("Business updated successfully", {
        businessId: user.businessId,
        businessName: updates.name || business.name,
        fieldsUpdated: Object.keys(updates).filter(k => k !== "updatedAt"),
      });

      await flushLogs();
      return await ctx.db.get(user.businessId);
    } catch (error) {
      log.error("Business update failed", error);
      await flushLogs();
      throw error;
    }
  },
});

// Update payout settings (seller only)
export const updatePayoutSettings = mutation({
  args: {
    payoutBankCode: v.string(),
    payoutBankName: v.string(),
    payoutAccountNumber: v.string(),
    payoutAccountName: v.string(),
  },
  handler: async (ctx, args) => {
    const log = createLogger("businesses.updatePayoutSettings");

    try {
      const user = await requireUser(ctx);
      log.setContext({ userId: user.clerkId });

      if (!hasSellerAccess(user)) {
        throw new Error("Unauthorized: Seller access required");
      }

      if (!user.businessId) {
        throw new Error("You don't have a registered business");
      }

      const business = await ctx.db.get(user.businessId);
      if (!business) {
        throw new Error("Business not found");
      }

      if (business.ownerId !== user._id) {
        throw new Error("Unauthorized: You can only update your own business");
      }

      const now = Date.now();
      await ctx.db.patch(user.businessId, {
        payoutBankCode: args.payoutBankCode,
        payoutBankName: args.payoutBankName,
        payoutAccountNumber: args.payoutAccountNumber,
        payoutAccountName: args.payoutAccountName,
        payoutEnabled: true,
        payoutUpdatedAt: now,
        updatedAt: now,
      });

      log.info("Payout settings updated", {
        businessId: user.businessId,
        payoutBankCode: args.payoutBankCode,
      });

      await flushLogs();
      return await ctx.db.get(user.businessId);
    } catch (error) {
      log.error("Payout settings update failed", error);
      await flushLogs();
      throw error;
    }
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
            clerkId: owner.clerkId,
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
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      return null;
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    if (!user.businessId) {
      return null;
    }

    const business = await ctx.db.get(user.businessId);
    if (!business) {
      return null;
    }

    return business;
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

// Check if a document URL is stored on any business (admin only). Used to authorize document view.
// Uses indexed lookups (O(1) per field) instead of scanning all businesses.
export const isDocumentUrlAllowed = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const [byLicence, byMemo, byTin, byPermit] = await Promise.all([
      ctx.db
        .query("businesses")
        .withIndex("by_businessLicenceImageUrl", (q) =>
          q.eq("businessLicenceImageUrl", args.url)
        )
        .first(),
      ctx.db
        .query("businesses")
        .withIndex("by_memoOfAssociationImageUrl", (q) =>
          q.eq("memoOfAssociationImageUrl", args.url)
        )
        .first(),
      ctx.db
        .query("businesses")
        .withIndex("by_tinCertificateImageUrl", (q) =>
          q.eq("tinCertificateImageUrl", args.url)
        )
        .first(),
      ctx.db
        .query("businesses")
        .withIndex("by_importExportPermitImageUrl", (q) =>
          q.eq("importExportPermitImageUrl", args.url)
        )
        .first(),
    ]);
    return !!(byLicence ?? byMemo ?? byTin ?? byPermit);
  },
});

// Verify or reject business (admin only)
export const verifyBusiness = mutation({
  args: {
    businessId: v.id("businesses"),
    status: v.union(v.literal("verified"), v.literal("rejected")),
  },
  handler: async (ctx, args) => {
    const log = createLogger("businesses.verifyBusiness");
    
    try {
      log.info("Business verification initiated", {
        businessId: args.businessId,
        newStatus: args.status,
      });

      const admin = await requireAdmin(ctx);
      log.setContext({ userId: admin.clerkId, businessId: args.businessId });

      const business = await ctx.db.get(args.businessId);
      if (!business) {
        log.error("Business verification failed - not found", undefined, {
          businessId: args.businessId,
        });
        await flushLogs();
        throw new Error("Business not found");
      }

      const previousStatus = business.verificationStatus;
      const owner = await ctx.db.get(business.ownerId);

      if (!owner) {
        log.error("Business verification failed - owner not found", undefined, {
          businessId: args.businessId,
          ownerId: business.ownerId,
        });
        await flushLogs();
        throw new Error("Business owner not found");
      }

      await ctx.db.patch(args.businessId, {
        verificationStatus: args.status,
        updatedAt: Date.now(),
      });

      const updatedBusiness = await ctx.db.get(args.businessId);

      log.info("Business verification completed", {
        businessId: args.businessId,
        businessName: business.name,
        previousStatus,
        newStatus: args.status,
        ownerRoleAfterReview: owner.role,
        ownerId: business.ownerId,
        ownerEmailPresent: !!owner?.email, // Don't log PII, just indicate presence
        adminId: admin._id,
      });

      await flushLogs();
      
      return {
        ...updatedBusiness,
        ownerEmail: owner?.email,
        ownerName: owner?.name,
      };
    } catch (error) {
      log.error("Business verification failed", error, {
        businessId: args.businessId,
        newStatus: args.status,
      });
      await flushLogs();
      throw error;
    }
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
