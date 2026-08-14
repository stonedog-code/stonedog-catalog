import type { LookupProviderAdapter } from "./types";
import { upcItemDbAdapter } from "./upcitemdb";
import { omdbAdapter } from "./omdb";
import { openLibraryAdapter } from "./openlibrary";
import { googleBooksAdapter } from "./googlebooks";
import { bggAdapter } from "./bgg";
import { manualAdapter } from "./manual";

const adapters: LookupProviderAdapter[] = [
  upcItemDbAdapter,
  omdbAdapter,
  openLibraryAdapter,
  googleBooksAdapter,
  bggAdapter,
  manualAdapter,
];

const byKey = new Map<string, LookupProviderAdapter>(adapters.map((a) => [a.key, a]));

export function getAdapter(key: string): LookupProviderAdapter | null {
  return byKey.get(key) ?? null;
}

export function listAdapterKeys(): string[] {
  return Array.from(byKey.keys());
}
