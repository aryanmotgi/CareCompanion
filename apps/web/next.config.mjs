import { withSentryConfig } from '@sentry/nextjs'
import withPWA from '@ducanh2912/next-pwa'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const appVersion = (() => {
  try { return readFileSync(resolve(__dirname, '../../VERSION'), 'utf8').trim() } catch { return '0.0.0' }
})()

const isDev = process.env.NODE_ENV === 'development'

/** @type {import('next').NextConfig} */

const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  async headers() {
    const scriptSrc = isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live`
      : `script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://vercel.live`
    const connectSrc = isDev
      ? `connect-src 'self' ws://localhost:3000 http://localhost:3000 https://*.anthropic.com https://*.vercel-analytics.com https://*.vercel-insights.com https://vercel.live https://accounts.google.com`
      : `connect-src 'self' https://*.anthropic.com https://*.vercel-analytics.com https://*.vercel-insights.com https://vercel.live https://accounts.google.com`
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Content-Security-Policy', value: `default-src 'self'; ${scriptSrc}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com; ${connectSrc}; frame-src https://vercel.live https://accounts.google.com; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self' https://accounts.google.com; worker-src 'self'` },
        ],
      },
    ];
  },
};

const pwaConfig = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)

export default withSentryConfig(pwaConfig, {
  silent: true,
  hideSourceMaps: true,
})
