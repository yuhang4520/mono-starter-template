import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['pino'],
}

const withNextIntl = createNextIntlPlugin({
  requestConfig: './i18n/request.ts',
  experimental: {
    srcPath: './',
    extract: {
      sourceLocale: 'en',
    },
    messages: {
      path: './i18n/messages',
      format: 'json',
      locales: 'infer',
    },
  },
})

export default withNextIntl(nextConfig)
