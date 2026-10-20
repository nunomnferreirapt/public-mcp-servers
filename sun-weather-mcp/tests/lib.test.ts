import { test } from "node:test";
import assert from "node:assert/strict";
import { extractTime, rangeDays, summarizeHourlyWeather, windDirectionLabel } from "../src/lib.js";

test("extractTime keeps HH:MM from an Open-Meteo local timestamp", () => {
  assert.equal(extractTime("2026-10-18T07:31"), "07:31");
  assert.equal(extractTime("no time here"), "no time here");
});

test("rangeDays counts both ends and goes negative when reversed", () => {
  assert.equal(rangeDays("2026-10-18", "2026-10-18"), 1);
  assert.equal(rangeDays("2026-10-18", "2026-11-02"), 16);
  assert.ok(rangeDays("2026-10-18", "2026-10-17") < 1);
});

test("windDirectionLabel maps degrees to sixteen compass points, wrapping at north", () => {
  assert.equal(windDirectionLabel(0), "N");
  assert.equal(windDirectionLabel(67.5), "ENE");
  assert.equal(windDirectionLabel(180), "S");
  assert.equal(windDirectionLabel(359), "N");
});

test("summarizeHourlyWeather folds hours into one row per day with min, max, avg and totals", () => {
  const hourly = {
    time: ["2026-10-18T10:00", "2026-10-18T11:00", "2026-10-19T10:00"],
    temperature_2m: [8, 12, 6],
    apparent_temperature: [6, 10, 3],
    wind_speed_10m: [10, 14, 30],
    wind_gusts_10m: [20, 28, 45],
    wind_direction_10m: [60, 75, 180],
    precipitation: [0, 0.4, 2.2],
    precipitation_probability: [10, 30, 80],
    cloud_cover: [0, 50, 100],
    relative_humidity_2m: [70, 60, 90],
  };
  const days = summarizeHourlyWeather(hourly);
  assert.equal(days.length, 2);
  const sat = days[0];
  assert.equal(sat.date, "2026-10-18");
  assert.deepEqual(sat.temperature_c, { min: 8, max: 12, avg: 10 });
  assert.equal(sat.wind_gusts_kmh.max, 28);
  assert.equal(sat.wind_direction.dominant, "ENE");
  assert.equal(sat.precipitation_mm.total, 0.4);
  assert.equal(sat.precipitation_probability_pct.max, 30);
  assert.equal(sat.cloud_cover_pct.avg, 25);
  assert.equal(days[1].wind_direction.dominant, "S");
});

test("summarizeHourlyWeather skips null hours instead of counting them as zero", () => {
  const hourly = {
    time: ["2026-10-18T10:00", "2026-10-18T11:00"],
    temperature_2m: [8, null], apparent_temperature: [6, null], wind_speed_10m: [10, null],
    wind_gusts_10m: [20, null], wind_direction_10m: [60, null], precipitation: [1, null],
    precipitation_probability: [10, null], cloud_cover: [40, null], relative_humidity_2m: [70, null],
  };
  const [day] = summarizeHourlyWeather(hourly);
  assert.equal(day.temperature_c.avg, 8);
  assert.equal(day.cloud_cover_pct.avg, 40);
});
