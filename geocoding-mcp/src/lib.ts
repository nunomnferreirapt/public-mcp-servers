// Pure helpers for geocoding-mcp: no network, no server, so they can be tested alone.

export const CITY_FIELDS = ["id", "name", "latitude", "longitude", "country", "country_code", "timezone", "admin1", "population"];
export const POSTAL_FIELDS = ["id", "name", "latitude", "longitude", "country", "country_code", "timezone", "admin1", "postcodes"];

export function pick(r: Record<string, any>, fields: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) out[f] = r[f];
  return out;
}

export function searchParams(name: string, countryCode?: string): URLSearchParams {
  const params = new URLSearchParams({ name, count: "5", language: "en", format: "json" });
  if (countryCode) params.set("countryCode", countryCode);
  return params;
}
