import { describe, expect, it } from "vitest";

import { resolveInitialOrganizationId, slugify } from "./organizations";

describe("slugify", () => {
  it("normalises a display name into a lowercase hyphenated slug", () => {
    expect(slugify("Acme Hiring")).toBe("acme-hiring");
    expect(slugify("  Nova Tech Solutions! ")).toBe("nova-tech-solutions");
  });

  it("collapses unsupported characters and trims edge hyphens", () => {
    expect(slugify("!!!  ___   ???")).toBe("");
    expect(slugify("--hello--")).toBe("hello");
  });

  it("caps the slug at 100 characters", () => {
    expect(slugify("a".repeat(150))).toHaveLength(100);
  });
});

describe("resolveInitialOrganizationId", () => {
  it("returns null when the user has no organizations", () => {
    expect(resolveInitialOrganizationId([])).toBeNull();
  });

  it("auto-selects when there is exactly one organization", () => {
    expect(resolveInitialOrganizationId([{ id: "org-1" }])).toBe("org-1");
  });

  it("never silently selects the first organization when several exist", () => {
    expect(
      resolveInitialOrganizationId([{ id: "org-1" }, { id: "org-2" }, { id: "org-3" }]),
    ).toBeNull();
  });
});
