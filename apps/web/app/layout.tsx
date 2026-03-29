import type { Metadata, Viewport } from 'next'
import { getLocale } from 'next-intl/server'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://africonnect.africa.com'

export const metadata: Metadata = {
  title: {
    default: 'AfriConnect - Africa\'s Premier B2B Marketplace | Cross-Border Trade & Shipping',
    template: '%s | AfriConnect',
  },
  description: 'Connect with verified suppliers across Africa. Source products, handle cross-border logistics, customs, and secure payments. Join 10,000+ businesses trading on AfriConnect - Your Bridge to African Markets.',
  keywords: [
    'B2B marketplace',
    'Africa trade',
    'African suppliers',
    'cross-border shipping',
    'wholesale suppliers',
    'African products',
    'international trade',
    'African business directory',
    'Pan-African marketplace',
    'African manufacturers',
    'import export Africa',
    'African commodities',
    'trade platform Africa',
  ],
  authors: [{ name: 'AfriConnect', url: siteUrl }],
  creator: 'AfriConnect',
  publisher: 'AfriConnect',
  icons: {
    icon: '/logo2.webp?v=20260314a',
    shortcut: '/logo2.webp?v=20260314a',
    apple: '/logo2.webp?v=20260314a',
  },
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['am_ET', 'sw_KE'],
    url: siteUrl,
    siteName: 'AfriConnect',
    title: 'AfriConnect - Africa\'s Premier B2B Marketplace',
    description: 'Connect with verified suppliers across Africa. Source products, handle cross-border logistics, customs, and secure payments. Your Bridge to African Markets.',
    images: [
      {
        url: `${siteUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'AfriConnect - Your Bridge to African Markets',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AfriConnect - Africa\'s Premier B2B Marketplace',
    description: 'Connect with verified suppliers across Africa. Your Bridge to African Markets.',
    images: [`${siteUrl}/og-image.png`],
    creator: '@africonnect',
    site: '@africonnect',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    yandex: process.env.YANDEX_VERIFICATION,
  },
  applicationName: 'AfriConnect',
  referrer: 'origin-when-cross-origin',
  category: 'business',
  other: {
    'msapplication-TileColor': '#1B2559',
    'apple-mobile-web-app-title': 'AfriConnect',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
    'format-detection': 'telephone=no',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1B2559' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: 'light dark',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const locale = await getLocale()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
