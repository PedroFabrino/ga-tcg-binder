import { describe, expect, it } from "vitest";
import { createTable, type FetchLike } from "../create-table";

const credentials = {
  code: "ABC123",
  p1Token: "p1-token",
  p2Token: "p2-token",
  viewerToken: "viewer-token",
};

function withResponse(response: Response): {
  fetcher: FetchLike;
  calls: Array<{ input: string; init?: RequestInit }>;
} {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  return {
    calls,
    fetcher: async (input, init) => {
      calls.push({ input, init });
      return response;
    },
  };
}

describe("createTable", () => {
  it("posts to the gateway and validates the credentials", async () => {
    const { calls, fetcher } = withResponse(
      new Response(JSON.stringify(credentials), { status: 201 })
    );

    await expect(
      createTable(fetcher, "https://gateway.example.com/base")
    ).resolves.toEqual(credentials);

    expect(calls).toHaveLength(1);
    expect(calls[0].input).toBe("https://gateway.example.com/api/table");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.headers).toEqual({ Accept: "application/json" });
  });

  it("rejects a non-success response", async () => {
    const { fetcher } = withResponse(
      new Response(JSON.stringify({ error: "no table" }), { status: 503 })
    );

    await expect(createTable(fetcher, "http://localhost:3001")).rejects.toThrow(
      "status 503"
    );
  });

  it("rejects a body that is not valid credentials", async () => {
    const invalid = withResponse(
      new Response(JSON.stringify({ code: "ABC123" }), { status: 201 })
    );
    await expect(
      createTable(invalid.fetcher, "http://localhost:3001")
    ).rejects.toThrow("unexpected response");

    const notJson = withResponse(new Response("not json", { status: 201 }));
    await expect(
      createTable(notJson.fetcher, "http://localhost:3001")
    ).rejects.toThrow();
  });
});
