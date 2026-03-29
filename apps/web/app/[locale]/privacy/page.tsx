"use client";

import { PublicHeader } from "@/components/public-header";
import { PublicFooter } from "@/components/public-footer";

export default function PrivacyPolicyPage() {
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
                Privacy Policy
              </h1>
              <p className="text-sm text-muted-foreground">Last updated: March 6, 2026</p>
            </div>

            <div className="prose-custom space-y-8 text-sm text-muted-foreground leading-relaxed">
              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">1. Introduction</h2>
                <p>
                  AfriConnect (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your privacy.
                  This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                  when you use our B2B marketplace platform. By using AfriConnect, you consent to the practices
                  described in this policy.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">2. Information We Collect</h2>
                <p className="mb-3">We collect the following types of information:</p>

                <h3 className="text-sm font-medium text-foreground mb-2 mt-4">Personal Information</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Name, email address, and phone number</li>
                  <li>Business name, address, and registration details</li>
                  <li>Payment information (processed securely via Chapa)</li>
                  <li>Profile information and preferences</li>
                </ul>

                <h3 className="text-sm font-medium text-foreground mb-2 mt-4">Automatically Collected Information</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Device information (browser type, operating system)</li>
                  <li>IP address and approximate location</li>
                  <li>Usage data (pages visited, features used, time spent)</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>

                <h3 className="text-sm font-medium text-foreground mb-2 mt-4">Business Information</h3>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Business verification documents</li>
                  <li>Product listings and inventory data</li>
                  <li>Transaction history and order details</li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">3. How We Use Your Information</h2>
                <p className="mb-3">We use collected information to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Provide, maintain, and improve the Platform</li>
                  <li>Process transactions and manage subscriptions</li>
                  <li>Verify business identities and prevent fraud</li>
                  <li>Communicate service updates and promotional offers</li>
                  <li>Analyze usage patterns to enhance user experience</li>
                  <li>Comply with legal obligations and resolve disputes</li>
                  <li>Provide multilingual support (English, Amharic, Swahili)</li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">4. Information Sharing</h2>
                <p className="mb-3">We may share your information with:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong className="text-foreground">Other users</strong> — Business profiles and product listings are visible to other platform users</li>
                  <li><strong className="text-foreground">Service providers</strong> — Third-party services that help us operate the platform (payment processing, analytics, authentication)</li>
                  <li><strong className="text-foreground">Legal requirements</strong> — When required by law, regulation, or legal process</li>
                  <li><strong className="text-foreground">Business transfers</strong> — In connection with a merger, acquisition, or sale of assets</li>
                </ul>
                <p className="mt-3">We do not sell your personal information to third parties.</p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">5. Data Security</h2>
                <p>
                  We implement industry-standard security measures to protect your information, including
                  encryption in transit and at rest, secure authentication via Clerk, and regular security
                  audits. However, no method of transmission over the Internet is 100% secure, and we
                  cannot guarantee absolute security.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">6. Cookies and Tracking</h2>
                <p className="mb-3">
                  We use cookies and similar technologies for:
                </p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong className="text-foreground">Essential cookies</strong> — Required for the platform to function (authentication, preferences)</li>
                  <li><strong className="text-foreground">Analytics cookies</strong> — Help us understand usage patterns (PostHog)</li>
                  <li><strong className="text-foreground">Preference cookies</strong> — Remember your language and theme settings</li>
                </ul>
                <p className="mt-3">
                  You can manage cookie preferences through our cookie consent banner or your browser settings.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">7. Data Retention</h2>
                <p>
                  We retain your information for as long as your account is active or as needed to provide
                  services. Transaction records are retained for a minimum of 5 years for compliance purposes.
                  You may request deletion of your account and associated data at any time, subject to legal
                  retention requirements.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">8. Your Rights</h2>
                <p className="mb-3">You have the right to:</p>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>Access the personal information we hold about you</li>
                  <li>Request correction of inaccurate information</li>
                  <li>Request deletion of your data (subject to legal obligations)</li>
                  <li>Opt out of marketing communications</li>
                  <li>Export your data in a portable format</li>
                  <li>Withdraw consent for data processing</li>
                </ul>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">9. International Data Transfers</h2>
                <p>
                  As a pan-African platform, your information may be transferred to and processed in countries
                  other than your country of residence. We ensure appropriate safeguards are in place for
                  cross-border data transfers in compliance with applicable data protection laws.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">10. Children&apos;s Privacy</h2>
                <p>
                  AfriConnect is a business-to-business platform and is not intended for individuals under
                  the age of 18. We do not knowingly collect information from minors.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">11. Changes to This Policy</h2>
                <p>
                  We may update this Privacy Policy from time to time. We will notify you of material changes
                  by posting the updated policy on the Platform and updating the &ldquo;Last updated&rdquo; date.
                  Continued use of the Platform after changes constitutes acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="font-display text-lg font-normal text-foreground mb-3">12. Contact Us</h2>
                <p>
                  For questions or concerns about this Privacy Policy, or to exercise your data rights,
                  contact us at{" "}
                  <a href="mailto:privacy@africonnect.africa.com" className="text-primary hover:underline">
                    privacy@africonnect.africa.com
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
