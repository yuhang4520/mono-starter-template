export function getAgreementConfig(env: Record<string, string | undefined> = process.env) {
  const configured = (value: string | undefined) => {
    const trimmed = value?.trim()
    return trimmed && !trimmed.startsWith('__') ? trimmed : undefined
  }
  const appName = configured(env.LEGAL_APP_NAME)
  const operatorName = configured(env.LEGAL_OPERATOR_NAME)
  const rawEmail = configured(env.LEGAL_CONTACT_EMAIL)
  const contactEmail =
    rawEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) ? rawEmail : undefined
  return {
    version: configured(env.LEGAL_VERSION) ?? '1',
    appName: appName ?? '示例应用（待配置）',
    operatorName: operatorName ?? '运营方待配置',
    contactEmail,
    isConfigured: Boolean(appName && operatorName && contactEmail),
  }
}
