// Validation for data/fault-library/*.json (one file per car). Used by the importer and the tests.
//
// The rules exist so the fault library stays honest: every fault must say where it came from, and a
// cost is only allowed when a separate source backs the cost. Nothing is estimated.

export const MAX_FAULTS_PER_CAR = 8;
const URL_RE = /^https:\/\/[^\s]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isUrl = (value) => typeof value === "string" && value.length <= 1000 && URL_RE.test(value);
const isMoney = (value) => Number.isInteger(value) && value >= 0 && value <= 100000;
const normalise = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

/**
 * @param {unknown} entry   Parsed JSON of one file.
 * @param {{ approvedMakes: string[], today?: string }} options
 * @returns {{ errors: string[] }}
 */
export function validateFaultFile(entry, { approvedMakes, today = new Date().toISOString().slice(0, 10) }) {
  const errors = [];
  if (!entry || typeof entry !== "object") return { errors: ["The file must contain a JSON object."] };

  const car = entry.car;
  if (!car || typeof car !== "object") {
    errors.push('Missing "car" (make, model, generation).');
  } else {
    for (const key of ["make", "model", "generation"]) {
      if (typeof car[key] !== "string" || !car[key].trim()) errors.push(`car.${key} is required.`);
    }
    if (typeof car.make === "string" && car.make.trim()) {
      const known = new Set(approvedMakes.map(normalise));
      if (!known.has(normalise(car.make))) errors.push(`car.make "${car.make}" is not an approved vehicle make.`);
    }
  }

  const faults = entry.faults;
  if (!Array.isArray(faults) || faults.length === 0) {
    errors.push('"faults" must be a non-empty list.');
    return { errors };
  }
  if (faults.length > MAX_FAULTS_PER_CAR) errors.push(`At most ${MAX_FAULTS_PER_CAR} faults per car.`);

  const seen = new Set();
  faults.forEach((fault, index) => {
    const at = `fault ${index + 1}${fault?.title ? ` ("${fault.title}")` : ""}`;
    if (!fault || typeof fault !== "object") return errors.push(`${at}: must be an object.`);

    if (typeof fault.title !== "string" || fault.title.trim().length < 3 || fault.title.length > 80)
      errors.push(`${at}: title must be 3 to 80 characters.`);
    else {
      const key = normalise(fault.title);
      if (seen.has(key)) errors.push(`${at}: duplicate title.`);
      seen.add(key);
    }
    if (typeof fault.description !== "string" || fault.description.trim().length < 40 || fault.description.length > 700)
      errors.push(`${at}: description must be 40 to 700 characters, in RevMate's own words.`);

    // Every fault needs a source. This is the rule that keeps the library honest.
    if (!isUrl(fault.source_url)) errors.push(`${at}: source_url is required and must be an https link.`);

    const hasLow = fault.typical_cost_low != null;
    const hasHigh = fault.typical_cost_high != null;
    const hasCostSource = fault.cost_source_url != null && fault.cost_source_url !== "";
    if (hasLow || hasHigh) {
      if (!(hasLow && hasHigh)) errors.push(`${at}: give both typical_cost_low and typical_cost_high, or neither.`);
      else if (!isMoney(fault.typical_cost_low) || !isMoney(fault.typical_cost_high))
        errors.push(`${at}: costs must be whole pounds between 0 and 100000.`);
      else if (fault.typical_cost_low > fault.typical_cost_high)
        errors.push(`${at}: typical_cost_low is higher than typical_cost_high.`);
      // A cost without its own source is an estimate, and we don't publish estimates.
      if (!isUrl(fault.cost_source_url)) errors.push(`${at}: a cost needs cost_source_url (an https link to where the cost comes from).`);
    } else if (hasCostSource) {
      errors.push(`${at}: cost_source_url is set but there is no cost. Remove it, or add the cost.`);
    }

    if (fault.last_checked != null) {
      if (typeof fault.last_checked !== "string" || !DATE_RE.test(fault.last_checked) || Number.isNaN(Date.parse(fault.last_checked)))
        errors.push(`${at}: last_checked must be a date like 2026-11-22.`);
      else if (fault.last_checked > today) errors.push(`${at}: last_checked is in the future.`);
    } else {
      errors.push(`${at}: last_checked (the date the source was read) is required.`);
    }
  });
  return { errors };
}

/** The slug the database generates for a car (see the `cars` table's generated slug columns). */
export const carSlug = (value) => String(value).toLowerCase().replace(/ /g, "-");
