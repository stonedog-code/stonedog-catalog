import { bggAdapter } from "../providers/bgg";

const realFetch = global.fetch;

describe("bggAdapter", () => {
  afterEach(() => {
    global.fetch = realFetch;
    jest.clearAllMocks();
  });

  it("returns found:false when no title chain hint is provided", async () => {
    const r = await bggAdapter.lookup({
      barcode: "012345",
      config: {},
      secrets: {},
    });
    expect(r.found).toBe(false);
    expect((r.rawPayload as { error: string }).error).toBe("no chain hint");
  });

  it("returns found:false when search returns no boardgame item", async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({
      text: async () => "<items><item type='videogame' id='999'/></items>",
    });
    const r = await bggAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: {},
      chainHints: { title: "Catan" },
    });
    expect(r.found).toBe(false);
  });

  it("parses board game metadata from the BGG XML response", async () => {
    const searchXml = `<items><item type="boardgame" id="13"/></items>`;
    const thingXml = `
      <items>
        <item type="boardgame">
          <name type="primary" value="Settlers of Catan"/>
          <minplayers value="3"/>
          <maxplayers value="4"/>
          <playingtime value="90"/>
          <minage value="10"/>
          <description>Build settlements&#10;and cities.</description>
          <image>https://cf.geekdo-images.com/catan.jpg</image>
          <link type="boardgamepublisher" value="KOSMOS"/>
        </item>
      </items>
    `;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ text: async () => searchXml })
      .mockResolvedValueOnce({ text: async () => thingXml });

    const r = await bggAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: {},
      chainHints: { title: "Catan" },
    });
    expect(r.found).toBe(true);
    const m = r.metadata as Record<string, unknown>;
    expect(m.title).toBe("Settlers of Catan");
    expect(m.minPlayers).toBe(3);
    expect(m.maxPlayers).toBe(4);
    expect(m.playMinutes).toBe(90);
    expect(m.ageMin).toBe(10);
    expect(m.publisher).toBe("KOSMOS");
    expect(m.description).toContain("Build settlements");
    expect(r.posterUrl).toBe("https://cf.geekdo-images.com/catan.jpg");
  });

  it("falls back to the search-query title when no primary name is found", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        text: async () => `<items><item type="boardgame" id="42"/></items>`,
      })
      .mockResolvedValueOnce({ text: async () => "<items></items>" });
    const r = await bggAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: {},
      chainHints: { title: "Catan" },
    });
    expect((r.metadata as { title: string }).title).toBe("Catan");
  });

  it("returns found:false when the search fetch throws", async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error("dns"));
    const r = await bggAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: {},
      chainHints: { title: "Catan" },
    });
    expect(r.found).toBe(false);
    expect((r.rawPayload as { error: string }).error).toBe("dns");
  });

  it("returns found:false when the thing fetch throws after a successful search", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        text: async () => `<items><item type="boardgame" id="13"/></items>`,
      })
      .mockRejectedValueOnce(new Error("flaky"));
    const r = await bggAdapter.lookup({
      barcode: "x",
      config: {},
      secrets: {},
      chainHints: { title: "Catan" },
    });
    expect(r.found).toBe(false);
    expect((r.rawPayload as { error: string }).error).toBe("flaky");
  });
});
