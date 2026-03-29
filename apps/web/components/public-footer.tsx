"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Globe2 } from "lucide-react";
import { BrandIcon } from "@/components/brand-icon";

export function PublicFooter() {
  const t = useTranslations("landing");

  return (
    <footer className="border-t border-border py-12">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <Link href="/" className="flex items-center gap-2 mb-4">
              <BrandIcon className="h-4 w-4" size={16} />
              <span className="font-display text-base font-medium">AfriConnect</span>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed">{t("footer.tagline")}</p>
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-4">{t("footer.marketplace")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/explore" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.browseProducts")}</Link></li>
              <li><Link href="#categories" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.categories")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-4">{t("footer.forBusinesses")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/business/register" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.registerBusiness")}</Link></li>
              <li><Link href="/products" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.listProducts")}</Link></li>
              <li><Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.dashboard")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-4">{t("footer.legal")}</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.privacyPolicy")}</Link></li>
              <li><Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">{t("footer.termsOfService")}</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-10 pt-5 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>&copy; {new Date().getFullYear()} AfriConnect. {t("footer.allRightsReserved")}</span>
          <span className="flex items-center gap-1.5"><Globe2 className="h-3 w-3" />{t("footer.madeForAfrica")}</span>
        </div>
      </div>
    </footer>
  );
}
