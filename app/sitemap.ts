import { MetadataRoute } from 'next'
import { locales } from '@/i18n/config'

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://africonnect.africa.com'

export default function sitemap(): MetadataRoute.Sitemap {
  const currentDate = new Date()
  
  // Static pages that exist in all locales
  const staticPages = [
    { path: '', priority: 1.0, changeFrequency: 'daily' as const },
    { path: '/explore', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/marketplace', priority: 0.9, changeFrequency: 'daily' as const },
    { path: '/dashboard', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/business/register', priority: 0.7, changeFrequency: 'monthly' as const },
    { path: '/products', priority: 0.7, changeFrequency: 'weekly' as const },
    { path: '/cart', priority: 0.5, changeFrequency: 'weekly' as const },
    { path: '/orders', priority: 0.5, changeFrequency: 'weekly' as const },
    { path: '/billing', priority: 0.5, changeFrequency: 'monthly' as const },
    { path: '/settings', priority: 0.4, changeFrequency: 'monthly' as const },
    { path: '/privacy', priority: 0.3, changeFrequency: 'yearly' as const },
    { path: '/terms', priority: 0.3, changeFrequency: 'yearly' as const },
  ]

  // Generate sitemap entries for all locales
  const sitemapEntries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const page of staticPages) {
      sitemapEntries.push({
        url: `${siteUrl}/${locale}${page.path}`,
        lastModified: currentDate,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: {
          languages: Object.fromEntries(
            locales.map((l) => [l, `${siteUrl}/${l}${page.path}`])
          ),
        },
      })
    }
  }

  // Add non-localized pages
  sitemapEntries.push({
    url: siteUrl,
    lastModified: currentDate,
    changeFrequency: 'daily',
    priority: 1.0,
  })

  return sitemapEntries
}
