import type { LookupContext, LookupProviderAdapter, LookupResult } from "./types";
import { movieTitleCandidates, yearHintFrom } from "./title-hints";

/**
 * OMDB — movie metadata + poster. Best invoked after upcitemdb produces a Title or IMDb ID.
 * Maps OMDB fields → MovieCatalogItem columns directly.
 *
 * ## Why this tries several titles
 *
 * `?t=` is an exact match, and the title it is handed came off a DVD box:
 * `Stargate (DVD)` matches nothing, `Stargate` matches the film. Asking once and
 * accepting the miss is what made every scanned movie resolve to a bare product
 * title with no year, director or poster — see `title-hints.ts` for the shape of
 * the problem and why the candidates are ordered the way they are.
 *
 * An IMDb id, when upstream found one, is unambiguous and is tried first. The
 * title candidates are still tried if it misses, because a hint scraped out of a
 * product description is not a guarantee.
 */
export const omdbAdapter: LookupProviderAdapter = {
  key: "omdb",
  async lookup(ctx: LookupContext): Promise<LookupResult> {
    if (!ctx.secrets.apiKey) {
      return { found: false, metadata: {}, rawPayload: { error: "OMDB API key missing" } };
    }
    const imdbId = ctx.chainHints?.imdbId;
    const title = ctx.chainHints?.title;
    if (!imdbId && !title) {
      return { found: false, metadata: {}, rawPayload: { error: "no chain hint" } };
    }

    // The year is only ever a tiebreak. It is sent with the title attempts, never
    // with the id attempt, where it could only turn a certain hit into a miss.
    const year = title ? yearHintFrom(title) : undefined;
    const attempts: Array<Record<string, string>> = [];
    if (imdbId) attempts.push({ i: imdbId });
    for (const candidate of title ? movieTitleCandidates(title) : []) {
      attempts.push(year ? { t: candidate, y: year } : { t: candidate });
    }

    // Kept so a failure can be read afterwards. The LAST response is the useful
    // one: earlier candidates are expected to miss, and reporting the first miss
    // would describe a guess we had already discarded.
    let lastRaw: unknown = { error: "no attempt was made" };

    for (const attempt of attempts) {
      const params = new URLSearchParams({ apikey: ctx.secrets.apiKey, ...attempt });
      const url = `https://www.omdbapi.com/?${params.toString()}`;
      let raw: unknown;
      try {
        const res = await fetch(url);
        raw = await res.json();
      } catch (e) {
        // One candidate failing to fetch is not the whole lookup failing — the
        // next one may well answer.
        lastRaw = { error: (e as Error).message };
        continue;
      }
      lastRaw = raw;

      const data = raw as Record<string, unknown>;
      if (data?.["Response"] !== "True") continue;

      const meta = {
        title: str(data["Title"]) ?? attempt["t"] ?? title ?? "",
        year: str(data["Year"]),
        director: str(data["Director"]),
        genre: str(data["Genre"]),
        runtime: str(data["Runtime"]),
        imdbId: str(data["imdbID"]) ?? imdbId ?? null,
        plot: str(data["Plot"]),
        rating: str(data["imdbRating"]),
        posterUrl: str(data["Poster"]),
      };
      if (!meta.title) continue;
      return {
        found: true,
        metadata: meta,
        posterUrl: meta.posterUrl ?? undefined,
        rawPayload: raw,
      };
    }

    return { found: false, metadata: {}, rawPayload: lastRaw };
  },
};

function str(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed || trimmed === "N/A") return null;
  return trimmed;
}
