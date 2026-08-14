import { getAdapter, listAdapterKeys } from "../providers/registry";
import { manualAdapter } from "../providers/manual";

describe("provider registry", () => {
  it("exposes all six built-in adapters", () => {
    const keys = listAdapterKeys();
    expect(keys).toEqual(
      expect.arrayContaining([
        "upcitemdb",
        "omdb",
        "openlibrary",
        "googlebooks",
        "bgg",
        "manual",
      ])
    );
  });

  it("returns the requested adapter by key", () => {
    expect(getAdapter("manual")).toBe(manualAdapter);
  });

  it("returns null for unknown keys", () => {
    expect(getAdapter("does-not-exist")).toBeNull();
  });
});

describe("manualAdapter", () => {
  it("never hits the network and always returns found:false", async () => {
    const realFetch = global.fetch;
    const spy = jest.fn();
    global.fetch = spy as unknown as typeof fetch;
    try {
      const r = await manualAdapter.lookup({
        barcode: "anything",
        config: {},
        secrets: {},
      });
      expect(r.found).toBe(false);
      expect(r.metadata).toEqual({});
      expect(r.rawPayload).toBeNull();
      expect(spy).not.toHaveBeenCalled();
    } finally {
      global.fetch = realFetch;
    }
  });
});
