import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { WEATHER_FIELDS, extractTime, rangeDays, summarizeHourlyWeather } from "./lib.js";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

const server = new McpServer({ name: "sun-weather-mcp", version: "1.0.0" });

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const fail = (err: any) => ({ content: [{ type: "text" as const, text: `Error: ${err.message}` }], isError: true });
const errorText = (s: string) => ({ content: [{ type: "text" as const, text: s }], isError: true });

async function openMeteo(params: URLSearchParams) {
  const res = await fetch(`${BASE_URL}?${params}`);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (data.error) throw new Error(data.reason || data.error);
  return data;
}

server.tool(
  "get_sunrise_sunset",
  "Get sunrise and sunset times for a specific location and date. Returns times in local timezone.",
  {
    latitude: z.number().describe("Latitude of the location"),
    longitude: z.number().describe("Longitude of the location"),
    date: z.string().describe("Date in YYYY-MM-DD format"),
  },
  async ({ latitude, longitude, date }) => {
    try {
      const data = await openMeteo(new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        daily: "sunrise,sunset",
        timezone: "auto",
        start_date: date,
        end_date: date,
      }));
      const result = {
        date,
        sunrise: extractTime(data.daily.sunrise[0]),
        sunset: extractTime(data.daily.sunset[0]),
        timezone: data.timezone,
      };
      return text(JSON.stringify(result, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_sunrise_sunset_range",
  "Get sunrise and sunset times for a date range (max 16 days). Returns daily times in local timezone.",
  {
    latitude: z.number().describe("Latitude of the location"),
    longitude: z.number().describe("Longitude of the location"),
    start_date: z.string().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().describe("End date in YYYY-MM-DD format"),
  },
  async ({ latitude, longitude, start_date, end_date }) => {
    try {
      const diffDays = rangeDays(start_date, end_date);
      if (diffDays > 16) return errorText("Error: Maximum range is 16 days.");
      if (diffDays < 1) return errorText("Error: end_date must be on or after start_date.");

      const data = await openMeteo(new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        daily: "sunrise,sunset",
        timezone: "auto",
        start_date,
        end_date,
      }));
      const days = data.daily.time.map((date: string, i: number) => ({
        date,
        sunrise: extractTime(data.daily.sunrise[i]),
        sunset: extractTime(data.daily.sunset[i]),
      }));
      return text(JSON.stringify({ timezone: data.timezone, days }, null, 2));
    } catch (err: any) {
      return fail(err);
    }
  }
);

server.tool(
  "get_weather_forecast",
  "Get weather forecast with hourly detail aggregated to daily summaries for 1-7 days. Includes temperature, feels-like, wind speed/gusts/direction, precipitation, rain probability, cloud cover, and humidity.",
  {
    latitude: z.number().describe("Latitude of the location"),
    longitude: z.number().describe("Longitude of the location"),
    days: z.number().min(1).max(7).describe("Number of forecast days (1-7)"),
  },
  async ({ latitude, longitude, days }) => {
    try {
      const data = await openMeteo(new URLSearchParams({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        hourly: WEATHER_FIELDS.join(","),
        timezone: "auto",
        forecast_days: days.toString(),
      }));
      const units = data.hourly_units || {};
      const result = {
        timezone: data.timezone,
        units: {
          temperature: units.temperature_2m || "°C",
          wind_speed: units.wind_speed_10m || "km/h",
          wind_gusts: units.wind_gusts_10m || "km/h",
          precipitation: units.precipitation || "mm",
        },
        daily_summaries: summarizeHourlyWeather(data.hourly),
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
