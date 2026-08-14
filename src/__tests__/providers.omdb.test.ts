import { omdbAdapter } from "../providers/omdb";
import { MAX_TITLE_CANDIDATES } from "../providers/title-hints";

const realFetch = global.fetch;

describe("omdbAdapter", () => {
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("returns found:false when no API key is configured", async () => {
    const result = await omdbAdapter.lookup({
      barcode: "anything",
      config: {},
      secrets: {},
      chainHints: { title: "Dune" },
    });
    expect(result.found).toBe(false);
    expect((result.rawPayload as { error?: string }).error).toMatch(/api key/i);
  });

  it("returns found:false when no chain hint is provided", async () => {
    const result = await omdbAdapter.lookup({
      barcode: "012",
      config: {},
      secrets: { apiKey: "X" },
    });
    expect(result.found).toBe(false);
    expect((result.rawPayload as { error?: string }).error).toMatch(/chain hint/i);
  });

  it("prefers imdbId over title when both hints are present", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      json: async () => ({ Response: "True", Title: "Dune", imdbID: "tt0903747" }),
    });
    global.fetch = fetchMock;
    await omdbAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: { apiKey: "K" },
      chainHints: { imdbId: "tt0903747", title: "Dune" },
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("i=tt0903747");
    expect(url).not.toContain("t=Dune");
  });

  it("falls back to title search when only title is provided", async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({
      json: async () => ({ Response: "True", Title: "Dune", imdbID: "tt0903747" }),
    });
    global.fetch = fetchMock;
    await omdbAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: { apiKey: "K" },
      chainHints: { title: "Dune" },
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("t=Dune");
  });

  it("maps OMDB fields and treats 'N/A' as null", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        Response: "True",
        Title: "The Princess Bride",
        Year: "1987",
        Director: "Rob Reiner",
        Genre: "Adventure, Comedy, Family",
        Runtime: "98 min",
        imdbID: "tt0093779",
        Plot: "While home sick in bed, a young boy's grandfather reads him the story…",
        imdbRating: "8.0",
        Poster: "N/A",
      }),
    });
    const result = await omdbAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: { apiKey: "K" },
      chainHints: { imdbId: "tt0093779" },
    });
    expect(result.found).toBe(true);
    const m = result.metadata as Record<string, string | null>;
    expect(m.title).toBe("The Princess Bride");
    expect(m.year).toBe("1987");
    expect(m.director).toBe("Rob Reiner");
    expect(m.imdbId).toBe("tt0093779");
    expect(m.posterUrl).toBeNull(); // 'N/A' → null
    expect(result.posterUrl).toBeUndefined();
  });

  it("returns found:false when OMDB responds with Response:'False'", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({ Response: "False", Error: "Movie not found!" }),
    });
    const result = await omdbAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: { apiKey: "K" },
      chainHints: { title: "asdfasdf" },
    });
    expect(result.found).toBe(false);
  });

  it("swallows fetch errors", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("timeout"));
    const result = await omdbAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: { apiKey: "K" },
      chainHints: { title: "X" },
    });
    expect(result.found).toBe(false);
    expect((result.rawPayload as { error?: string }).error).toBe("timeout");
  });

  it("surfaces posterUrl when not N/A", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      json: async () => ({
        Response: "True",
        Title: "X",
        Poster: "https://m.media-amazon.com/foo.jpg",
      }),
    });
    const result = await omdbAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: { apiKey: "K" },
      chainHints: { title: "X" },
    });
    expect(result.posterUrl).toBe("https://m.media-amazon.com/foo.jpg");
  });

  /**
   * Retail product titles (NEH-577).
   *
   * The hint OMDB gets came off a DVD box, and `?t=` is an exact match — so one
   * question was always going to be the wrong number of questions. Before this,
   * `Stargate (DVD)` missed, the adapter gave up, and the pipeline persisted the
   * box-art title on its own: every scanned film resolved to a name and nothing
   * else. The barcodes and titles below are the live ones from the issue.
   */
  describe("when the title came off the packaging", () => {
    const notFound = { Response: "False", Error: "Movie not found!" };

    it("tries the cleaned title after the raw one misses", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ json: async () => notFound })
        .mockResolvedValueOnce({
          json: async () => ({
            Response: "True",
            Title: "Stargate",
            Year: "1994",
            Director: "Roland Emmerich",
            imdbID: "tt0111282",
          }),
        });
      global.fetch = fetchMock;

      const result = await omdbAdapter.lookup({
        barcode: "012236125709",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { title: "Stargate (DVD)" },
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0] as string).toContain("t=Stargate+%28DVD%29");
      expect(fetchMock.mock.calls[1][0] as string).toMatch(/[?&]t=Stargate$/);
      expect(result.found).toBe(true);
      const m = result.metadata as Record<string, string | null>;
      // The point of the whole exercise: the fields that were missing.
      expect(m.title).toBe("Stargate");
      expect(m.year).toBe("1994");
      expect(m.director).toBe("Roland Emmerich");
    });

    it("resolves a box set by its bare name", async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({ json: async () => notFound })
        .mockResolvedValueOnce({ json: async () => notFound })
        .mockResolvedValueOnce({
          json: async () => ({ Response: "True", Title: "The Bionic Woman", Year: "1976-1978" }),
        });
      global.fetch = fetchMock;

      const result = await omdbAdapter.lookup({
        barcode: "025192064890",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { title: "The Bionic Woman: Season One (DVD)" },
      });

      expect(result.found).toBe(true);
      expect((result.metadata as Record<string, string>).title).toBe("The Bionic Woman");
    });

    it("stops asking the moment something answers", async () => {
      // Each candidate is a network round trip against a rate-limited key.
      const fetchMock = jest.fn().mockResolvedValue({
        json: async () => ({ Response: "True", Title: "Stargate" }),
      });
      global.fetch = fetchMock;

      await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { title: "Stargate (DVD) - Widescreen, Remastered" },
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("gives up after a bounded number of candidates", async () => {
      // A product title resembling no film must cost a fixed amount, not one
      // request per way of rewriting it.
      const fetchMock = jest.fn().mockResolvedValue({ json: async () => notFound });
      global.fetch = fetchMock;

      const result = await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: {
          title: "Zzzz (1978) [4K Ultra HD + Blu-ray] - Collector's Edition, Remastered",
        },
      });

      expect(result.found).toBe(false);
      expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(MAX_TITLE_CANDIDATES);
    });

    it("sends the packaging's year with the title, to break a tie", async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        json: async () => ({ Response: "True", Title: "The Thing", Year: "1982" }),
      });
      global.fetch = fetchMock;

      await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { title: "The Thing (1982)" },
      });

      expect(fetchMock.mock.calls[0][0] as string).toContain("y=1982");
    });

    it("never sends a year with an IMDb id", async () => {
      // The id is already unambiguous; a year can only turn a hit into a miss.
      const fetchMock = jest.fn().mockResolvedValueOnce({
        json: async () => ({ Response: "True", Title: "The Thing", imdbID: "tt0084787" }),
      });
      global.fetch = fetchMock;

      await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { imdbId: "tt0084787", title: "The Thing (1982)" },
      });

      // Anchored: `apikey=K` contains the substring "y=" too.
      expect(fetchMock.mock.calls[0][0] as string).not.toMatch(/[?&]y=/);
    });

    it("falls back to the title when the IMDb hint turns out to be wrong", async () => {
      // That hint is scraped out of a product description, so it is a guess.
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce({
          json: async () => ({ Response: "False", Error: "Incorrect IMDb ID." }),
        })
        .mockResolvedValueOnce({ json: async () => ({ Response: "True", Title: "Stargate" }) });
      global.fetch = fetchMock;

      const result = await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { imdbId: "tt0000000", title: "Stargate" },
      });

      expect(result.found).toBe(true);
      expect(fetchMock.mock.calls[0][0] as string).toContain("i=tt0000000");
      expect(fetchMock.mock.calls[1][0] as string).toContain("t=Stargate");
    });

    it("carries on when one candidate's request throws", async () => {
      const fetchMock = jest
        .fn()
        .mockRejectedValueOnce(new Error("timeout"))
        .mockResolvedValueOnce({ json: async () => ({ Response: "True", Title: "Stargate" }) });
      global.fetch = fetchMock;

      const result = await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { title: "Stargate (DVD)" },
      });

      expect(result.found).toBe(true);
    });

    it("reports the last answer, not the first discarded guess", async () => {
      // A miss on an early candidate is expected and says nothing; the raw
      // payload is for reading afterwards, so it must describe the real end.
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({ json: async () => notFound })
        .mockResolvedValueOnce({
          json: async () => ({ Response: "False", Error: "Series not found!" }),
        });

      const result = await omdbAdapter.lookup({
        barcode: "x",
        config: {},
        secrets: { apiKey: "K" },
        chainHints: { title: "Nothing At All (DVD)" },
      });

      expect(result.found).toBe(false);
      expect((result.rawPayload as { Error?: string }).Error).toBe("Series not found!");
    });
  });
});
