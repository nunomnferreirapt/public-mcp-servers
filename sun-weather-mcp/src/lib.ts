// Pure helpers for sun-weather-mcp: no network, no server, so they can be tested alone.

export function extractTime(isoString: string): string {
  // Open-Meteo returns local times like "2024-01-15T07:30"; keep HH:MM.
  const match = isoString.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : isoString;
}

export function rangeDays(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function windDirectionLabel(deg: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

export const WEATHER_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "precipitation",
  "precipitation_probability",
  "cloud_cover",
  "relative_humidity_2m",
];

export interface HourlyWeather {
  time: string[];
  [key: string]: (number | null)[] | string[];
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

export function summarizeHourlyWeather(hourly: HourlyWeather) {
  const dayMap = new Map<string, Record<string, number[]>>();

  for (let i = 0; i < hourly.time.length; i++) {
    const day = hourly.time[i].substring(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, {});
    const bucket = dayMap.get(day)!;
    for (const f of WEATHER_FIELDS) {
      if (!bucket[f]) bucket[f] = [];
      const val = (hourly[f] as (number | null)[])?.[i];
      if (val !== null && val !== undefined) bucket[f].push(val);
    }
  }

  return Array.from(dayMap.entries()).map(([date, bucket]) => {
    const temps = bucket["temperature_2m"] || [];
    const feelsLike = bucket["apparent_temperature"] || [];
    const wind = bucket["wind_speed_10m"] || [];
    const gusts = bucket["wind_gusts_10m"] || [];
    const windDir = bucket["wind_direction_10m"] || [];
    const precip = bucket["precipitation"] || [];
    const precipProb = bucket["precipitation_probability"] || [];
    const cloud = bucket["cloud_cover"] || [];
    const humidity = bucket["relative_humidity_2m"] || [];

    return {
      date,
      temperature_c: { min: round(Math.min(...temps)), max: round(Math.max(...temps)), avg: round(avg(temps)) },
      feels_like_c: { min: round(Math.min(...feelsLike)), max: round(Math.max(...feelsLike)), avg: round(avg(feelsLike)) },
      wind_kmh: { min: round(Math.min(...wind)), max: round(Math.max(...wind)), avg: round(avg(wind)) },
      wind_gusts_kmh: { max: round(Math.max(...gusts)) },
      wind_direction: { dominant: windDirectionLabel(round(avg(windDir), 0)) },
      precipitation_mm: { total: round(precip.reduce((a, b) => a + b, 0)) },
      precipitation_probability_pct: { max: Math.round(Math.max(...precipProb)) },
      cloud_cover_pct: { avg: Math.round(avg(cloud)) },
      humidity_pct: { min: Math.round(Math.min(...humidity)), max: Math.round(Math.max(...humidity)), avg: Math.round(avg(humidity)) },
    };
  });
}
