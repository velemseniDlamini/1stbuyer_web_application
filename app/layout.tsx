import { Suspense } from 'react'
import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Fraunces, Manrope } from 'next/font/google'
import { AppStoreProvider } from '@/lib/store'
import { VisitTracker } from '@/components/visit-tracker'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: '1st Buyer: Your Fair Advantage in Car Buying',
  description:
    'A mobile-first car-buying companion that gives South African first-time buyers the same information advantage the dealership already has.',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f1e8' },
    { media: '(prefers-color-scheme: dark)', color: '#151310' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      // The pre-paint script below stamps the saved theme onto this element,
      // so its class legitimately differs from the server-rendered one.
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} bg-background`}
    >
      <head>
        {/* Apply the saved theme before first paint so a light-theme user
            never sees a dark flash on load. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var s=JSON.parse(localStorage.getItem('1stbuyer.state.v1')||'{}');var t=s.theme==='dark'?'dark':'light';document.documentElement.classList.add(t)}catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <AppStoreProvider>
          {/* Renders nothing. Sits at the root so a page view is recorded on
              every route, including the public landing page, without each
              screen having to remember to do it. */}
          <Suspense fallback={null}>
            <VisitTracker />
          </Suspense>
          {children}
        </AppStoreProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
