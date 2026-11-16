import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pino'],
}

// Stable translation keys keep builds read-only and preserve translated values.
const withNextIntl = createNextIntlPlugin({ requestConfig: './i18n/request.ts' })
export default withNextIntl(nextConfig)
