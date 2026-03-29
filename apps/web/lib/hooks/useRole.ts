"use client";

import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api } from "@africonnect/convex/_generated/api";

export type UserRole = "buyer" | "seller" | "admin" | "bank";

/**
 * Hook to get the current user's role.
 * Returns null if loading, undefined if not authenticated.
 */
export function useCurrentRole(): UserRole | null | undefined {
  const role = useQuery(api.users.getUserRole);
  return role as UserRole | null | undefined;
}

/**
 * Hook to get the current user with all their data.
 */
export function useCurrentUser() {
  return useQuery(api.users.getCurrentUser);
}

/**
 * Hook to check if current user is an admin.
 */
export function useIsAdmin(): boolean {
  const role = useCurrentRole();
  return role === "admin";
}

/**
 * Hook to check if current user is a seller.
 */
export function useIsSeller(): boolean {
  const role = useCurrentRole();
  return role === "seller" || role === "admin";
}

/**
 * Hook to check if current user is a buyer.
 */
export function useIsBuyer(): boolean {
  const role = useCurrentRole();
  return role === "buyer";
}

/**
 * Hook to check if current user is a bank user.
 */
export function useIsBank(): boolean {
  const role = useCurrentRole();
  return role === "bank";
}

/**
 * Hook to require a specific role. Redirects if user doesn't have the required role.
 * @param requiredRole - The role(s) required to access the resource
 * @param redirectTo - Where to redirect if unauthorized (default: /dashboard)
 */
export function useRequireRole(
  requiredRole: UserRole | UserRole[],
  redirectTo: string = "/dashboard"
): {
  isLoading: boolean;
  isAuthorized: boolean;
  role: UserRole | null | undefined;
} {
  const router = useRouter();
  const role = useCurrentRole();
  const currentUser = useCurrentUser();

  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  const isLoading = role === undefined || currentUser === undefined;
  const isAuthorized = !isLoading && role !== null && roles.includes(role);

  useEffect(() => {
    // Wait for loading to complete
    if (isLoading) return;

    // If not authenticated or doesn't have required role, redirect
    if (!isAuthorized) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthorized, router, redirectTo]);

  return {
    isLoading,
    isAuthorized,
    role,
  };
}

/**
 * Hook to require admin role.
 */
export function useRequireAdmin(redirectTo: string = "/dashboard") {
  return useRequireRole("admin", redirectTo);
}

/**
 * Hook to require seller role (includes admin).
 */
export function useRequireSeller(redirectTo: string = "/dashboard") {
  return useRequireRole(["seller", "admin"], redirectTo);
}

/**
 * Hook to require bank role.
 */
export function useRequireBank(redirectTo: string = "/dashboard") {
  return useRequireRole("bank", redirectTo);
}

/**
 * Hook to check if user has a business registered.
 */
export function useHasBusiness(): boolean {
  const currentUser = useCurrentUser();
  return currentUser?.businessId !== undefined && currentUser?.businessId !== null;
}
