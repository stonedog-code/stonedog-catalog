import { openLibraryAdapter } from "../providers/openlibrary";

const realFetch = global.fetch;

describe("openLibraryAdapter", () => {
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("rejects barcodes that are not ISBN-10/ISBN-13", async () => {
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy as unknown as typeof fetch;
    const result = await openLibraryAdapter.lookup({
      barcode: "0123", // too short
      config: {},
      secrets: {},
    });
    expect(result.found).toBe(false);
    expect((result.rawPayload as { error?: string }).error).toBe("not-isbn");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts a 10-digit ISBN with trailing 'X'", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        "ISBN:043942089X": {
          title: "Harry Potter and the Goblet of Fire",
          authors: [{ name: "J. K. Rowling" }],
          publishers: [{ name: "Scholastic" }],
          publish_date: "July 8, 2000",
          number_of_pages: 752,
          cover: { medium: "https://covers.openlibrary.org/b/id/123-M.jpg" },
        },
      }),
    });
    global.fetch = fetchMock;
    const result = await openLibraryAdapter.lookup({
      barcode: "043942089X",
      config: {},
      secrets: {},
    });
    expect(result.found).toBe(true);
    const m = result.metadata as Record<string, unknown>;
    expect(m.title).toBe("Harry Potter and the Goblet of Fire");
    expect(m.author).toBe("J. K. Rowling");
    expect(m.publisher).toBe("Scholastic");
    expect(m.year).toBe("2000");
    expect(m.pages).toBe(752);
    expect(result.posterUrl).toContain("openlibrary.org");
  });

  it("joins multiple authors with a comma", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        "ISBN:9780000000000": {
          title: "Test",
          authors: [{ name: "A" }, { name: "B" }, { name: "C" }],
        },
      }),
    });
    const result = await openLibraryAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect((result.metadata as { author: string }).author).toBe("A, B, C");
  });

  it("returns found:false when OpenLibrary has no entry for the ISBN", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ json: async () => ({}) });
    const result = await openLibraryAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect(result.found).toBe(false);
  });

  it("strips dashes and spaces from the ISBN before lookup", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ json: async () => ({}) });
    global.fetch = fetchMock;
    await openLibraryAdapter.lookup({
      barcode: "978-0-393-33477-7",
      config: {},
      secrets: {},
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(decodeURIComponent(url)).toContain("ISBN:9780393334777");
  });

  it("handles a publish_date with only a year string", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        "ISBN:9780000000000": {
          title: "X",
          publish_date: "1965",
        },
      }),
    });
    const result = await openLibraryAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect((result.metadata as { year: string }).year).toBe("1965");
  });

  it("swallows fetch errors", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("dns failed"));
    const result = await openLibraryAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect(result.found).toBe(false);
    expect((result.rawPayload as { error: string }).error).toBe("dns failed");
  });
});
