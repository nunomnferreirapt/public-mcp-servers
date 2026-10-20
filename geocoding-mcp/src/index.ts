import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { CITY_FIELDS, POSTAL_FIELDS, pick, searchParams } from "./lib.js";

const BASE_URL = "https://geocoding-api.open-meteo.com/v1";

const server = new McpServer({ name: "geocoding-mcp", version: "1.0.0" });

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const fail = (err: any) => ({ content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true });

server.tool(
  "geocode_city",
  "Search for a city by name and get coordinates, country, and timezone. Returns up to 5 matches.",
  {
    city: z.string().describe("City name to search for"),
    country_code: z.string().optional().describe("ISO 3166-1 alpha-2 country code to filter results (e.g. DE, US, PT)"),
  },
  async ({ city, country_code }) => {
    try {
      const res = await fetch(`${BASE_URL}/search?${searchParams(city, country_code)}`);
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) return text(`No results found for "${city}".`);
      return text(JSON.stringify(data.results.map((r: any) => pick(r, CITY_FIELDS)), null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "geocode_postal_code",
  "Search for a location by postal code and country code. Returns up to 5 matches with coordinates.",
  {
    postal_code: z.string().describe("Postal/ZIP code to search for"),
    country_code: z.string().describe("ISO 3166-1 alpha-2 country code (e.g. DE, US, PT)"),
  },
  async ({ postal_code, country_code }) => {
    try {
      const res = await fetch(`${BASE_URL}/search?${searchParams(postal_code, country_code)}`);
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        return text(`No results found for postal code "${postal_code}" in ${country_code}.`);
      }
      return text(JSON.stringify(data.results.map((r: any) => pick(r, POSTAL_FIELDS)), null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_location_by_id",
  "Get full location details by Open-Meteo geocoding ID.",
  { id: z.number().describe("Open-Meteo location ID") },
  async ({ id }) => {
    try {
      const res = await fetch(`${BASE_URL}/get?id=${id}`);
      if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
      return text(JSON.stringify(await res.json(), null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch(console.error);
