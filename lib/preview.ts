/*
 * Preview mode. A local-only escape hatch so the real surfaces (importer and
 * financier) can be walked without configuring Privy auth or a database. When
 * NEXT_PUBLIC_PREVIEW_MODE=1, the auth stack is skipped and the providers serve
 * empty preview state instead of live data. Actions are no-ops. Never enable in
 * production: nothing is authenticated and no data persists.
 */
export const PREVIEW_MODE = process.env.NEXT_PUBLIC_PREVIEW_MODE === "1";
