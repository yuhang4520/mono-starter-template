const publicAgreementPaths = new Set(['/app-agreement/privacy', '/app-agreement/user'])

/** Exact matches only: nested routes remain protected. */
export function isPublicAgreementPath(pathname: string) {
  return publicAgreementPaths.has(pathname)
}
