/**
 * Turning a retail product title into something OMDb will actually match.
 *
 * ## Why this exists
 *
 * `upcitemdb` answers a barcode with the title printed on the *packaging*, and
 * packaging describes a disc, not a film: `Stargate (DVD)`,
 * `The Bionic Woman: Season One (DVD)`, `Jaws (4K Ultra HD + Blu-ray + Digital)`.
 * OMDb's `?t=` is an EXACT title match, so every one of those answers
 * `Response: "False", Error: "Movie not found!"`.
 *
 * That failure was silent and total. The chain is upcitemdb → omdb, the pipeline
 * merges whatever each adapter returns, and OMDb returning nothing left `{ title }`
 * from upcitemdb alone — which is truthy, so the pipeline called it a hit and wrote
 * a title-only row into the shared catalogue. Every scanned film resolved to its
 * own box art description and nothing else: no year, no director, no poster.
 *
 * ## The approach
 *
 * Candidates, in order, rather than one cleaned guess. Cleaning is destructive and
 * some real titles genuinely contain the words we strip — `Special Edition` is
 * noise on a box and part of the name of nothing much, but parentheses are load
 * bearing in `Léon (The Professional)` and a colon is load bearing in
 * `Mission: Impossible`. So the UNTOUCHED title is always tried first and each
 * candidate strips a little more, which means a title that already matched keeps
 * matching exactly as it did before and the aggressive rewrites are only ever
 * reached by a title that has already failed.
 *
 * The list is capped: each candidate is a network round trip, and a barcode whose
 * product title resembles no film should cost a bounded number of them.
 */

/** How many distinct titles we are willing to ask OMDb about for one barcode. */
export const MAX_TITLE_CANDIDATES = 4;

/**
 * Words that describe the physical product. Matched only inside a bracket group
 * that is ENTIRELY noise, or at the very end of a title after a separator —
 * never mid-title, where they are far more likely to be part of a real name.
 */
const NOISE_PHRASES = [
  // Formats.
  "blu-?\\s?ray(?:\\s?disc)?",
  "dvds?",
  "hd\\s?dvd",
  "4k(?:\\s?ultra\\s?hd)?",
  "ultra\\s?hd",
  "uhd",
  "vhs",
  "laser\\s?disc",
  "digital(?:\\s?(?:copy|code|hd))?",
  "blu-?ray\\s?3d",
  "3d",
  // Packaging.
  "combo(?:\\s?pack)?",
  "\\d+\\s*-?\\s*discs?",
  "(?:single|two|three|four)\\s*-?\\s*discs?",
  "discs?",
  "box(?:ed)?\\s?set",
  "gift\\s?set",
  "steel\\s?book",
  "slip\\s?cover",
  "amaray",
  // Editions and cuts.
  "(?:special|collector'?s|ultimate|deluxe|limited|extended|unrated|platinum|criterion|anniversary|widescreen|fullscreen)\\s?edition",
  "\\d+(?:st|nd|rd|th)\\s?anniversary(?:\\s?edition)?",
  "director'?s\\s?cut",
  "theatrical(?:\\s?(?:cut|version|release))?",
  "remastered",
  "re-?mastered",
  "restored",
  "uncut",
  "unrated",
  "widescreen",
  "full\\s?screen",
  "pan\\s?(?:and|&)\\s?scan",
  // Retail and region.
  "region\\s?(?:free|[0-9a-c])",
  "import",
  "sealed",
  "brand\\s?new",
  "ntsc",
  "pal",
];

const NOISE_TOKEN = new RegExp(`^(?:${NOISE_PHRASES.join("|")})$`, "i");

/** A four-digit year, which is a hint rather than noise — captured, then dropped. */
const YEAR = /^(19|20)\d{2}$/;

/** `(…)`, `[…]` or `{…}` and its contents. */
const BRACKET_GROUP = /[([{]([^)\]}]*)[)\]}]/g;

/**
 * The tail of a box set: `: Season One`, `- The Complete Series`, `: Vol. 2`.
 * Stripped only as a LAST candidate, because `Kill Bill: Vol. 1` is a real film
 * whose real title is the whole thing — it just happens to also be the shape a
 * television box set takes, and only a failed lookup can tell the two apart.
 */
const BOXSET_TAIL =
  /\s*[:\-–—]\s*(?:the\s+)?(?:complete\s+)?(?:\w+\s+)?(?:seasons?|series|volumes?|vol\.?|collection|parts?|discs?)\b.*$/i;

/** Collapse whitespace and strip the punctuation left behind by a removal. */
function tidy(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/\s*[:\-–—,;/]+\s*$/, "")
    .replace(/^\s*[:\-–—,;/]+\s*/, "")
    .trim();
}

/** Every token in the group is either noise or a year — so the group says nothing. */
function groupIsAllNoise(inner: string): boolean {
  const tokens = inner
    .split(/[,/+&]|\s+(?:and|with|plus)\s+/i)
    .map((t) => t.trim())
    .filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every((t) => NOISE_TOKEN.test(t) || YEAR.test(t));
}

/**
 * The release year, when the packaging states one — `The Thing (1982)`.
 *
 * Worth having because OMDb takes a `y` parameter, and a bare title is ambiguous
 * for exactly the films most likely to be remade. Returns undefined rather than
 * guessing: a wrong year turns a hit into a miss.
 */
export function yearHintFrom(raw: string): string | undefined {
  for (const match of raw.matchAll(BRACKET_GROUP)) {
    // Group 1 is the bracket's contents. An empty pair — `Title ()` — is real
    // packaging, and it makes the group empty rather than absent; the guard is
    // for the case where a future edit to BRACKET_GROUP makes it optional.
    const inner = match[1];
    if (inner === undefined) continue;
    for (const token of inner.split(/[,/+&]/)) {
      const trimmed = token.trim();
      if (YEAR.test(trimmed)) return trimmed;
    }
  }
  return undefined;
}

function stripNoiseBrackets(value: string): string {
  return tidy(value.replace(BRACKET_GROUP, (whole, inner: string) =>
    groupIsAllNoise(inner) ? " " : whole
  ));
}

function stripAllBrackets(value: string): string {
  return tidy(value.replace(BRACKET_GROUP, " "));
}

/** `Jaws - Widescreen`, `Alien, Director's Cut` — noise hung off the end. */
function stripTrailingNoise(value: string): string {
  let current = value;
  for (let pass = 0; pass < NOISE_PHRASES.length; pass++) {
    const next = tidy(
      current.replace(
        new RegExp(`[,\\-–—/]\\s*(?:${NOISE_PHRASES.join("|")})\\s*$`, "i"),
        " "
      )
    );
    if (next === current) return current;
    current = next;
  }
  return current;
}

/**
 * Titles to try against OMDb, most faithful first.
 *
 * Always non-empty when given anything at all, and never contains duplicates or
 * blanks — a caller can loop it without checking.
 */
export function movieTitleCandidates(raw: string): string[] {
  const base = tidy(raw ?? "");
  if (!base) return [];

  const candidates: string[] = [];
  const add = (value: string) => {
    const cleaned = tidy(value);
    if (cleaned && !candidates.includes(cleaned)) candidates.push(cleaned);
  };

  add(base);
  const noBracketNoise = stripNoiseBrackets(base);
  add(noBracketNoise);
  const noTrailingNoise = stripTrailingNoise(noBracketNoise);
  add(noTrailingNoise);
  const noBrackets = stripAllBrackets(noTrailingNoise);
  add(noBrackets);
  add(noBrackets.replace(BOXSET_TAIL, ""));

  return candidates.slice(0, MAX_TITLE_CANDIDATES);
}
