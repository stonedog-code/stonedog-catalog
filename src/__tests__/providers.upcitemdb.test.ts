import { upcItemDbAdapter } from "../providers/upcitemdb";

const realFetch = global.fetch;

describe("upcItemDbAdapter", () => {
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("returns found:true with the title when the API resolves the UPC", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ title: "The Princess Bride (DVD)" }],
      }),
    });
    const result = await upcItemDbAdapter.lookup({
      barcode: "012257009842",
      config: {},
      secrets: {},
    });
    expect(result.found).toBe(true);
    expect(result.metadata).toEqual({ title: "The Princess Bride (DVD)" });
    expect(result.chainHints?.title).toBe("The Princess Bride (DVD)");
  });

  it("extracts an IMDb ID from the description and surfaces it as a chain hint", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        items: [{ title: "Dune", description: "Special edition (imdb tt0903747 ref)" }],
      }),
    });
    const result = await upcItemDbAdapter.lookup({
      barcode: "012345678905",
      config: {},
      secrets: {},
    });
    expect(result.chainHints?.imdbId).toBe("tt0903747");
  });

  it("sends user_key when an API key is provided", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ title: "X" }] }),
    });
    global.fetch = fetchMock;
    await upcItemDbAdapter.lookup({
      barcode: "012345",
      config: {},
      secrets: { apiKey: "secret-key" },
    });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.user_key).toBe("secret-key");
  });

  it("omits user_key when no API key is provided", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [{ title: "X" }] }),
    });
    global.fetch = fetchMock;
    await upcItemDbAdapter.lookup({ barcode: "x", config: {}, secrets: {} });
    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers.user_key).toBeUndefined();
  });

  it("returns found:false when the API returns no items", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    const result = await upcItemDbAdapter.lookup({ barcode: "z", config: {}, secrets: {} });
    expect(result.found).toBe(false);
    expect(result.metadata).toEqual({});
  });

  it("returns found:false when the API responds with a non-OK status", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "rate limited" }),
    });
    const result = await upcItemDbAdapter.lookup({ barcode: "z", config: {}, secrets: {} });
    expect(result.found).toBe(false);
    expect(result.rawPayload).toEqual({ error: "rate limited" });
  });

  it("swallows fetch errors and reports them on rawPayload", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("network down"));
    const result = await upcItemDbAdapter.lookup({ barcode: "z", config: {}, secrets: {} });
    expect(result.found).toBe(false);
    expect((result.rawPayload as { error?: string }).error).toBe("network down");
  });

  it("URL-encodes the barcode parameter", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ items: [] }),
    });
    global.fetch = fetchMock;
    await upcItemDbAdapter.lookup({
      barcode: "weird&value",
      config: {},
      secrets: {},
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("upc=weird%26value");
  });
});
