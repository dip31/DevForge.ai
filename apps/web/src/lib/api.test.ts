import { describe, it, expect, vi, beforeEach } from "vitest";

const authState = vi.hoisted(() => ({ header: null as string | null }));

vi.mock("./auth", () => ({
  getAuthHeader: vi.fn(async () => authState.header),
}));

import { api, ApiErrorResponse, isApiError, getErrorMessage, getErrorCode } from "./api";

type FakeResponseInit = {
  status?: number;
  contentType?: string;
  json?: unknown;
  text?: string;
};

function fakeResponse(init: FakeResponseInit) {
  const status = init.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get: (key: string) =>
        key.toLowerCase() === "content-type" ? (init.contentType ?? "application/json") : null,
    },
    json: async () => init.json,
    text: async () => init.text ?? "",
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  authState.header = null;
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ApiClient request plumbing", () => {
  it("attaches the Authorization header when a session token exists", async () => {
    authState.header = "Bearer test-token";
    fetchMock.mockResolvedValue(fakeResponse({ json: { success: true, data: { ok: 1 } } }));

    await api.get("/api/v1/organizations");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("omits the Authorization header when there is no session", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ json: { success: true, data: [] } }));

    await api.get("/api/v1/organizations");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toBeUndefined();
  });

  it("adds Content-Type only when a request body is present", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ json: { success: true, data: {} } }));

    await api.get("/api/v1/organizations");
    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();

    await api.post("/api/v1/organizations", { name: "Acme" });
    expect(fetchMock.mock.calls[1][1].headers["Content-Type"]).toBe("application/json");
    expect(fetchMock.mock.calls[1][1].body).toBe(JSON.stringify({ name: "Acme" }));
  });

  it("serializes query params and drops undefined values", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ json: { success: true, data: {} } }));

    await api.get("/api/v1/assessments", {
      params: { page: 2, limit: 10, status: undefined, organizationId: "org-1" },
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("limit=10");
    expect(url).toContain("organizationId=org-1");
    expect(url).not.toContain("status=");
  });

  it("returns undefined for a 204 No Content response", async () => {
    fetchMock.mockResolvedValue(fakeResponse({ status: 204, json: undefined }));

    const result = await api.delete("/api/v1/assessments/a-1");

    expect(result).toBeUndefined();
  });

  it("returns the success envelope unchanged", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ json: { success: true, data: { id: "a-1", title: "Widget" } } }),
    );

    const result = await api.get<{ success: true; data: { id: string } }>("/api/v1/assessments/a-1");

    expect(result.data.id).toBe("a-1");
  });
});

describe("ApiClient error handling", () => {
  it("unwraps the standard { success:false, error:{ code, message } } envelope", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        status: 403,
        json: {
          success: false,
          error: { code: "FORBIDDEN", message: "Access denied", details: { org: "x" } },
        },
      }),
    );

    await expect(api.get("/api/v1/assessments/a-1")).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
      message: "Access denied",
      details: { org: "x" },
    });
  });

  it("surfaces the server message through getErrorMessage", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({
        status: 409,
        json: { success: false, error: { code: "SLUG_EXISTS", message: "Slug already taken" } },
      }),
    );

    try {
      await api.post("/api/v1/organizations", { name: "Acme", slug: "acme" });
      expect.fail("should have thrown");
    } catch (err) {
      expect(isApiError(err)).toBe(true);
      expect(getErrorMessage(err)).toBe("Slug already taken");
      expect(getErrorCode(err)).toBe("SLUG_EXISTS");
    }
  });

  it("also accepts a flat { code, message } error body", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ status: 400, json: { code: "BAD_REQUEST", message: "Nope" } }),
    );

    await expect(api.get("/api/v1/x")).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Nope",
    });
  });

  it("falls back to HTTP_ERROR for a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(
      fakeResponse({ status: 502, contentType: "text/html", text: "Bad Gateway" }),
    );

    await expect(api.get("/api/v1/x")).rejects.toBeInstanceOf(ApiErrorResponse);
    await expect(api.get("/api/v1/x")).rejects.toMatchObject({
      code: "HTTP_ERROR",
      message: "HTTP 502",
    });
  });
});
