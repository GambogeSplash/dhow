/*
 * Input bounds + cleaning. Pure helpers shared by the client forms (enforce
 * limits + show a hint before submit) and the route handlers (clamp/reject so
 * the server never trusts the client). Keep these allocation-free and stateless.
 */

export const NAME_MAX = 80;
export const PLACE_MAX = 60;
export const GOODS_MAX = 200;
export const NOTE_MAX = 280;

/** Trim, collapse internal whitespace runs to a single space, slice to `max`. */
export function cleanText(s: string, max: number): string {
  return s.replace(/\s+/g, " ").trim().slice(0, max);
}

/** A name is valid when it has content after trimming and fits NAME_MAX. */
export function isValidName(s: string): boolean {
  const t = s.trim();
  return t.length > 0 && t.length <= NAME_MAX;
}

export interface BusinessFields {
  name: string;
  city: string;
  country: string;
}

/** Clean a business profile's free-text fields to their bounds. */
export function sanitizeBusiness(b: BusinessFields): BusinessFields {
  return {
    name: cleanText(b.name, NAME_MAX),
    city: cleanText(b.city, PLACE_MAX),
    country: cleanText(b.country, PLACE_MAX),
  };
}

export interface SupplierFields {
  name: string;
  city: string;
  country: string;
}

/** Clean a supplier's free-text fields to their bounds. */
export function sanitizeSupplier(s: SupplierFields): SupplierFields {
  return {
    name: cleanText(s.name, NAME_MAX),
    city: cleanText(s.city, PLACE_MAX),
    country: cleanText(s.country, PLACE_MAX),
  };
}
