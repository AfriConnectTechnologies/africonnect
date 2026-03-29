"use client";

import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { BrandIcon } from "@/components/brand-icon";

export function PublicHeader() {
  const t = useTranslations("landing");

  return (
    <header className="fixed top-2 left-4 right-4 z-50">
      <nav className="mx-auto max-w-6xl bg-background/80 backdrop-blur-md border border-border rounded-2xl flex h-14 items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandIcon className="h-7 w-7" size={28} priority />
          <span className="font-display text-lg leading-none font-medium">AfriConnect</span>
        </Link>

        <div className="hidden md:flex items-center gap-7">
          <Link href="/explore" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("nav.marketplace")}</Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("nav.pricing")}</Link>
          <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{t("nav.features")}</Link>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <LanguageSwitcher />
          <ThemeToggle />
          <SignedOut>
            <SignInButton mode="modal"><Button variant="ghost" size="sm" className="text-sm">{t("nav.signIn")}</Button></SignInButton>
            <SignInButton mode="modal"><Button size="sm" className="text-sm rounded-xl">{t("nav.getStarted")}</Button></SignInButton>
          </SignedOut>
          <SignedIn>
            <Link href="/dashboard"><Button variant="ghost" size="sm">{t("nav.dashboard")}</Button></Link>
            <UserButton />
          </SignedIn>
        </div>

        <div className="flex sm:hidden items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Sheet>
            <SheetTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9"><Menu className="h-5 w-5" /></Button></SheetTrigger>
            <SheetContent side="right" className="w-72 p-6">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <nav className="flex flex-col gap-5 mt-8">
                <Link href="/explore" className="font-display text-lg">{t("nav.marketplace")}</Link>
                <Link href="/pricing" className="font-display text-lg">{t("nav.pricing")}</Link>
                <Link href="/#features" className="font-display text-lg">{t("nav.features")}</Link>
                <div className="mt-4">
                  <SignedOut><SignInButton mode="modal"><Button className="w-full rounded-xl">{t("nav.getStarted")}</Button></SignInButton></SignedOut>
                  <SignedIn><Link href="/dashboard"><Button className="w-full rounded-xl">{t("nav.dashboard")}</Button></Link></SignedIn>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
