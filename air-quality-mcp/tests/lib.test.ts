import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateHourlyToDaily, aqiLabel, dailyAirQuality, dailyPollenMax, dailyUvPeaks, drivingPollutant, uvRiskLevel } from "../src/lib.js";

test("aqiLabel follows the European AQI bands and says Unknown for missing values", () => {
  assert.equal(aqiLabel(null), "Unknown");
  assert.equal(aqiLabel(20), "Good");
  assert.equal(aqiLabel(21), "Fair");
  assert.equal(aqiLabel(60), "Moderate");
  assert.equal(aqiLabel(80), "Poor");
  assert.equal(aqiLabel(100), "Very Poor");
  assert.equal(aqiLabel(101), "Extremely Poor");
});

test("uvRiskLevel follows the WHO bands", () => {
  assert.equal(uvRiskLevel(2), "Low");
  assert.equal(uvRiskLevel(3), "Moderate");
  assert.equal(uvRiskLevel(7), "High");
  assert.equal(uvRiskLevel(10), "Very High");
  assert.equal(uvRiskLevel(11), "Extreme");
});

const hourly = {
  time: ["2026-10-18T10:00", "2026-10-18T11:00", "2026-10-19T10:00"],
  pm2_5: [5.123, 7.5, null],
  pm10: [10, 12, 30],
  nitrogen_dioxide: [8, 9, 20],
  ozone: [50, 60, 70],
  european_aqi: [18, 25, 45],
  uv_index: [1.2, 3.46, 0.5],
  uv_index_clear_sky: [2, 4, 1],
  grass_pollen: [3, 9.456, 0],
  birch_pollen: [null, null, null],
};

test("aggregateHourlyToDaily gives min, max and avg per field per day, null where no data", () => {
  const days = aggregateHourlyToDaily(hourly, ["pm2_5", "pm10"]);
  assert.equal(days.length, 2);
  assert.deepEqual(days[0].pm2_5, { min: 5.12, max: 7.5, avg: 6.31 });
  assert.equal(days[1].pm2_5, null);
  assert.deepEqual(days[1].pm10, { min: 30, max: 30, avg: 30 });
});

test("dailyAirQuality rates each day by its peak AQI", () => {
  const days = dailyAirQuality(hourly);
  assert.equal(days[0].aqi_rating_peak, "Fair");
  assert.equal(days[1].aqi_rating_peak, "Moderate");
});

test("dailyPollenMax keeps the daily peak and leaves out pollen with no data", () => {
  const days = dailyPollenMax(hourly);
  assert.equal(days[0].grass_pollen_max, 9.46);
  assert.equal(days[0].birch_pollen_max, undefined);
  assert.equal(days[1].grass_pollen_max, 0);
});

test("dailyUvPeaks reports the peak to one decimal with its risk level", () => {
  const days = dailyUvPeaks(hourly);
  assert.deepEqual(days[0], { date: "2026-10-18", peak_uv_index: 3.5, peak_uv_index_clear_sky: 4, risk_level: "Moderate" });
  assert.equal(days[1].risk_level, "Low");
});

test("drivingPollutant names the highest sub-index and ignores nulls", () => {
  const driving = drivingPollutant({
    pm2_5: { value: 5, aqi: 18 },
    pm10: { value: 12, aqi: null },
    nitrogen_dioxide: { value: 9, aqi: 30 },
    ozone: { value: 60, aqi: 25 },
  });
  assert.equal(driving, "nitrogen_dioxide");
  assert.equal(drivingPollutant({ a: { value: 1, aqi: null } }), "unknown");
});
