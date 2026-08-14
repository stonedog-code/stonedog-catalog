import type { LookupContext, LookupProviderAdapter, LookupResult } from "./types";

/**
 * BoardGameGeek — board game metadata. BGG's barcode coverage is poor;
 * relies on a title chain hint (from upcitemdb). Returns first match.
 * XML API; parsed via lightweight regex (no XML parser dependency).
 */
export const bggAdapter: LookupProviderAdapter = {
  key: "bgg",
  async lookup(ctx: LookupContext): Promise<LookupResult> {
    const title = ctx.chainHints?.title;
    if (!title) return { found: false, metadata: {}, rawPayload: { error: "no chain hint" } };

    const searchUrl = `https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=${encodeURIComponent(title)}`;
    let searchXml: string;
    try {
      const res = await fetch(searchUrl);
      searchXml = await res.text();
    } catch (e) {
      return { found: false, metadata: {}, rawPayload: { error: (e as Error).message } };
    }
    const idMatch = searchXml.match(/<item type="boardgame" id="(\d+)"/);
    if (!idMatch) {
      return { found: false, metadata: {}, rawPayload: searchXml.slice(0, 4096) };
    }
    const id = idMatch[1];
    const thingUrl = `https://boardgamegeek.com/xmlapi2/thing?id=${id}`;
    let thingXml: string;
    try {
      const res = await fetch(thingUrl);
      thingXml = await res.text();
    } catch (e) {
      return { found: false, metadata: {}, rawPayload: { error: (e as Error).message } };
    }
    // Direct child elements like <minplayers value="3"/>
    const pickElement = (tag: string) =>
      new RegExp(`<${tag}[^>]*value="([^"]+)"`).exec(thingXml)?.[1] ?? null;
    // <link type="boardgamepublisher" value="KOSMOS"/> (BGG models publishers
    // as typed <link> elements, not as their own tag).
    const pickLink = (type: string) =>
      new RegExp(`<link[^>]*type="${type}"[^>]*value="([^"]+)"`).exec(thingXml)?.[1] ?? null;
    const description =
      /<description>([\s\S]*?)<\/description>/.exec(thingXml)?.[1]?.replace(/&#10;/g, "\n").trim() ?? null;
    const image = /<image>([^<]+)<\/image>/.exec(thingXml)?.[1] ?? null;
    const name = /<name [^>]*type="primary"[^>]*value="([^"]+)"/.exec(thingXml)?.[1] ?? title;

    const meta = {
      title: name,
      publisher: pickLink("boardgamepublisher"),
      minPlayers: parseIntSafe(pickElement("minplayers")),
      maxPlayers: parseIntSafe(pickElement("maxplayers")),
      playMinutes: parseIntSafe(pickElement("playingtime")),
      ageMin: parseIntSafe(pickElement("minage")),
      description,
      imageUrl: image,
    };
    return {
      found: true,
      metadata: meta,
      posterUrl: image ?? undefined,
      rawPayload: { bggId: id, thingXmlSnippet: thingXml.slice(0, 4096) },
    };
  },
};

function parseIntSafe(v: string | null): number | null {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
