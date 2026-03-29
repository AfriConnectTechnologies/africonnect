"use client";

import { SignInButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Shield,
  Store,
  Building2,
  BadgeCheck,
  Languages,
  Users,
  Package,
  ShoppingCart,
  ArrowDown,
} from "lucide-react";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/seo/JsonLd";
import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";
import { motion, useInView, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

function FadeUp({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function AmbientBlob({ className = "", delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full pointer-events-none animate-morph ${className}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 1.5, delay, ease: [0.25, 1, 0.5, 1] }}
    />
  );
}

function FeatureIllustration({ type }: { type: "marketplace" | "verification" | "payments" | "language" | "community" }) {
  const illustrations: Record<typeof type, React.ReactNode> = {
    marketplace: (
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="absolute top-6 left-8 w-20 h-14 rounded-lg bg-primary/[0.07] dark:bg-primary/[0.12] border border-primary/10" />
        <div className="absolute top-8 right-10 w-16 h-16 rounded-full bg-accent/10 dark:bg-accent/15" />
        <div className="relative bg-background dark:bg-muted/30 rounded-xl shadow-sm border border-border/60 p-5 w-[85%] max-w-[280px]">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-lg bg-primary/10 dark:bg-primary/15 flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="h-2.5 w-24 bg-foreground/10 rounded-full" />
              <div className="h-2 w-16 bg-muted-foreground/10 rounded-full mt-1.5" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, j) => (
              <div key={j} className="aspect-square rounded-lg bg-muted/50 dark:bg-muted/30 flex items-center justify-center">
                <Package className="h-3.5 w-3.5 text-muted-foreground/30" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="h-2 w-20 bg-muted-foreground/10 rounded-full" />
            <div className="h-6 w-14 rounded-md bg-primary/10 dark:bg-primary/15" />
          </div>
        </div>
      </div>
    ),
    verification: (
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="absolute top-10 left-10 w-16 h-16 rounded-full bg-green-500/[0.06] dark:bg-green-500/[0.1]" />
        <div className="absolute bottom-10 right-12 w-12 h-12 rounded-full bg-primary/[0.06] dark:bg-primary/[0.1]" />
        <div className="relative bg-background dark:bg-muted/30 rounded-xl shadow-sm border border-border/60 p-6 w-[85%] max-w-[260px]">
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-full bg-green-500/10 dark:bg-green-500/15 flex items-center justify-center ring-4 ring-green-500/5">
              <BadgeCheck className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="space-y-3">
            {["w-full", "w-4/5", "w-3/5"].map((w, j) => (
              <div key={j} className="flex items-center gap-2.5">
                <div className="h-5 w-5 rounded-full bg-green-500/10 dark:bg-green-500/15 flex items-center justify-center shrink-0">
                  <svg className="h-3 w-3 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <div className={`h-2 ${w} bg-foreground/8 rounded-full`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    payments: (
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="absolute top-8 right-8 w-20 h-20 rounded-full bg-primary/[0.05] dark:bg-primary/[0.1]" />
        <div className="relative w-[85%] max-w-[280px] space-y-3">
          <div className="bg-gradient-to-br from-primary/80 to-primary rounded-xl p-5 text-primary-foreground shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div className="h-7 w-10 rounded bg-primary-foreground/20" />
              <Shield className="h-5 w-5 text-primary-foreground/60" />
            </div>
            <div className="h-2 w-32 bg-primary-foreground/25 rounded-full mb-1.5" />
            <div className="h-2 w-20 bg-primary-foreground/15 rounded-full" />
          </div>
          <div className="bg-background dark:bg-muted/30 rounded-xl shadow-sm border border-border/60 p-4 flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-green-500/10 dark:bg-green-500/15 flex items-center justify-center shrink-0">
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <div className="flex-1">
              <div className="h-2.5 w-24 bg-foreground/10 rounded-full" />
              <div className="h-2 w-16 bg-green-600/15 rounded-full mt-1" />
            </div>
          </div>
        </div>
      </div>
    ),
    language: (
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="absolute top-6 left-6 w-14 h-14 rounded-full bg-accent/10 dark:bg-accent/15" />
        <div className="absolute bottom-8 right-10 w-18 h-18 rounded-full bg-primary/[0.05] dark:bg-primary/[0.1]" />
        <div className="relative w-[85%] max-w-[260px] space-y-2.5">
          {[
            { label: "EN", active: false },
            { label: "FR", active: true },
            { label: "SW", active: false },
            { label: "AR", active: false },
          ].map((lang, j) => (
            <div key={j} className={`bg-background dark:bg-muted/30 rounded-xl shadow-sm border p-3.5 flex items-center gap-3 transition-all ${lang.active ? "border-primary/30 ring-1 ring-primary/10" : "border-border/60"}`}>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${lang.active ? "bg-primary text-primary-foreground" : "bg-muted/60 dark:bg-muted/40 text-muted-foreground/60"}`}>
                {lang.label}
              </div>
              <div className="flex-1">
                <div className={`h-2 rounded-full ${lang.active ? "w-28 bg-foreground/12" : "w-20 bg-foreground/6"}`} />
                <div className={`h-1.5 rounded-full mt-1.5 ${lang.active ? "w-20 bg-muted-foreground/12" : "w-14 bg-muted-foreground/6"}`} />
              </div>
              {lang.active && <Languages className="h-4 w-4 text-primary/40 shrink-0" />}
            </div>
          ))}
        </div>
      </div>
    ),
    community: (
      <div className="relative w-full h-full flex items-center justify-center p-8">
        <div className="absolute top-8 left-10 w-20 h-20 rounded-full bg-primary/[0.05] dark:bg-primary/[0.1]" />
        <div className="absolute bottom-6 right-8 w-14 h-14 rounded-full bg-accent/8 dark:bg-accent/12" />
        <div className="relative bg-background dark:bg-muted/30 rounded-xl shadow-sm border border-border/60 p-6 w-[85%] max-w-[260px]">
          <div className="flex justify-center mb-4">
            <div className="flex -space-x-2.5">
              {[
                "bg-primary/20 dark:bg-primary/30",
                "bg-orange-400/20 dark:bg-orange-400/30",
                "bg-emerald-400/20 dark:bg-emerald-400/30",
                "bg-violet-400/20 dark:bg-violet-400/30",
                "bg-rose-400/20 dark:bg-rose-400/30",
              ].map((color, j) => (
                <div key={j} className={`h-10 w-10 rounded-full ${color} border-2 border-background dark:border-muted/30 flex items-center justify-center`}>
                  <Users className="h-4 w-4 text-muted-foreground/30" />
                </div>
              ))}
            </div>
          </div>
          <div className="text-center mb-4">
            <div className="h-2.5 w-24 bg-foreground/10 rounded-full mx-auto" />
            <div className="h-2 w-16 bg-muted-foreground/10 rounded-full mx-auto mt-1.5" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[...Array(3)].map((_, j) => (
              <div key={j} className="text-center">
                <div className="h-3 w-8 bg-primary/10 rounded-full mx-auto" />
                <div className="h-1.5 w-10 bg-muted-foreground/8 rounded-full mx-auto mt-1" />
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
  };

  return (
    <div className="aspect-[4/3] bg-muted/30 dark:bg-muted/15 rounded-xl border border-border/40 overflow-hidden">
      {illustrations[type]}
    </div>
  );
}

export default function LandingPage() {
  const t = useTranslations("landing");
  const scrollRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ["start start", "end end"] });
  const progressWidth = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  const features = [
    { icon: Store, titleKey: "features.marketplace", descKey: "features.marketplaceDesc", illustration: "marketplace" as const },
    { icon: BadgeCheck, titleKey: "features.verification", descKey: "features.verificationDesc", illustration: "verification" as const },
    { icon: Shield, titleKey: "features.securePayments", descKey: "features.securePaymentsDesc", illustration: "payments" as const },
    { icon: Languages, titleKey: "features.multiLanguage", descKey: "features.multiLanguageDesc", illustration: "language" as const },
    { icon: Users, titleKey: "features.community", descKey: "features.communityDesc", illustration: "community" as const },
  ];

  const steps = [
    { num: "01", titleKey: "howItWorks.step1Title", descKey: "howItWorks.step1Desc", icon: Users },
    { num: "02", titleKey: "howItWorks.step2Title", descKey: "howItWorks.step2Desc", icon: Building2 },
    { num: "03", titleKey: "howItWorks.step3Title", descKey: "howItWorks.step3Desc", icon: Package },
    { num: "04", titleKey: "howItWorks.step4Title", descKey: "howItWorks.step4Desc", icon: ShoppingCart },
  ];

  return (
    <>
      <OrganizationJsonLd
        sameAs={[
          "https://twitter.com/africonnect",
          "https://linkedin.com/company/africonnect",
          "https://facebook.com/africonnect",
        ]}
      />
      <WebsiteJsonLd />

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>

      {/* Scroll progress bar */}
      <motion.div className="fixed top-0 left-0 right-0 h-0.5 bg-primary z-[60] origin-left" style={{ width: progressWidth }} />

      <div ref={scrollRef} className="flex min-h-screen flex-col bg-background text-foreground">
        <PublicHeader />

        {/* Hero */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6">
          <AmbientBlob className="w-[500px] h-[500px] bg-primary/[0.06] dark:bg-primary/[0.1] -top-20 -left-40 blur-3xl" delay={0.2} />
          <AmbientBlob className="w-[400px] h-[400px] bg-accent/[0.08] dark:bg-accent/[0.12] -bottom-20 -right-20 blur-3xl" delay={0.5} />
          <AmbientBlob className="w-[250px] h-[250px] bg-primary/[0.05] dark:bg-primary/[0.08] top-1/3 right-1/4 blur-2xl" delay={0.8} />

          <div className="text-center max-w-4xl relative z-10">
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="text-[clamp(2.25rem,5vw,4.25rem)] font-semibold leading-[1.1] tracking-tight mb-6"
            >
              {t("hero.title")}{" "}
              <span className="italic text-primary">{t("hero.titleHighlight")}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: [0.25, 1, 0.5, 1] }}
              className="text-base text-muted-foreground max-w-lg mx-auto leading-relaxed mb-8"
            >
              {t("hero.description")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.65, ease: [0.25, 1, 0.5, 1] }}
              className="flex flex-wrap items-center justify-center gap-4 mb-10"
            >
              <SignedOut>
                <SignInButton mode="modal">
                  <Button size="lg" className="gap-2 font-medium rounded-xl px-8">{t("hero.getStarted")} <ArrowRight className="h-4 w-4" /></Button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/marketplace">
                  <Button size="lg" className="gap-2 font-medium rounded-xl px-8">{t("hero.browseMarketplace")} <ArrowRight className="h-4 w-4" /></Button>
                </Link>
              </SignedIn>
              <Link href="/explore">
                <Button size="lg" variant="outline" className="font-medium rounded-xl px-8">{t("hero.exploreProducts")}</Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="flex justify-center"
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <ArrowDown className="h-5 w-5 text-muted-foreground/50" />
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* Features - Alternating Left/Right */}
        <section id="features" className="py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6">
            <FadeUp>
              <div className="text-center mb-14">
                <p className="text-xs font-medium tracking-widest uppercase text-primary mb-3">{t("nav.features")}</p>
                <h2 className="text-[clamp(1.5rem,3vw,2.5rem)] font-semibold leading-tight">
                  {t("features.title")}
                </h2>
              </div>
            </FadeUp>

            <div className="space-y-16 lg:space-y-20">
              {features.map((feature, i) => {
                const isEven = i % 2 === 0;
                return (
                  <FadeUp key={feature.titleKey} delay={0.1}>
                    <div className={`grid lg:grid-cols-2 gap-8 lg:gap-14 items-center ${isEven ? "" : "lg:direction-rtl"}`}>
                      <div className={isEven ? "" : "lg:order-2 lg:text-right"}>
                        <div className={`flex items-center gap-2.5 mb-3 ${isEven ? "" : "lg:justify-end"}`}>
                          <div className="h-8 w-8 rounded-lg bg-primary/8 dark:bg-primary/12 flex items-center justify-center">
                            <feature.icon className="h-4 w-4 text-primary" />
                          </div>
                          <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">0{i + 1}</span>
                        </div>
                        <h3 className="text-xl lg:text-2xl font-semibold mb-3">{t(feature.titleKey)}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{t(feature.descKey)}</p>
                      </div>
                      <div className={isEven ? "lg:order-2" : ""}>
                        <FeatureIllustration type={feature.illustration} />
                      </div>
                    </div>
                  </FadeUp>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works - Vertical Timeline */}
        <section className="py-16 lg:py-24 bg-primary/[0.03] dark:bg-primary/[0.05] relative overflow-hidden">
          <AmbientBlob className="w-[350px] h-[350px] bg-primary/[0.04] dark:bg-primary/[0.08] top-20 -right-40 blur-3xl" delay={0} />
          <div className="mx-auto max-w-5xl px-6 relative z-10">
            <FadeUp>
              <div className="text-center mb-14">
                <p className="text-xs font-medium tracking-widest uppercase text-primary mb-3">{t("nav.howItWorks")}</p>
                <h2 className="text-[clamp(1.5rem,3vw,2.5rem)] font-semibold leading-tight">
                  {t("howItWorks.title")}
                </h2>
              </div>
            </FadeUp>

            <div className="relative">
              <div className="hidden md:block absolute left-1/2 -translate-x-px top-0 bottom-0 w-px bg-border" />

              <div className="space-y-16 md:space-y-0">
                {steps.map((step, i) => {
                  const isLeft = i % 2 === 0;
                  return (
                    <FadeUp key={step.num} delay={i * 0.1}>
                      <div className="md:grid md:grid-cols-2 md:gap-16 relative md:py-12">
                        <div className="hidden md:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                          <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-sm">
                            {step.num}
                          </div>
                        </div>

                        <div className={isLeft ? "md:text-right md:pr-12" : "md:col-start-2 md:pl-12"}>
                          {!isLeft && <div className="hidden md:block" />}
                          <div className="md:hidden flex items-center gap-3 mb-3">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                              {step.num}
                            </div>
                          </div>
                          <h3 className="text-xl lg:text-2xl font-semibold mb-3">{t(step.titleKey)}</h3>
                          <p className="text-muted-foreground leading-relaxed">{t(step.descKey)}</p>
                        </div>
                        {isLeft && <div className="hidden md:block" />}
                      </div>
                    </FadeUp>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="relative py-20 lg:py-28 overflow-hidden">
          <AmbientBlob className="w-[600px] h-[600px] bg-primary/[0.06] dark:bg-primary/[0.1] -top-40 left-1/2 -translate-x-1/2 blur-3xl" delay={0} />
          <div className="mx-auto max-w-3xl px-6 text-center relative z-10">
            <FadeUp>
              <h2 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-semibold leading-tight tracking-tight mb-5">
                {t("cta.title")}
              </h2>
              <p className="text-base text-muted-foreground max-w-md mx-auto leading-relaxed mb-8">
                {t("cta.description")}
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <SignedOut>
                  <SignInButton mode="modal">
                    <Button size="lg" className="gap-2 font-medium rounded-xl px-8">{t("cta.createAccount")} <ArrowRight className="h-4 w-4" /></Button>
                  </SignInButton>
                </SignedOut>
                <SignedIn>
                  <Link href="/dashboard">
                    <Button size="lg" className="gap-2 font-medium rounded-xl px-8">{t("cta.goToDashboard")} <ArrowRight className="h-4 w-4" /></Button>
                  </Link>
                </SignedIn>
                <Link href="/explore">
                  <Button size="lg" variant="outline" className="font-medium rounded-xl px-8">{t("cta.explore")}</Button>
                </Link>
              </div>
            </FadeUp>
          </div>
        </section>

        <PublicFooter />
      </div>
    </>
  );
}
