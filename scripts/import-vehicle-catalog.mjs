#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const pathArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const cataloguePath =
  pathArgument ??
  join(here, "..", "data", "vehicle-catalog", "revmate-uk-vehicle-catalog.jsonl.gz");
const approvedMakes = JSON.parse(
  readFileSync(join(here, "..", "data", "approved-vehicle-makes.json"), "utf8"),
);
const normalizeMake = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "");
const approvedByKey = new Map(approvedMakes.map((make) => [normalizeMake(make), make]));
const catalogueAliases = new Map([
  ["ds", "DS AUTOMOBILES"],
  ["greatwall", "GWM"],
  ["mercedes", "Mercedes-Benz"],
]);
const canonicalMake = (value) =>
  approvedByKey.get(normalizeMake(value)) ?? catalogueAliases.get(normalizeMake(value)) ?? null;
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!dryRun && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before importing.");
}

const supabase = dryRun
  ? null
  : createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

async function* catalogueRows() {
  const input = createReadStream(cataloguePath).pipe(createGunzip());
  const lines = createInterface({ input, crlfDelay: Infinity });
  for await (const line of lines) {
    if (line.trim()) yield JSON.parse(line);
  }
}

async function upsertBatches(table, rows, batchSize = 500) {
  if (!supabase) throw new Error("Supabase client is unavailable in dry-run mode.");
  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`${table} import failed at row ${start}: ${error.message}`);
    process.stdout.write(
      `\r${table}: ${Math.min(start + batch.length, rows.length)}/${rows.length}`,
    );
  }
  process.stdout.write("\n");
}

const allMakes = new Map();
const allModels = new Map();
const allDerivatives = new Map();
const allPowertrains = [];

for await (const row of catalogueRows()) {
  allMakes.set(row.make_id, { id: row.make_id, name: row.make, slug: row.make_slug });
  allModels.set(row.model_id, {
    id: row.model_id,
    make_id: row.make_id,
    name: row.model,
    slug: row.model_slug,
    source_generic_model: row.source_generic_model,
  });
  allDerivatives.set(row.derivative_id, {
    id: row.derivative_id,
    model_id: row.model_id,
    name: row.derivative,
    slug: row.derivative_slug,
  });
  allPowertrains.push({
    id: row.catalog_entry_id,
    derivative_id: row.derivative_id,
    fuel_type_code: row.fuel_type_code,
    fuel_type: row.fuel_type,
    engine_sizes_cc: row.engine_sizes_cc,
    engine_size_bands: row.engine_size_bands,
    licensed_count: row.licensed_count,
    sorn_count: row.sorn_count,
    current_vehicle_count: row.current_vehicle_count,
    source_period: row.source_period,
    updated_at: new Date().toISOString(),
  });
}

const manifestPath = join(dirname(cataloguePath), "manifest.json");
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const actual = {
    makes: allMakes.size,
    models: allModels.size,
    derivatives: allDerivatives.size,
    catalog_entries: allPowertrains.length,
  };
  for (const [key, value] of Object.entries(actual)) {
    if (manifest[key] !== value) {
      throw new Error(
        `Catalogue validation failed for ${key}: expected ${manifest[key]}, found ${value}.`,
      );
    }
  }
}

const preferredMakes = new Map();
for (const make of allMakes.values()) {
  const canonical = canonicalMake(make.name);
  if (!canonical) continue;
  const current = preferredMakes.get(canonical);
  const exact = normalizeMake(make.name) === normalizeMake(canonical);
  const currentExact = current && normalizeMake(current.name) === normalizeMake(canonical);
  if (!current || (exact && !currentExact)) preferredMakes.set(canonical, make);
}

const approvedMakeIds = new Set([...preferredMakes.values()].map((make) => make.id));
const makes = new Map(
  [...preferredMakes.entries()].map(([name, make]) => [make.id, { ...make, name }]),
);
const models = new Map([...allModels].filter(([, model]) => approvedMakeIds.has(model.make_id)));
const approvedModelIds = new Set(models.keys());
const derivatives = new Map(
  [...allDerivatives].filter(([, derivative]) => approvedModelIds.has(derivative.model_id)),
);
const approvedDerivativeIds = new Set(derivatives.keys());
const powertrains = allPowertrains.filter((powertrain) =>
  approvedDerivativeIds.has(powertrain.derivative_id),
);

if (!dryRun) {
  await upsertBatches("vehicle_makes", [...makes.values()]);
  await upsertBatches("vehicle_models", [...models.values()]);
  await upsertBatches("vehicle_derivatives", [...derivatives.values()]);
  await upsertBatches("vehicle_powertrains", powertrains);
}

console.log(
  `${dryRun ? "Validated" : "Imported"} ${makes.size} makes, ${models.size} models, ${derivatives.size} derivatives and ${powertrains.length} powertrains.`,
);
