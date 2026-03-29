"use client";

import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export default function TermsOfServicePage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=Figtree:wght@400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        .font-display { font-family: 'Newsreader', Georgia, serif; }
        .font-body { font-family: 'Figtree', system-ui, sans-serif; }
      `}</style>

      <div className="font-body flex min-h-screen flex-col bg-background text-foreground">
        <PublicHeader />

        <main className="flex-1 pt-28 pb-16">
          <article className="mx-auto max-w-3xl px-6">
            <div className="mb-10">
              <p className="text-xs font-medium tracking-widest uppercase text-primary mb-3">Legal</p>
              <h1 className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-normal leading-tight tracking-tight mb-3">
                Terms of Service
              </h1>
              <p className="text-sm text-muted-foreground">Last updated: March 6, 2026</p>
            </div>

            <div className="prose-custom space-y-8 text-sm text-muted-foreground leading-relaxed">
              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using AfriConnect (&ldquo;the Platform&rdquo;), you agree to be bound by these Terms of Service.
                  If you do not agree to these terms, please do not use the Platform. These terms apply to all visitors,
                  users, and others who access or use AfriConnect.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">2. Description of Service</h2>
                <p>
                  AfriConnect is a B2B marketplace platform that connects businesses across Africa. We provide tools
                  for product listing, business directory, secure transactions, and cross-border trade facilitation.
                  The Platform is available in multiple languages and supports various payment methods.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">3. User Accounts</h2>
                <p className="mb-3">
                  To access certain features, you must create an account. You are responsible for:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Providing accurate and complete registration information</li>
                  <li>Maintaining the security of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Notifying us immediately of any unauthorized access</li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">4. Business Verification</h2>
                <p>
                  Businesses listed on AfriConnect may undergo a verification process. While we strive to verify
                  the legitimacy of businesses on our platform, we do not guarantee the accuracy of business
                  information provided by third parties. Users should conduct their own due diligence before
                  engaging in transactions.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">5. Product Listings</h2>
                <p className="mb-3">
                  Sellers are responsible for ensuring that their product listings are accurate, complete,
                  and comply with applicable laws. Prohibited listings include:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Counterfeit or stolen goods</li>
                  <li>Items that violate intellectual property rights</li>
                  <li>Hazardous materials without proper documentation</li>
                  <li>Any goods prohibited by local or international law</li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">6. Payments and Transactions</h2>
                <p>
                  Payments are processed through our integrated payment system powered by Chapa. All transactions
                  are subject to applicable fees as outlined in your subscription plan. We support Mobile Money,
                  bank transfers, and card payments. Prices are displayed in USD and ETB.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">7. Subscription Plans</h2>
                <p>
                  Access to certain features requires a paid subscription. Subscription terms, pricing, and
                  features are detailed on our Pricing page. Subscriptions auto-renew unless cancelled before
                  the next billing cycle. Refunds are handled on a case-by-case basis.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">8. Intellectual Property</h2>
                <p>
                  The Platform, including its design, logos, and content, is owned by AfriConnect and protected
                  by copyright and trademark laws. Users retain ownership of content they upload but grant
                  AfriConnect a license to display and distribute that content within the Platform.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">9. Limitation of Liability</h2>
                <p>
                  AfriConnect acts as a marketplace facilitator and is not a party to transactions between
                  buyers and sellers. We are not liable for the quality, safety, or legality of items listed,
                  the accuracy of listings, or the ability of sellers to fulfill orders. Our total liability
                  shall not exceed the fees paid by you in the twelve months prior to the claim.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">10. Termination</h2>
                <p>
                  We may suspend or terminate your account at our discretion if you violate these terms.
                  Upon termination, your right to use the Platform ceases immediately. Any pending
                  transactions will be handled according to our dispute resolution process.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">11. Governing Law</h2>
                <p>
                  These terms are governed by and construed in accordance with applicable laws. Any disputes
                  arising from or relating to these terms shall be resolved through arbitration or in courts
                  of competent jurisdiction.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">12. Contact</h2>
                <p>
                  For questions about these Terms of Service, please contact us at{" "}
                  <a href="mailto:legal@africonnect.africa.com" className="text-primary hover:underline">
                    legal@africonnect.africa.com
                  </a>.
                </p>
              </section>
            </div>
          </article>
        </main>

        <PublicFooter />
      </div>
    </>
  );
}
