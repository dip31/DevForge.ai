import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import Fastify, { FastifyInstance } from "fastify";

const state = vi.hoisted(() => ({
  userId: "user-1",
  first: {} as Record<string, any>,
  list: {} as Record<string, any[]>,
  rows: {} as Record<string, any[]>,
  count: {} as Record<string, number>,
  inserted: [] as Array<{ table: string; values: any }>,
  transactionCalls: 0,
}));

vi.mock("../services/database", async () => {
  const queryTables = ["organizations", "organizationMemberships", "assessments"];

  const schema: Record<string, any> = await import("@database/schema");
  const nameByTable = new Map<any, string>();
  for (const [name, value] of Object.entries(schema)) {
    if (value && typeof value === "object") nameByTable.set(value, name);
  }

  const makeChain = (rows: any[]) => {
    const promise = Promise.resolve(rows);
    const chain: any = {
      from: () => chain,
      where: () => chain,
      orderBy: () => chain,
      limit: () => chain,
      offset: () => chain,
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
    return chain;
  };

  const query: Record<string, any> = {};
  for (const table of queryTables) {
    query[table] = {
      findFirst: vi.fn(async () => state.first[table] ?? null),
      findMany: vi.fn(async () => state.list[table] ?? []),
    };
  }

  const asResult = (table: string, value: Record<string, unknown>) => {
    state.inserted.push({ table, values: value });
    const row = { id: `${table}-generated`, ...value };
    const promise = Promise.resolve([row]);
    return {
      returning: vi.fn(async () => [row]),
      then: (resolve: any, reject: any) => promise.then(resolve, reject),
      catch: (reject: any) => promise.catch(reject),
    };
  };

  const database: any = {
    query,
    select: vi.fn((fields: any) => ({
      from: (table: any) => {
        const name = nameByTable.get(table);
        const rows = name ? (state.rows[name] ?? []) : [];
        if (fields && typeof fields === "object" && "count" in fields) {
          return makeChain([{ count: name ? (state.count[name] ?? rows.length) : 0 }]);
        }
        return makeChain(rows);
      },
    })),
    insert: vi.fn((table: any) => ({
      values: vi.fn((values: any) => {
        const name = nameByTable.get(table) ?? "unknown";
        return asResult(name, values);
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({ where: vi.fn(() => asResult("updated", values)) })),
    })),
    delete: vi.fn(() => ({ where: vi.fn(async () => []) })),
    closeDatabase: vi.fn(),
  };
  database.transaction = vi.fn(async (cb: any) => {
    state.transactionCalls += 1;
    return cb(database);
  });

  return { db: database, closeDatabase: vi.fn() };
});

import { organizationRoutes } from "./organizations";
import { assessmentRoutes } from "./assessments";
import { errorHandler } from "../middleware/errorHandler";

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });
  app.setErrorHandler(errorHandler);
  app.addHook("preHandler", async (request) => {
    (request as any).user = { id: state.userId };
  });
  await app.register(organizationRoutes, { prefix: "/api/v1/organizations" });
  await app.register(assessmentRoutes, { prefix: "/api/v1/assessments" });
  await app.ready();
});

afterAll(() => app.close());

beforeEach(() => {
  state.userId = "user-1";
  state.first = {};
  state.list = {};
  state.rows = {};
  state.count = {};
  state.inserted = [];
  state.transactionCalls = 0;
});

describe("organization bootstrap", () => {
  it("creates the organization and owner membership in one transaction", async () => {
    state.first.organizations = null;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: { name: "Acme Hiring", slug: "acme-hiring" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().data.name).toBe("Acme Hiring");
    expect(state.transactionCalls).toBe(1);

    const orgInsert = state.inserted.find((row) => row.table === "organizations");
    const memberInsert = state.inserted.find((row) => row.table === "organizationMemberships");
    expect(orgInsert).toBeTruthy();
    expect(memberInsert).toBeTruthy();
    expect(memberInsert?.values.role).toBe("owner");
    expect(memberInsert?.values.userId).toBe("user-1");
  });

  it("rejects a duplicate slug with 409 and does not open a transaction", async () => {
    state.first.organizations = { id: "existing-org", slug: "acme-hiring" };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/organizations",
      payload: { name: "Acme Hiring", slug: "acme-hiring" },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("SLUG_EXISTS");
    expect(state.transactionCalls).toBe(0);
  });

  it("lists the caller's organizations with their role", async () => {
    state.list.organizationMemberships = [
      { organizationId: "org-1", role: "owner" },
      { organizationId: "org-2", role: "member" },
    ];
    state.list.organizations = [
      { id: "org-1", name: "Acme", slug: "acme" },
      { id: "org-2", name: "Globex", slug: "globex" },
    ];

    const res = await app.inject({ method: "GET", url: "/api/v1/organizations" });

    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data).toHaveLength(2);
    expect(data.find((org: any) => org.id === "org-1").userRole).toBe("owner");
    expect(data.find((org: any) => org.id === "org-2").userRole).toBe("member");
  });
});

describe("assessment organization scoping", () => {
  it("rejects creation without an explicit organizationId", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments",
      payload: { title: "T", description: "D", role: "R", skills: "S", durationMinutes: 30 },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creation for an organization the caller does not administer", async () => {
    state.first.organizationMemberships = null;

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments",
      payload: {
        organizationId: "22222222-2222-2222-2222-222222222222",
        title: "T",
        description: "D",
        role: "R",
        skills: "S",
        durationMinutes: 30,
      },
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("creates an assessment for an organization the caller administers", async () => {
    const orgId = "33333333-3333-3333-3333-333333333333";
    state.first.organizationMemberships = {
      organizationId: orgId,
      userId: "user-1",
      role: "admin",
    };

    const res = await app.inject({
      method: "POST",
      url: "/api/v1/assessments",
      payload: {
        organizationId: orgId,
        title: "Widget build",
        description: "Build a widget",
        role: "Frontend Engineer",
        skills: "React",
        durationMinutes: 45,
      },
    });

    expect(res.statusCode).toBe(201);
    const created = state.inserted.find((row) => row.table === "assessments");
    expect(created?.values.organizationId).toBe(orgId);
  });

  it("rejects listing a scoped organization the caller is not a member of", async () => {
    state.list.organizationMemberships = [{ organizationId: "org-1", role: "owner" }];

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessments?organizationId=org-2",
    });

    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("lists assessments scoped to a member organization", async () => {
    state.list.organizationMemberships = [{ organizationId: "org-1", role: "owner" }];
    state.rows.assessments = [{ id: "a-1", organizationId: "org-1", title: "Widget" }];
    state.count.assessments = 1;

    const res = await app.inject({
      method: "GET",
      url: "/api/v1/assessments?organizationId=org-1",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.items).toHaveLength(1);
    expect(res.json().data.total).toBe(1);
  });
});
