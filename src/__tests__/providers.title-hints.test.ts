import {
  MAX_TITLE_CANDIDATES,
  movieTitleCandidates,
  yearHintFrom,
} from "../providers/title-hints";

/**
 * The barcode → film-title gap (NEH-577).
 *
 * These are the titles a DVD case actually carries. The two marked LIVE are the
 * exact strings upcitemdb returned for the two barcodes on the issue, and both
 * were verified against the real OMDb API: the raw form answers "Movie not
 * found!" and the last candidate here answers with the film.
 */
describe("movieTitleCandidates", () => {
  it("tries the untouched title first, always", () => {
    // Cleaning is destructive and some real titles contain the words we strip.
    // A title that matches today must go on matching by the same first request.
    expect(movieTitleCandidates("Stargate (DVD)")[0]).toBe("Stargate (DVD)");
    expect(movieTitleCandidates("Dune")[0]).toBe("Dune");
  });

  it("strips a bracket group that is nothing but format noise", () => {
    // LIVE: barcode 012236125709.
    expect(movieTitleCandidates("Stargate (DVD)")).toContain("Stargate");
    expect(movieTitleCandidates("Jaws [Blu-ray]")).toContain("Jaws");
    expect(movieTitleCandidates("Alien (4K Ultra HD + Blu-ray + Digital)")).toContain("Alien");
    expect(movieTitleCandidates("Heat (Two-Disc Special Edition)")).toContain("Heat");
  });

  it("keeps a bracket group that carries part of the name", () => {
    // The whole reason noise-only groups are singled out: this one is the title.
    const candidates = movieTitleCandidates("Léon (The Professional)");
    expect(candidates[0]).toBe("Léon (The Professional)");
    expect(candidates).not.toContain("Léon (The");
  });

  it("still offers the bare name once the faithful forms have been tried", () => {
    // Last resort, and only reached after the parenthesised form has missed.
    const candidates = movieTitleCandidates("Léon (The Professional)");
    expect(candidates.indexOf("Léon")).toBeGreaterThan(0);
  });

  it("strips edition wording hung off the end after a separator", () => {
    expect(movieTitleCandidates("Blade Runner - The Final Cut, Remastered")).toContain(
      "Blade Runner - The Final Cut"
    );
    expect(movieTitleCandidates("Jaws - Widescreen")).toContain("Jaws");
  });

  it("does not strip noise words from the middle of a title", () => {
    // "The Import" is a name here, not a shipping note.
    expect(movieTitleCandidates("The Import Job")[0]).toBe("The Import Job");
    expect(movieTitleCandidates("The Import Job")).not.toContain("The Job");
  });

  it("drops a box-set tail only as the last candidate", () => {
    // LIVE: barcode 025192064890. OMDb has the series under its bare name.
    const candidates = movieTitleCandidates("The Bionic Woman: Season One (DVD)");
    expect(candidates[0]).toBe("The Bionic Woman: Season One (DVD)");
    expect(candidates).toContain("The Bionic Woman: Season One");
    expect(candidates).toContain("The Bionic Woman");
    expect(candidates.indexOf("The Bionic Woman")).toBe(candidates.length - 1);
  });

  it("keeps a colon title intact until the stripped form is genuinely needed", () => {
    // `Kill Bill: Vol. 1` is a real film whose real title is the whole string.
    // Only a failed lookup can distinguish it from a box set, so the full title
    // is asked about first and the truncation is the fallback, never the lead.
    const candidates = movieTitleCandidates("Kill Bill: Vol. 1");
    expect(candidates[0]).toBe("Kill Bill: Vol. 1");
    expect(candidates).toContain("Kill Bill");
  });

  it("leaves an ordinary subtitle alone", () => {
    // Not box-set wording, so there is nothing here to truncate.
    expect(movieTitleCandidates("Mission: Impossible")).toEqual(["Mission: Impossible"]);
  });

  it("never returns duplicates, blanks or more than the cap", () => {
    const messy = movieTitleCandidates(
      "Halloween (1978) [4K Ultra HD + Blu-ray] - Collector's Edition, Remastered"
    );
    expect(messy.length).toBeLessThanOrEqual(MAX_TITLE_CANDIDATES);
    expect(new Set(messy).size).toBe(messy.length);
    expect(messy.every((c) => c.trim().length > 0)).toBe(true);
  });

  it("returns nothing for a title that is nothing", () => {
    // A caller loops the result without checking, so "" must not become [""].
    expect(movieTitleCandidates("")).toEqual([]);
    expect(movieTitleCandidates("   ")).toEqual([]);
  });

  it("collapses the whitespace a strip leaves behind", () => {
    expect(movieTitleCandidates("Se7en   (DVD)")).toContain("Se7en");
  });
});

describe("yearHintFrom", () => {
  it("reads a bracketed release year", () => {
    expect(yearHintFrom("The Thing (1982)")).toBe("1982");
    expect(yearHintFrom("Dune [2021] (Blu-ray)")).toBe("2021");
  });

  it("finds the year beside format noise in the same group", () => {
    expect(yearHintFrom("Halloween (1978, Widescreen)")).toBe("1978");
  });

  it("returns undefined rather than guessing", () => {
    // A wrong year turns a certain hit into a miss, so silence beats a guess.
    expect(yearHintFrom("Stargate (DVD)")).toBeUndefined();
    expect(yearHintFrom("Se7en")).toBeUndefined();
    expect(yearHintFrom("Ocean's Eleven (Two-Disc)")).toBeUndefined();
  });

  it("ignores a number that is not a plausible year", () => {
    expect(yearHintFrom("Rocky (1234)")).toBeUndefined();
    expect(yearHintFrom("Se7en (7)")).toBeUndefined();
  });
});
