import type { LookupContext, LookupProviderAdapter, LookupResult } from "./types";

/**
 * Manual — the terminal adapter; never hits the network.
 *
 * Always returns found: false, so a chain ending here resolves to "nobody knows
 * this barcode" and the caller can offer to have it typed in. It exists so that
 * outcome is a deliberate end to the chain rather than the chain running out.
 */
export const manualAdapter: LookupProviderAdapter = {
  key: "manual",
  async lookup(_ctx: LookupContext): Promise<LookupResult> {
    return {
      found: false,
      metadata: {},
      rawPayload: null,
    };
  },
};
