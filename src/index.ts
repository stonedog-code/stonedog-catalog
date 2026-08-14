export * from "./providers/types";
export { getAdapter, listAdapterKeys } from "./providers/registry";
export { upcItemDbAdapter } from "./providers/upcitemdb";
export { omdbAdapter } from "./providers/omdb";
export { openLibraryAdapter } from "./providers/openlibrary";
export { googleBooksAdapter } from "./providers/googlebooks";
export { bggAdapter } from "./providers/bgg";
export { manualAdapter } from "./providers/manual";

// Exported because a caller building its own chain needs the same title
// normalisation the OMDB adapter uses. A UPC lookup returns a product title
// ("THE MATRIX (DVD) [WIDESCREEN]"), not a film title, and handing that
// straight to a film database finds nothing — the candidate list is what makes
// the chain work at all.
export { movieTitleCandidates, yearHintFrom } from "./providers/title-hints";
