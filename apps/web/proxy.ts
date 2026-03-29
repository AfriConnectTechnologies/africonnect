import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/navigation'
import { NextRequest } from 'next/server'

const intlMiddleware = createMiddleware(routing)

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/:locale',
  '/:locale/explore',
  '/:locale/pricing',
  '/:locale/terms',
  '/:locale/privacy',
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
  '/:locale/1',
  '/:locale/2',
  '/:locale/3',
  '/:locale/4',
  '/:locale/5',
  '/api(.*)',
])

export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl
  
  // Skip i18n middleware for API routes - they don't need locale handling
  if (pathname.startsWith('/api')) {
    // Still check auth for protected API routes if needed
    if (!isPublicRoute(request)) {
      await auth.protect()
    }
    return // Let the request continue to API route without i18n processing
  }
  
  // Handle internationalization for non-API routes
  const response = intlMiddleware(request)
  
  // Protect non-public routes
  if (!isPublicRoute(request)) {
    await auth.protect()
  }
  
  return response
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
