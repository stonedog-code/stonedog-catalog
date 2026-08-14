import { EMPTY_RESULT } from "../providers/types";

describe("EMPTY_RESULT sentinel", () => {
  it("is a found:false default with empty metadata and null payload", () => {
    expect(EMPTY_RESULT.found).toBe(false);
    expect(EMPTY_RESULT.metadata).toEqual({});
    expect(EMPTY_RESULT.rawPayload).toBeNull();
  });

  it("can be safely spread when an adapter wants to return a not-found result", () => {
    const result = { ...EMPTY_RESULT, rawPayload: { error: "rate limited" } };
    expect(result.found).toBe(false);
    expect(result.metadata).toEqual({});
    expect((result.rawPayload as { error: string }).error).toBe("rate limited");
  });
});
