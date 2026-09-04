import type { LookupContext, LookupProviderAdapter, LookupResult } from "./types";

/**
 * UPCItemDB — first-hop barcode → generic product info.
 * Returns title + chain hints (imdbId/title) used by chained adapters like OMDB or BGG.
 */
export const upcItemDbAdapter: LookupProviderAdapter = {
  key: "upcitemdb",
  async lookup(ctx: LookupContext): Promise<LookupResult> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (ctx.secrets.apiKey) headers["user_key"] = ctx.secrets.apiKey;

    const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(ctx.barcode)}`;
    // Deliberately not initialised: every path that reads `raw` below has
    // passed through the assignment in the `try`, because the `catch` returns.
    // An `= null` here is dead, and eslint's `no-useless-assignment` says so.
    let raw: unknown;
    let foundTitle: string | undefined;
    let imdbHint: string | undefined;
    try {
      const res = await fetch(url, { headers });
      raw = await res.json();
      if (!res.ok) {
        return { found: false, metadata: {}, rawPayload: raw };
      }
      const item = (raw as { items?: Array<Record<string, unknown>> })?.items?.[0];
      if (item) {
        const titleVal = item["title"];
        if (typeof titleVal === "string" && titleVal.length > 0) foundTitle = titleVal;
        // upcitemdb occasionally returns IMDb-formatted strings in 'description'
        const desc = item["description"];
        if (typeof desc === "string") {
          const m = desc.match(/tt\d{6,9}/);
          if (m) imdbHint = m[0];
        }
      }
    } catch (e) {
      return { found: false, metadata: {}, rawPayload: { error: (e as Error).message } };
    }

    return {
      found: !!foundTitle,
      metadata: foundTitle ? { title: foundTitle } : {},
      rawPayload: raw,
      chainHints: {
        ...(foundTitle ? { title: foundTitle } : {}),
        ...(imdbHint ? { imdbId: imdbHint } : {}),
      },
    };
  },
};
