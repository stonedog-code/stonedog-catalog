import type { LookupContext, LookupProviderAdapter, LookupResult } from "./types";

/**
 * OpenLibrary — Books lookup by ISBN. No API key required.
 * Endpoint: https://openlibrary.org/api/books?bibkeys=ISBN:<isbn>&format=json&jscmd=data
 */
export const openLibraryAdapter: LookupProviderAdapter = {
  key: "openlibrary",
  async lookup(ctx: LookupContext): Promise<LookupResult> {
    const isbn = ctx.barcode.replace(/[^0-9Xx]/g, "");
    if (isbn.length !== 10 && isbn.length !== 13) {
      return { found: false, metadata: {}, rawPayload: { error: "not-isbn" } };
    }
    const key = `ISBN:${isbn}`;
    const url = `https://openlibrary.org/api/books?bibkeys=${encodeURIComponent(key)}&format=json&jscmd=data`;
    let raw: unknown;
    try {
      const res = await fetch(url);
      raw = await res.json();
    } catch (e) {
      return { found: false, metadata: {}, rawPayload: { error: (e as Error).message } };
    }
    const entry = (raw as Record<string, Record<string, unknown> | undefined>)?.[key];
    if (!entry) {
      return { found: false, metadata: {}, rawPayload: raw };
    }
    const authorList = entry["authors"];
    const publishers = entry["publishers"];
    const cover = entry["cover"];
    const meta = {
      title: typeof entry["title"] === "string" ? (entry["title"] as string) : "",
      author:
        Array.isArray(authorList) && authorList.length > 0
          ? (authorList as Array<{ name?: string }>).map((a) => a?.name ?? "").filter(Boolean).join(", ")
          : null,
      isbn,
      publisher:
        Array.isArray(publishers) && publishers.length > 0
          ? (publishers as Array<{ name?: string }>)[0]?.name ?? null
          : null,
      year:
        typeof entry["publish_date"] === "string"
          ? extractYear(entry["publish_date"] as string)
          : null,
      pages: typeof entry["number_of_pages"] === "number" ? (entry["number_of_pages"] as number) : null,
      synopsis: typeof entry["subtitle"] === "string" ? (entry["subtitle"] as string) : null,
      coverUrl:
        cover && typeof (cover as Record<string, unknown>)["medium"] === "string"
          ? ((cover as Record<string, unknown>)["medium"] as string)
          : null,
    };
    return {
      found: !!meta.title,
      metadata: meta,
      posterUrl: meta.coverUrl ?? undefined,
      rawPayload: entry,
    };
  },
};

function extractYear(s: string): string | null {
  const m = s.match(/\b(\d{4})\b/);
  // `m[1]` is `string | undefined` under noUncheckedIndexedAccess: a match
  // object is not a promise that group 1 participated. It always does for this
  // pattern, but writing that as an assertion is how the next pattern edit
  // becomes a runtime undefined instead of a compile error.
  return m?.[1] ?? null;
}
