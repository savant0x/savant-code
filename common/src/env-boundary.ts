export function allowsDevelopmentDefaults(
  environment: string | undefined,
  variables: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  const normalized = environment?.trim().toLowerCase()
  const isLocalMode = normalized === 'dev' || normalized === 'test'
  const isTrue = (value: string | undefined): boolean =>
    value?.trim().toLowerCase() === 'true' || value?.trim() === '1'
  const isProtectedContext =
    isTrue(variables.SAVANT_CODE_GITHUB_ACTIONS) ||
    isTrue(variables.CI) ||
    isTrue(variables.SAVANT_CODE_RELEASE) ||
    isTrue(variables.SAVANT_CODE_RELEASE_AUTOMATION) ||
    variables.NODE_ENV?.trim().toLowerCase() === 'production'
  return isLocalMode && !isProtectedContext
}
