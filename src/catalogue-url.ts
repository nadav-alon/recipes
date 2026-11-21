/** The Catalogue shares this origin; it is where a Household is claimed and joined. */
const DEFAULT_CATALOGUE_URL = '/home-catalogue/'

/**
 * Where the Catalogue lives. It shares this origin when deployed; set `VITE_CATALOGUE_URL` where it
 * does not, as under `vite --mode emulator`.
 */
export function catalogueUrl(): string {
  return import.meta.env.VITE_CATALOGUE_URL || DEFAULT_CATALOGUE_URL
}
