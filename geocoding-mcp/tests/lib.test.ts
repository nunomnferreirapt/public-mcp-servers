import { test } from "node:test";
import assert from "node:assert/strict";
import { CITY_FIELDS, POSTAL_FIELDS, pick, searchParams } from "../src/lib.js";

test("pick keeps only the city fields and drops the rest", () => {
  const raw = { id: 1, name: "Weesp", latitude: 52.3, longitude: 5.04, country: "Netherlands", country_code: "NL",
    timezone: "Europe/Amsterdam", admin1: "North Holland", population: 20000, elevation: 0, feature_code: "PPL" };
  const out = pick(raw, CITY_FIELDS);
  assert.deepEqual(Object.keys(out), CITY_FIELDS);
  assert.equal(out.elevation, undefined);
});

test("postal fields carry postcodes instead of population", () => {
  assert.ok(POSTAL_FIELDS.includes("postcodes"));
  assert.ok(!POSTAL_FIELDS.includes("population"));
});

test("searchParams asks for five English results and adds the country only when given", () => {
  const p = searchParams("Weesp");
  assert.equal(p.get("count"), "5");
  assert.equal(p.get("language"), "en");
  assert.equal(p.get("countryCode"), null);
  assert.equal(searchParams("Weesp", "NL").get("countryCode"), "NL");
});
