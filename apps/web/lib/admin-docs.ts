import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function hasAdminDocsAccess(): Promise<boolean> {
  const { userId, getToken } = await auth();
  if (!userId) {
    return false;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return false;
  }

  const token = await getToken({ template: "convex" });
  if (!token) {
    return false;
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  const currentUser = await convex.query(api.users.getCurrentUser);
  return currentUser?.role === "admin";
}
