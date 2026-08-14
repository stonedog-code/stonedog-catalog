import { googleBooksAdapter } from "../providers/googlebooks";

const realFetch = global.fetch;

describe("googleBooksAdapter", () => {
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("rejects non-ISBN barcodes", async () => {
    const r = await googleBooksAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: {},
    });
    expect(r.found).toBe(false);
    expect((r.rawPayload as { error: string }).error).toBe("not-isbn");
  });

  it("maps the first volumeInfo into book metadata", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        items: [
          {
            volumeInfo: {
              title: "Dune",
              authors: ["Frank Herbert"],
              publisher: "Chilton",
              publishedDate: "1965",
              pageCount: 412,
              description: "Sci-fi epic.",
              imageLinks: { thumbnail: "https://books.google.com/img.png" },
            },
          },
        ],
      }),
    });
    const r = await googleBooksAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: { apiKey: "X" },
    });
    expect(r.found).toBe(true);
    const m = r.metadata as Record<string, unknown>;
    expect(m.title).toBe("Dune");
    expect(m.author).toBe("Frank Herbert");
    expect(m.publisher).toBe("Chilton");
    expect(m.year).toBe("1965");
    expect(m.pages).toBe(412);
    expect(r.posterUrl).toBe("https://books.google.com/img.png");
  });

  it("sends the key query parameter when an API key is provided", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ json: async () => ({}) });
    global.fetch = fetchMock;
    await googleBooksAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: { apiKey: "test-key" },
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("key=test-key");
  });

  it("omits key parameter when no apiKey is given", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ json: async () => ({}) });
    global.fetch = fetchMock;
    await googleBooksAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("key=");
  });

  it("returns found:false when items array is empty/missing", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ json: async () => ({ items: [] }) });
    const r = await googleBooksAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect(r.found).toBe(false);
  });

  it("joins multiple authors", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        items: [{ volumeInfo: { title: "X", authors: ["A", "B"] } }],
      }),
    });
    const r = await googleBooksAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect((r.metadata as { author: string }).author).toBe("A, B");
  });

  it("extracts year from a full date string", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        items: [{ volumeInfo: { title: "X", publishedDate: "2020-04-15" } }],
      }),
    });
    const r = await googleBooksAdapter.lookup({
      barcode: "9780000000000",
      config: {},
      secrets: {},
    });
    expect((r.metadata as { year: string }).year).toBe("2020");
  });
});
