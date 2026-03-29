import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { ClerkProvider } from '@clerk/nextjs';
import ConvexClientProvider from '../ConvexClientProvider';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from '@/components/theme-provider';
import { CookieConsentBanner } from '@/components/cookie-consent-banner';
import { PostHogProvider } from '@/components/providers/posthog-provider';
import { locales, type Locale } from '@/i18n/config';

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  setRequestLocale(locale as Locale);

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <ClerkProvider>
          <ConvexClientProvider>
            <PostHogProvider>
              {children}
              <Toaster />
              <CookieConsentBanner />
            </PostHogProvider>
          </ConvexClientProvider>
        </ClerkProvider>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
