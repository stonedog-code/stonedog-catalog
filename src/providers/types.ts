export interface LookupContext {
  barcode: string;
  config: Record<string, unknown>;
  secrets: { apiKey?: string };
  /** Hints fed in from a previous adapter in a chain. */
  chainHints?: Record<string, string>;
}

export interface LookupResult {
  /** True if this adapter resolved enough metadata to persist. */
  found: boolean;
  /** Shape is whatever the caller stores for this kind of item. */
  metadata: Record<string, unknown>;
  /**
   * `| undefined` is explicit because this package builds with
   * `exactOptionalPropertyTypes`, under which `posterUrl?: string` forbids
   * assigning `undefined` to it — and every adapter does exactly that, from a
   * cover URL the source may not have supplied. Writing the key with an
   * undefined value and omitting the key are different things to that flag;
   * they are the same thing to every consumer of this type.
   */
  posterUrl?: string | undefined;
  /** The opaque raw response we want to store under rawPayloads[providerKey]. */
  rawPayload: unknown;
  /** Hints for the next adapter in a chain — e.g. an imdbId discovered upstream. */
  chainHints?: Record<string, string>;
}

export interface LookupProviderAdapter {
  readonly key: string;
  lookup(ctx: LookupContext): Promise<LookupResult>;
}

export const EMPTY_RESULT: LookupResult = {
  found: false,
  metadata: {},
  rawPayload: null,
};
