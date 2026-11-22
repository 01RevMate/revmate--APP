#!/usr/bin/env node
// Imports the fault library (data/fault-library/*.json, one file per car) into `cars` and `car_faults`.
//
//   bun run faults:validate     checks every file and prints a summary; touches nothing
//   bun run faults:import       validates, then writes to the database (needs the migration 0084 first)
//
// Importing needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server-only: never a VITE_ variable).
// The import is repeatable: a car's editorial faults are matched by title, so re-running updates them
// in place. It never touches owner-reported or AI-sourced faults.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { carSlug, validateFaultFile } from "./lib/fault-library.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const libraryDir = join(here, "..", "data", "fault-library");
const approvedMakes = JSON.parse(readFileSync(join(here, "..", "data", "approved-vehicle-makes.json"), "utf8"));

const files = existsSync(libraryDir)
  ? readdirSync(libraryDir).filter((name) => name.endsWith(".json") && !name.startsWith("_")).sort()
  : [];

let failed = 0;
const entries = [];
for (const name of files) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(libraryDir, name), "utf8"));
  } catch (error) {
    failed++;
    console.error(`✗ ${name}: not valid JSON (${error.message})`);
    continue;
  }
  const { errors } = validateFaultFile(parsed, { approvedMakes });
  if (errors.length) {
    failed++;
    console.error(`✗ ${name}`);
    for (const message of errors) console.error(`    - ${message}`);
  } else {
    entries.push({ name, ...parsed });
  }
}

const faultCount = entries.reduce((n, e) => n + e.faults.length, 0);
const costed = entries.reduce((n, e) => n + e.faults.filter((f) => f.typical_cost_low != null).length, 0);
console.log(
  `${failed ? "FAILED" : "OK"}: ${files.length} file(s), ${entries.length} valid, ${failed} with problems; ` +
    `${faultCount} faults (${costed} with a sourced cost).`,
);
if (failed) process.exit(1);
if (dryRun) process.exit(0);
if (entries.length === 0) {
  console.log("Nothing to import.");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.");
}
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// The migration must have run: editorial faults need the new source value and columns.
const probe = await supabase.from("car_faults").select("cost_source_url, last_checked").limit(1);
if (probe.error) {
  throw new Error(`Run migration 0084 (fault library schema) first. (${probe.error.message})`);
}

for (const entry of entries) {
  const { make, model, generation } = entry.car;
  // Reuse the car if it exists. New cars start unverified, with no invented details.
  let { data: car, error } = await supabase
    .from("cars")
    .select("id")
    .eq("make", make)
    .eq("model", model)
    .eq("generation", generation)
    .maybeSingle();
  if (error) throw new Error(`${entry.name}: looking up the car failed: ${error.message}`);
  if (!car) {
    const created = await supabase
      .from("cars")
      .insert({ make, model, generation, status: "unverified", engine_options: [] })
      .select("id")
      .single();
    if (created.error) throw new Error(`${entry.name}: creating the car failed: ${created.error.message}`);
    car = created.data;
    console.log(`+ car ${make} ${model} (${generation}) → /cars/${carSlug(make)}/${carSlug(model)}/${carSlug(generation)}`);
  }

  const { data: existing, error: existingError } = await supabase
    .from("car_faults")
    .select("id, title")
    .eq("car_id", car.id)
    .eq("source", "editorial");
  if (existingError) throw new Error(`${entry.name}: reading faults failed: ${existingError.message}`);
  const byTitle = new Map(existing.map((row) => [row.title.toLowerCase(), row.id]));
  const keep = new Set();

  for (const fault of entry.faults) {
    const row = {
      car_id: car.id,
      title: fault.title.trim(),
      description: fault.description.trim(),
      source: "editorial",
      source_url: fault.source_url,
      typical_cost_low: fault.typical_cost_low ?? null,
      typical_cost_high: fault.typical_cost_high ?? null,
      cost_source_url: fault.cost_source_url ?? null,
      last_checked: fault.last_checked,
    };
    const id = byTitle.get(row.title.toLowerCase());
    keep.add(row.title.toLowerCase());
    const result = id
      ? await supabase.from("car_faults").update(row).eq("id", id)
      : await supabase.from("car_faults").insert(row);
    if (result.error) throw new Error(`${entry.name}: saving "${row.title}" failed: ${result.error.message}`);
  }
  // Editorial faults dropped from the file are removed, so the file stays the source of truth.
  const stale = existing.filter((row) => !keep.has(row.title.toLowerCase())).map((row) => row.id);
  if (stale.length) {
    const removed = await supabase.from("car_faults").delete().in("id", stale);
    if (removed.error) throw new Error(`${entry.name}: removing old faults failed: ${removed.error.message}`);
  }
  console.log(`✓ ${make} ${model}: ${entry.faults.length} fault(s)${stale.length ? `, ${stale.length} removed` : ""}`);
}
console.log("Done.");
