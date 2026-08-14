import type { LookupContext, LookupProviderAdapter, LookupResult } from "./types";

/**
 * Google Books — fallback book metadata source. Requires an API key.
 */
export const googleBooksAdapter: LookupProviderAdapter = {
  key: "googlebooks",
  async lookup(ctx: LookupContext): Promise<LookupResult> {
    const isbn = ctx.barcode.replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) {
      return { found: false, metadata: {}, rawPayload: { error: "not-isbn" } };
    }
    const params = new URLSearchParams({ q: `isbn:${isbn}` });
    if (ctx.secrets.apiKey) params.set("key", ctx.secrets.apiKey);
    const url = `https://www.googleapis.com/books/v1/volumes?${params.toString()}`;
    let raw: unknown;
    try {
      const res = await fetch(url);
      raw = await res.json();
    } catch (e) {
      return { found: false, metadata: {}, rawPayload: { error: (e as Error).message } };
    }
    const volume = (raw as { items?: Array<{ volumeInfo?: Record<string, unknown> }> })?.items?.[0]?.volumeInfo;
    if (!volume) {
      return { found: false, metadata: {}, rawPayload: raw };
    }
    const meta = {
      title: typeof volume.title === "string" ? volume.title : "",
      author: Array.isArray(volume.authors) ? (volume.authors as string[]).join(", ") : null,
      isbn,
      publisher: typeof volume.publisher === "string" ? volume.publisher : null,
      year:
        typeof volume.publishedDate === "string"
          ? (volume.publishedDate.match(/\b\d{4}\b/) ?? [null])[0]
          : null,
      pages: typeof volume.pageCount === "number" ? (volume.pageCount as number) : null,
      synopsis: typeof volume.description === "string" ? volume.description : null,
      coverUrl:
        volume.imageLinks && typeof (volume.imageLinks as Record<string, unknown>).thumbnail === "string"
          ? ((volume.imageLinks as Record<string, unknown>).thumbnail as string)
          : null,
    };
    return {
      found: !!meta.title,
      metadata: meta,
      posterUrl: meta.coverUrl ?? undefined,
      rawPayload: volume,
    };
  },
};
