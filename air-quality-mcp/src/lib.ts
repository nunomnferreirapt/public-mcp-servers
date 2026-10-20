// Pure helpers for air-quality-mcp: no network, no server, so they can be tested alone.

export function aqiLabel(aqi: number | null | undefined): string {
  if (aqi === null || aqi === undefined) return "Unknown";
  if (aqi <= 20) return "Good";
  if (aqi <= 40) return "Fair";
  if (aqi <= 60) return "Moderate";
  if (aqi <= 80) return "Poor";
  if (aqi <= 100) return "Very Poor";
  return "Extremely Poor";
}

export function uvRiskLevel(uv: number): string {
  if (uv <= 2) return "Low";
  if (uv <= 5) return "Moderate";
  if (uv <= 7) return "High";
  if (uv <= 10) return "Very High";
  return "Extreme";
}

export interface HourlyData {
  time: string[];
  [key: string]: (number | null)[] | string[];
}

export const AQ_FIELDS = ["pm2_5", "pm10", "nitrogen_dioxide", "ozone", "european_aqi"];

export const POLLEN_TYPES = [
  "grass_pollen",
  "birch_pollen",
  "alder_pollen",
  "mugwort_pollen",
  "ragweed_pollen",
  "olive_pollen",
];

export function aggregateHourlyToDaily(hourly: HourlyData, fields: string[]): Record<string, any>[] {
  const dayMap = new Map<string, Record<string, number[]>>();

  for (let i = 0; i < hourly.time.length; i++) {
    const day = (hourly.time[i] as string).substring(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, {});
    const dayData = dayMap.get(day)!;
    for (const field of fields) {
      const val = (hourly[field] as (number | null)[])?.[i];
      if (val !== null && val !== undefined) {
        if (!dayData[field]) dayData[field] = [];
        dayData[field].push(val);
      }
    }
  }

  const results: Record<string, any>[] = [];
  for (const [date, fieldData] of dayMap) {
    const entry: Record<string, any> = { date };
    for (const field of fields) {
      const values = fieldData[field] || [];
      if (values.length > 0) {
        entry[field] = {
          min: Math.round(Math.min(...values) * 100) / 100,
          max: Math.round(Math.max(...values) * 100) / 100,
          avg: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100,
        };
      } else {
        entry[field] = null;
      }
    }
    results.push(entry);
  }
  return results;
}

export function dailyAirQuality(hourly: HourlyData): Record<string, any>[] {
  const days = aggregateHourlyToDaily(hourly, AQ_FIELDS);
  for (const day of days) {
    if (day.european_aqi) day.aqi_rating_peak = aqiLabel(day.european_aqi.max);
  }
  return days;
}

export function dailyPollenMax(hourly: HourlyData): Record<string, any>[] {
  const dayMap = new Map<string, Record<string, number>>();
  for (let i = 0; i < hourly.time.length; i++) {
    const day = (hourly.time[i] as string).substring(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, {});
    const dayData = dayMap.get(day)!;
    for (const pollen of POLLEN_TYPES) {
      const val = (hourly[pollen] as (number | null)[])?.[i];
      if (val !== null && val !== undefined) dayData[pollen] = Math.max(dayData[pollen] ?? 0, val);
    }
  }
  const out: Record<string, any>[] = [];
  for (const [date, values] of dayMap) {
    const filtered: Record<string, any> = { date };
    for (const pollen of POLLEN_TYPES) {
      if (values[pollen] !== undefined) filtered[`${pollen}_max`] = Math.round(values[pollen] * 100) / 100;
    }
    out.push(filtered);
  }
  return out;
}

export function dailyUvPeaks(hourly: HourlyData): Record<string, any>[] {
  const dayMap = new Map<string, { uv: number[]; uv_clear: number[] }>();
  for (let i = 0; i < hourly.time.length; i++) {
    const day = (hourly.time[i] as string).substring(0, 10);
    if (!dayMap.has(day)) dayMap.set(day, { uv: [], uv_clear: [] });
    const d = dayMap.get(day)!;
    const uv = (hourly.uv_index as (number | null)[])?.[i];
    const uvClear = (hourly.uv_index_clear_sky as (number | null)[])?.[i];
    if (uv !== null && uv !== undefined) d.uv.push(uv);
    if (uvClear !== null && uvClear !== undefined) d.uv_clear.push(uvClear);
  }
  const out: Record<string, any>[] = [];
  for (const [date, values] of dayMap) {
    const peakUV = values.uv.length > 0 ? Math.round(Math.max(...values.uv) * 10) / 10 : null;
    const peakUVClear = values.uv_clear.length > 0 ? Math.round(Math.max(...values.uv_clear) * 10) / 10 : null;
    out.push({
      date,
      peak_uv_index: peakUV,
      peak_uv_index_clear_sky: peakUVClear,
      risk_level: peakUV !== null ? uvRiskLevel(peakUV) : "Unknown",
    });
  }
  return out;
}

export type SubIndices = Record<string, { value: number | null; aqi: number | null }>;

export function drivingPollutant(subIndices: SubIndices): string {
  let driving = "unknown";
  let highest = -1;
  for (const [pollutant, d] of Object.entries(subIndices)) {
    if (d.aqi !== null && d.aqi !== undefined && d.aqi > highest) {
      highest = d.aqi;
      driving = pollutant;
    }
  }
  return driving;
}
