/**
 * Pure helpers for resolving organization context in the UI.
 *
 * These stay free of React and network concerns so they can be unit tested and
 * shared between the onboarding screen and the sidebar switcher.
 */

import type { OrganizationWithRole } from "@contracts/auth";

/** Normalise a display name into a workspace slug (lowercase, hyphenated). */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/**
 * Determine which organization to pre-select on load.
 *
 * When there is exactly one organization it is unambiguous and selected. With
 * zero or several organizations we return null so the user must choose — we
 * deliberately never silently fall back to the first entry.
 */
export function resolveInitialOrganizationId(organizations: Array<{ id: string }>): string | null {
  return organizations.length === 1 ? organizations[0].id : null;
}
