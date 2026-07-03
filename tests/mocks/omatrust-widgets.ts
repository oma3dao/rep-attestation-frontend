/**
 * Default mock for `@oma3/omatrust/widgets` (see vitest.config.ts resolve.alias).
 * Component tests that need spies should use vi.mock to replace `createSigningBridge`.
 */
export type SigningBridgeOptions = {
  iframeId: string
  devOriginOverride?: string
  signTypedData: (
    domain: Record<string, unknown>,
    types: Record<string, unknown>,
    message: Record<string, unknown>
  ) => Promise<string>
}

export async function createSigningBridge(_options: SigningBridgeOptions) {
  return {
    destroy: () => {},
  }
}
