# @stonedogcode/catalog

Metadata lookup adapters for barcodes — movies, books, board games — behind one
small interface, with a chain-hint mechanism that lets one adapter feed the next.

Zero runtime dependencies. HTTP is the platform's `fetch`.

```bash
npm install @stonedogcode/catalog
```

## The problem it solves

A barcode on a DVD case does not identify a film. It identifies a *product*, and
the databases that know about products are not the databases that know about
films. So a single lookup gets you `THE MATRIX (DVD) [WIDESCREEN]` and nothing
else — no year, no director, no poster.

Getting the rest means a **chain**: resolve the barcode to a product, pull a
title (or better, an IMDb id) out of that, and ask a film database. Each step
knows something the next one needs. That handoff is what `chainHints` is.

```ts
import { getAdapter } from "@stonedogcode/catalog";

const upc = getAdapter("upcitemdb")!;
const first = await upc.lookup({
  barcode: "085391163926",
  config: {},
  secrets: {},
});

const omdb = getAdapter("omdb")!;
const second = await omdb.lookup({
  barcode: "085391163926",
  config: {},
  secrets: { apiKey: process.env.OMDB_API_KEY },
  chainHints: first.chainHints,   // { title, imdbId? } discovered upstream
});

second.metadata; // { title, year, director, ... }
second.posterUrl;
```

Ordering the chain, caching its results and deciding what to persist are the
caller's job. This package does one thing: given a barcode and whatever the last
adapter learned, ask one source and return what it said.

## Adapters

| Key | Source | Needs a key | Notes |
|---|---|---|---|
| `upcitemdb` | UPCitemdb | optional | Barcode → product. Usually the head of a chain; emits `title` and sometimes `imdbId` as hints. |
| `omdb` | OMDB | **yes** | Films. Wants a `title` or `imdbId` hint; returns nothing without one. |
| `openlibrary` | OpenLibrary | no | Books by ISBN. |
| `googlebooks` | Google Books | optional | Books; broader than OpenLibrary on recent titles. |
| `bgg` | BoardGameGeek | no | Board games. Two calls — search, then fetch the thing. |
| `manual` | — | no | Terminal. Always `found: false`, so a chain *ends* deliberately rather than running out. |

`listAdapterKeys()` enumerates them; `getAdapter(key)` returns one or `null`.

## The interface

```ts
interface LookupProviderAdapter {
  readonly key: string;
  lookup(ctx: LookupContext): Promise<LookupResult>;
}

interface LookupContext {
  barcode: string;
  config: Record<string, unknown>;
  secrets: { apiKey?: string };
  chainHints?: Record<string, string>;
}

interface LookupResult {
  found: boolean;
  metadata: Record<string, unknown>;
  posterUrl?: string;
  rawPayload: unknown;          // the untouched response, for storing
  chainHints?: Record<string, string>;
}
```

Write your own by implementing that interface — nothing in the package requires
registration to use one.

### `rawPayload` is not decoration

Adapters map a third-party response onto `metadata` and necessarily throw
information away. Keeping the raw response means a mapping bug is repairable
later from data you already have, rather than by re-querying every barcode
you have ever seen against an API that may have changed its answer.

## Title candidates

`movieTitleCandidates` and `yearHintFrom` are exported because a caller building
its own chain needs the same normalisation the OMDB adapter uses. OMDB's `?t=` is
an exact match, and the title came off a DVD box: `Stargate (DVD)` matches
nothing, `Stargate` matches the film.

Asking once and accepting the miss is not a hypothetical failure — it is what
made every scanned film in the system this was extracted from resolve to a bare
product title with no year, director or poster.

## Provenance

These adapters were extracted from HopperGuard's private collections package,
where they had no dependency on anything around them. What stayed behind is the
part that did: the cache-first pipeline, which is bound to a particular Prisma
schema and a particular tenancy model.

That split is the reason this package can have zero dependencies. It is not an
aspiration — it is what the code already was.

## Licence

Apache-2.0.
