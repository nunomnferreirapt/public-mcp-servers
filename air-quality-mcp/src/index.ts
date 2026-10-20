import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { AQ_FIELDS, POLLEN_TYPES, SubIndices, aqiLabel, dailyAirQuality, dailyPollenMax, dailyUvPeaks, drivingPollutant } from "./lib.js";

const BASE_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const server = new McpServer({ name: "air-quality-mcp", version: "1.0.0" });

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const fail = (err: any) => ({ content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true });

const lat = z.number().describe("Latitude of the location");
const lon = z.number().describe("Longitude of the location");

async function openMeteo(params: Record<string, string>) {
  const res = await fetch(`${BASE_URL}?${new URLSearchParams(params)}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || data.error);
  return data;
}

const coords = (latitude: number, longitude: number) => ({
  latitude: latitude.toString(),
  longitude: longitude.toString(),
  timezone: "auto",
});

server.tool(
  "get_air_quality_current",
  "Get current air quality readings including PM2.5, PM10, NO2, O3, and European AQI with rating label.",
  { latitude: lat, longitude: lon },
  async ({ latitude, longitude }) => {
    try {
      const data = await openMeteo({ ...coords(latitude, longitude), current: AQ_FIELDS.join(",") });
      const c = data.current;
      const result = {
        time: c.time,
        timezone: data.timezone,
        pm2_5: c.pm2_5,
        pm10: c.pm10,
        nitrogen_dioxide: c.nitrogen_dioxide,
        ozone: c.ozone,
        european_aqi: c.european_aqi,
        aqi_rating: aqiLabel(c.european_aqi),
      };
      return text(JSON.stringify(result, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_air_quality_forecast",
  "Get air quality forecast aggregated to daily min/max/avg summaries for 1-7 days ahead.",
  { latitude: lat, longitude: lon, days: z.number().min(1).max(7).describe("Number of forecast days (1-7)") },
  async ({ latitude, longitude, days }) => {
    try {
      const data = await openMeteo({ ...coords(latitude, longitude), hourly: AQ_FIELDS.join(","), forecast_days: days.toString() });
      return text(JSON.stringify({ timezone: data.timezone, daily_summaries: dailyAirQuality(data.hourly) }, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_air_quality_historical",
  "Get historical air quality data aggregated to daily summaries for a date range.",
  {
    latitude: lat,
    longitude: lon,
    start_date: z.string().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().describe("End date in YYYY-MM-DD format"),
  },
  async ({ latitude, longitude, start_date, end_date }) => {
    try {
      const data = await openMeteo({ ...coords(latitude, longitude), hourly: AQ_FIELDS.join(","), start_date, end_date });
      return text(JSON.stringify({ timezone: data.timezone, daily_summaries: dailyAirQuality(data.hourly) }, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_pollen_forecast",
  "Get pollen forecast (grass, birch, alder, mugwort, ragweed, olive) aggregated to daily max values for 1-5 days.",
  { latitude: lat, longitude: lon, days: z.number().min(1).max(5).describe("Number of forecast days (1-5)") },
  async ({ latitude, longitude, days }) => {
    try {
      const data = await openMeteo({
        ...coords(latitude, longitude),
        hourly: POLLEN_TYPES.join(","),
        domains: "cams_europe",
        forecast_days: days.toString(),
      });
      return text(JSON.stringify({ timezone: data.timezone, daily_pollen: dailyPollenMax(data.hourly) }, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_uv_index",
  "Get UV index forecast with daily peak values and risk levels (Low/Moderate/High/Very High/Extreme) for 1-7 days.",
  { latitude: lat, longitude: lon, days: z.number().min(1).max(7).describe("Number of forecast days (1-7)") },
  async ({ latitude, longitude, days }) => {
    try {
      const data = await openMeteo({ ...coords(latitude, longitude), hourly: "uv_index,uv_index_clear_sky", forecast_days: days.toString() });
      return text(JSON.stringify({ timezone: data.timezone, daily_uv: dailyUvPeaks(data.hourly) }, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_aqi_breakdown",
  "Get current AQI breakdown showing overall European AQI and per-pollutant sub-indices to identify the driving pollutant.",
  { latitude: lat, longitude: lon },
  async ({ latitude, longitude }) => {
    try {
      const data = await openMeteo({
        ...coords(latitude, longitude),
        current: "pm2_5,pm10,nitrogen_dioxide,ozone,european_aqi,european_aqi_pm2_5,european_aqi_pm10,european_aqi_nitrogen_dioxide,european_aqi_ozone",
      });
      const c = data.current;
      const subIndices: SubIndices = {
        pm2_5: { value: c.pm2_5, aqi: c.european_aqi_pm2_5 },
        pm10: { value: c.pm10, aqi: c.european_aqi_pm10 },
        nitrogen_dioxide: { value: c.nitrogen_dioxide, aqi: c.european_aqi_nitrogen_dioxide },
        ozone: { value: c.ozone, aqi: c.european_aqi_ozone },
      };
      const result = {
        time: c.time,
        timezone: data.timezone,
        european_aqi: c.european_aqi,
        aqi_rating: aqiLabel(c.european_aqi),
        driving_pollutant: drivingPollutant(subIndices),
        sub_indices: Object.fromEntries(
          Object.entries(subIndices).map(([key, val]) => [key, { ...val, rating: aqiLabel(val.aqi) }])
        ),
      };
      return text(JSON.stringify(result, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

async function main() {
  await server.connect(new StdioServerTransport());
}

main().catch(console.error);
