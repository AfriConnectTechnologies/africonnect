"use client";

import { useState, useMemo } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { UserButton, useClerk, useUser } from "@clerk/nextjs";
import {
  LayoutDashboard,
  ShoppingCart,
  Settings,
  CreditCard,
  Menu,
  Store,
  Package,
  ShoppingBag,
  ChevronLeft,
  ChevronRight,
  Building2,
  Users,
  Shield,
  MessageCircle,
  RefreshCw,
  Boxes,
  Bot,
  TrendingUp,
  ClipboardList,
  Warehouse,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription, SheetClose } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@africonnect/convex/_generated/api";
import { COMMERCE_ENABLED, isComplianceEnabledForEmail } from "@/lib/features";
import { useChatContext } from "@/components/chat/ChatProvider";
import { BrandIcon } from "@/components/brand-icon";

type NavItemKey = "dashboard" | "marketplace" | "products" | "inventory" | "messages" | "cart" | "orders" | "settings" | "billing" | "myBusiness" | "creditProfile" | "registerBusiness" | "applyToSell" | "manageUsers" | "manageBusinesses" | "manageSellerApplications" | "manageProducts" | "manageRefunds" | "manageBanks" | "bankPortfolio" | "bankReferrals" | "bankAnalytics" | "compliance" | "aiAssistant";

type NavItem = {
  href: string;
  labelKey?: NavItemKey;
  label?: string;
  icon: React.ComponentType<{ className?: string }>;
  matchMode?: "exact" | "prefix";
  showBadge?: boolean;
  isCommerce?: boolean;
};

type NavSection = {
  key: string;
  items: NavItem[];
};

const navItemFallbackLabels: Record<NavItemKey, string> = {
  dashboard: "Dashboard",
  marketplace: "Marketplace",
  products: "My Products",
  inventory: "Inventory",
  messages: "Messages",
  cart: "Cart",
  orders: "Orders",
  settings: "Settings",
  billing: "Billing",
  myBusiness: "My Business",
  creditProfile: "Credit Profile",
  registerBusiness: "Verify Business",
  applyToSell: "Apply to Sell",
  manageUsers: "Manage Users",
  manageBusinesses: "Manage Businesses",
  manageSellerApplications: "Seller Applications",
  manageProducts: "Manage Products",
  manageRefunds: "Manage Refunds",
  manageBanks: "Manage Banks",
  bankPortfolio: "Bank Portfolio",
  bankReferrals: "Bank Referrals",
  bankAnalytics: "Bank Analytics",
  compliance: "AfCFTA Compliance",
  aiAssistant: "AI Assistant",
};

const browseItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/marketplace", labelKey: "marketplace", icon: Store },
];

const catalogItems: NavItem[] = [
  { href: "/products", labelKey: "products", icon: Package },
];

const sellerCatalogItems: NavItem[] = [
  { href: "/inventory", labelKey: "inventory", icon: Boxes },
];

const businessItems: NavItem[] = [
  { href: "/business/profile", labelKey: "myBusiness", icon: Building2 },
];

const sellerBusinessItems: NavItem[] = [
  { href: "/business/credit-profile", labelKey: "creditProfile", icon: TrendingUp },
];

const communicationItems: NavItem[] = [
  { href: "/messages", labelKey: "messages", icon: MessageCircle },
];

const commerceItems: NavItem[] = [
  { href: "/cart", labelKey: "cart", icon: ShoppingCart, showBadge: true, isCommerce: true },
  { href: "/orders", labelKey: "orders", icon: ShoppingBag, isCommerce: true },
  { href: "/billing", labelKey: "billing", icon: CreditCard, isCommerce: true },
];

const complianceNavItem: NavItem = {
  href: "/compliance",
  labelKey: "compliance",
  icon: Shield,
};

const aiAssistantNavItem: NavItem = {
  href: "/ai-assistant",
  labelKey: "aiAssistant",
  icon: Bot,
};

const buyerNavItems: NavItem[] = [
  { href: "/business/verify", labelKey: "registerBusiness", icon: Building2 },
];

const sellerApplicationNavItem: NavItem = {
  href: "/business/register",
  labelKey: "applyToSell",
  icon: Shield,
};

const settingsItems: NavItem[] = [
  { href: "/settings", labelKey: "settings", icon: Settings },
];

const adminNavItems: NavItem[] = [
  { href: "/admin/users", labelKey: "manageUsers", icon: Users },
  { href: "/admin/businesses", labelKey: "manageBusinesses", icon: Warehouse },
  { href: "/admin/seller-applications", labelKey: "manageSellerApplications", icon: Shield },
  { href: "/admin/products", labelKey: "manageProducts", icon: ClipboardList },
  { href: "/admin/refunds", labelKey: "manageRefunds", icon: RefreshCw },
  { href: "/admin/banks", labelKey: "manageBanks", icon: Building2 },
];

const bankNavItems: NavItem[] = [
  { href: "/bank", labelKey: "dashboard", icon: LayoutDashboard, matchMode: "exact" },
  { href: "/bank/portfolio", labelKey: "bankPortfolio", icon: Building2 },
  { href: "/bank/referrals", labelKey: "bankReferrals", icon: ClipboardList },
  { href: "/bank/analytics", labelKey: "bankAnalytics", icon: TrendingUp },
];

export function MobileSidebarTrigger() {
  const pathname = usePathname();
  const t = useTranslations("navigation");

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">{t("toggleMenu")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SheetDescription className="sr-only">Main navigation sidebar</SheetDescription>
        <SidebarContent pathname={pathname} isCollapsed={false} toggleCollapse={() => {}} isMobile={true} />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      const savedState = localStorage.getItem("sidebar-collapsed");
      return savedState ? JSON.parse(savedState) : false;
    }
    return false;
  });

  const toggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    if (typeof window !== "undefined") {
      localStorage.setItem("sidebar-collapsed", JSON.stringify(newState));
    }
  };

  return (
    <aside
      className={cn(
        "hidden shrink-0 border-r bg-card md:flex md:flex-col h-screen transition-all duration-300 relative group print:hidden",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      <SidebarContent pathname={pathname} isCollapsed={isCollapsed} toggleCollapse={toggleCollapse} isMobile={false} />
    </aside>
  );
}

function SidebarContent({
  pathname,
  isCollapsed,
  toggleCollapse,
  isMobile = false,
}: {
  pathname: string;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobile?: boolean;
}) {
  const t = useTranslations("navigation");
  const tCommon = useTranslations("common");
  const { openUserProfile, signOut } = useClerk();
  const { user } = useUser();
  const cart = useQuery(api.cart.get);
  const currentUser = useQuery(api.users.getCurrentUser);
  const myBusiness = useQuery(api.businesses.getMyBusiness);
  const { unreadCount } = useChatContext();
  const cartItemCount = cart?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const [isMobileAccountMenuOpen, setIsMobileAccountMenuOpen] = useState(false);
  const userEmail = currentUser?.email || user?.primaryEmailAddress?.emailAddress;
  const isComplianceEnabled = isComplianceEnabledForEmail(userEmail);

  const navSections = useMemo(() => {
    const role = currentUser?.role;
    const hasBusiness = currentUser?.businessId !== undefined && currentUser?.businessId !== null;
    const isEmailVerified = currentUser?.emailVerified ?? false;
    const isBusinessVerified = myBusiness?.verificationStatus === "verified";
    const isSeller = role === "seller" || role === "admin";
    const canAccessCompliance = hasBusiness && isEmailVerified && isBusinessVerified;

    const sections: NavSection[] = [];

    if (role === "bank") {
      sections.push({ key: "bank", items: [...bankNavItems] });
      sections.push({ key: "settings", items: [...settingsItems] });
      return sections;
    }

    sections.push({ key: "browse", items: [...browseItems] });

    const catalog = isSeller ? [...catalogItems] : [];
    if (isSeller) {
      catalog.push(...sellerCatalogItems);
    }
    if (catalog.length > 0) {
      sections.push({ key: "catalog", items: catalog });
    }

    if (hasBusiness) {
      const businessSectionItems = [...businessItems];
      if (isBusinessVerified && !isSeller) {
        businessSectionItems.push(sellerApplicationNavItem);
      }
      if (isSeller) {
        businessSectionItems.push(...sellerBusinessItems);
      }
      sections.push({ key: "business", items: businessSectionItems });
    } else if (role === "buyer" || role !== "admin") {
      sections.push({ key: "business", items: [...buyerNavItems] });
    }

    sections.push({ key: "communication", items: [...communicationItems] });
    sections.push({ key: "commerce", items: [...commerceItems] });

    if (canAccessCompliance && isComplianceEnabled) {
      sections.push({ key: "tools", items: [complianceNavItem, aiAssistantNavItem] });
    }

    sections.push({ key: "settings", items: [...settingsItems] });

    if (role === "admin") {
      sections.push({ key: "admin", items: [...adminNavItems] });
    }

    return sections;
  }, [
    currentUser?.role,
    currentUser?.businessId,
    currentUser?.emailVerified,
    myBusiness?.verificationStatus,
    isComplianceEnabled,
  ]);

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center border-b shrink-0", isCollapsed ? "justify-center" : "px-5")}>
        <Link
          href="/"
          className="flex items-center gap-2 cursor-pointer"
        >
          <BrandIcon className="h-7 w-7" />
          {!isCollapsed && <span className="text-base font-bold tracking-tight">AfriConnect</span>}
        </Link>
      </div>
      
      {!isMobile && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-13 z-20 hidden h-6 w-6 items-center justify-center rounded-full border bg-background shadow-md hover:bg-accent group-hover:flex"
          onClick={toggleCollapse}
        >
          {isCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
          <span className="sr-only">{t("toggleSidebar")}</span>
        </Button>
      )}

      <nav className="flex-1 overflow-y-auto py-3 px-3 min-h-0">
        {navSections.map((section, sectionIdx) => (
          <div key={section.key}>
            {sectionIdx > 0 && (
              <div className={cn("my-2", isCollapsed ? "mx-2" : "mx-2")}>
                <div className="border-t border-border/50" />
              </div>
            )}

            {section.key === "admin" && !isCollapsed && (
              <div className="flex items-center gap-2 px-3 pt-1 pb-2 text-[11px] font-semibold text-muted-foreground/70 uppercase tracking-wider">
                <Shield className="h-3 w-3" />
                <span>{tCommon("admin")}</span>
              </div>
            )}

            <div className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const label =
                  item.label ??
                  (item.labelKey
                    ? t.has(item.labelKey)
                      ? t(item.labelKey)
                      : navItemFallbackLabels[item.labelKey]
                    : item.href);
                const isActive =
                  item.matchMode === "exact"
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");
                const showCartBadge = item.showBadge && cartItemCount > 0 && COMMERCE_ENABLED;
                const showMessageBadge = item.labelKey === "messages" && unreadCount > 0;
                const showComingSoon = item.isCommerce && !COMMERCE_ENABLED;
                const badgeCount = item.labelKey === "messages" ? unreadCount : cartItemCount;
                const showBadge = showCartBadge || showMessageBadge;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center rounded-md text-sm font-medium transition-colors relative",
                      isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    title={isCollapsed ? label : undefined}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="truncate">{label}</span>
                        {showComingSoon && (
                          <Badge variant="outline" className="ml-auto h-5 px-1.5 text-[10px] shrink-0 bg-muted">
                            {tCommon("soon")}
                          </Badge>
                        )}
                        {showBadge && !showComingSoon && (
                          <Badge 
                            variant={showMessageBadge ? "destructive" : "secondary"} 
                            className="ml-auto h-5 min-w-5 px-1.5 text-xs shrink-0"
                          >
                            {badgeCount > 99 ? "99+" : badgeCount}
                          </Badge>
                        )}
                      </>
                    )}
                    {isCollapsed && showBadge && !showComingSoon && (
                      <Badge
                        variant={showMessageBadge ? "destructive" : "secondary"}
                        className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-xs shrink-0"
                      >
                        {badgeCount > 9 ? "9+" : badgeCount}
                      </Badge>
                    )}
                    {isCollapsed && showComingSoon && (
                      <Badge
                        variant="outline"
                        className="absolute -top-1 -right-1 h-4 px-1 text-[8px] shrink-0 bg-muted"
                      >
                        {tCommon("soon")}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t p-3 shrink-0">
        <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="text-sm text-muted-foreground">{tCommon("account")}</span>
              {currentUser?.role && (
                <Badge variant="outline" className="text-[11px] w-fit mt-0.5">
                  {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
                </Badge>
              )}
            </div>
          )}
          {isMobile ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileAccountMenuOpen((open) => !open)}
              aria-expanded={isMobileAccountMenuOpen}
              aria-label="Account menu"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "User"} />
                <AvatarFallback>
                  {(user?.firstName?.[0] || user?.username?.[0] || "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          ) : (
            <UserButton />
          )}
        </div>
        {isMobile && isMobileAccountMenuOpen && (
          <div className="mt-3 flex flex-col gap-2">
            <SheetClose asChild>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsMobileAccountMenuOpen(false);
                  openUserProfile();
                }}
              >
                Manage Account
              </Button>
            </SheetClose>
            <SheetClose asChild>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setIsMobileAccountMenuOpen(false);
                  signOut({ redirectUrl: "/" });
                }}
              >
                Sign Out
              </Button>
            </SheetClose>
          </div>
        )}
      </div>
    </div>
  );
}
