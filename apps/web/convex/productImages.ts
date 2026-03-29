import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getOrCreateUser } from "./helpers";

// Maximum number of images per product
const MAX_IMAGES_PER_PRODUCT = 5;

/**
 * Save image metadata after successful R2 upload
 */
export const saveImage = mutation({
  args: {
    productId: v.id("products"),
    r2Key: v.string(),
    url: v.string(),
    isPrimary: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    // Verify the product belongs to the user
    const product = await ctx.db.get(args.productId);
    if (!product) {
      throw new Error("Product not found");
    }

    // sellerId is stored as clerkId, not the Convex _id
    if (product.sellerId !== user.clerkId) {
      throw new Error("Unauthorized: You don't own this product");
    }

    // Get existing images for this product
    const existingImages = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    // Check if we've reached the max images limit
    if (existingImages.length >= MAX_IMAGES_PER_PRODUCT) {
      throw new Error(`Maximum of ${MAX_IMAGES_PER_PRODUCT} images allowed per product`);
    }

    // Determine order (next in sequence)
    const order = existingImages.length;

    // If this is the first image or explicitly set as primary, make it primary
    const isPrimary = args.isPrimary ?? existingImages.length === 0;

    // If setting as primary, unset any existing primary
    if (isPrimary) {
      for (const img of existingImages) {
        if (img.isPrimary) {
          await ctx.db.patch(img._id, { isPrimary: false });
        }
      }
    }

    const imageId = await ctx.db.insert("productImages", {
      productId: args.productId,
      r2Key: args.r2Key,
      url: args.url,
      order,
      isPrimary,
      createdAt: Date.now(),
    });

    return await ctx.db.get(imageId);
  },
});

/**
 * Delete an image record
 */
export const deleteImage = mutation({
  args: {
    imageId: v.id("productImages"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    // Verify ownership through product
    // sellerId is stored as clerkId, not the Convex _id
    const product = await ctx.db.get(image.productId);
    if (!product || product.sellerId !== user.clerkId) {
      throw new Error("Unauthorized");
    }

    const wasPrimary = image.isPrimary;
    const productId = image.productId;

    // Delete the image record
    await ctx.db.delete(args.imageId);

    // If deleted image was primary, make the next image primary
    if (wasPrimary) {
      const remainingImages = await ctx.db
        .query("productImages")
        .withIndex("by_product", (q) => q.eq("productId", productId))
        .collect();

      if (remainingImages.length > 0) {
        // Sort by order and make the first one primary
        const sorted = remainingImages.sort((a, b) => a.order - b.order);
        await ctx.db.patch(sorted[0]._id, { isPrimary: true });
      }
    }

    // Reorder remaining images
    const remainingImages = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", productId))
      .collect();

    const sorted = remainingImages.sort((a, b) => a.order - b.order);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].order !== i) {
        await ctx.db.patch(sorted[i]._id, { order: i });
      }
    }

    return { r2Key: image.r2Key };
  },
});

/**
 * Reorder images for a product
 */
export const reorderImages = mutation({
  args: {
    productId: v.id("products"),
    imageIds: v.array(v.id("productImages")),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    // Verify product ownership
    // sellerId is stored as clerkId, not the Convex _id
    const product = await ctx.db.get(args.productId);
    if (!product || product.sellerId !== user.clerkId) {
      throw new Error("Unauthorized");
    }

    // Update order for each image
    for (let i = 0; i < args.imageIds.length; i++) {
      const image = await ctx.db.get(args.imageIds[i]);
      if (image && image.productId === args.productId) {
        await ctx.db.patch(args.imageIds[i], { order: i });
      }
    }

    return true;
  },
});

/**
 * Set an image as the primary image for a product
 */
export const setPrimaryImage = mutation({
  args: {
    imageId: v.id("productImages"),
  },
  handler: async (ctx, args) => {
    const user = await getOrCreateUser(ctx);

    const image = await ctx.db.get(args.imageId);
    if (!image) {
      throw new Error("Image not found");
    }

    // Verify ownership through product
    // sellerId is stored as clerkId, not the Convex _id
    const product = await ctx.db.get(image.productId);
    if (!product || product.sellerId !== user.clerkId) {
      throw new Error("Unauthorized");
    }

    // Unset existing primary
    const existingImages = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", image.productId))
      .collect();

    for (const img of existingImages) {
      if (img.isPrimary && img._id !== args.imageId) {
        await ctx.db.patch(img._id, { isPrimary: false });
      }
    }

    // Set new primary
    await ctx.db.patch(args.imageId, { isPrimary: true });

    return true;
  },
});

/**
 * Get all images for a product
 */
export const getByProduct = query({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    return images.sort((a, b) => a.order - b.order);
  },
});

/**
 * Get the primary image for a product
 */
export const getPrimaryImage = query({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const images = await ctx.db
      .query("productImages")
      .withIndex("by_product_primary", (q) =>
        q.eq("productId", args.productId).eq("isPrimary", true)
      )
      .first();

    return images;
  },
});

/**
 * Delete all images for a product (used when deleting a product)
 */
export const deleteAllForProduct = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const images = await ctx.db
      .query("productImages")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    const r2Keys: string[] = [];

    for (const image of images) {
      r2Keys.push(image.r2Key);
      await ctx.db.delete(image._id);
    }

    return { r2Keys };
  },
});
