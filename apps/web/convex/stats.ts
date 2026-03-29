import { query } from "./_generated/server";
import { createLogger, flushLogs } from "./lib/logger";

export const getDashboardStats = query({
  args: {},
  handler: async (ctx) => {
    const log = createLogger("stats.getDashboardStats");
    
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) {
      log.debug("Dashboard stats requested - not authenticated");
      await flushLogs();
      throw new Error("Not authenticated");
    }

    log.setContext({ userId: identity.subject });

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      log.debug("Dashboard stats - user not found, returning defaults");
      await flushLogs();
      return {
        totalOrders: 0,
        totalRevenue: 0,
        pendingOrders: 0,
        completedOrders: 0,
      };
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.status === "completed")
      .reduce((sum, o) => sum + o.amount, 0);
    const pendingOrders = orders.filter(
      (o) => o.status === "pending" || o.status === "processing"
    ).length;
    const completedOrders = orders.filter((o) => o.status === "completed").length;

    log.debug("Dashboard stats retrieved", {
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
    });

    await flushLogs();
    return {
      totalOrders,
      totalRevenue,
      pendingOrders,
      completedOrders,
    };
  },
});

