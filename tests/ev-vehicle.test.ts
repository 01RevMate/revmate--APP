import { describe, expect, it } from "bun:test";
import { vehicleFuel, defaultChargingCar, chargingCarLabel, chargeMessage } from "../src/lib/evVehicle";
describe("Lendawatt vehicle pairing", () => {
  it("recognises a saved Taycan without a fuel category", () => expect(vehicleFuel({ make: "Porsche", model: "Taycan", fuel_type: null })).toBe("electric"));
  it("recognises a manually added EV6", () => expect(vehicleFuel({ make: "Kia", model: "EV6" })).toBe("electric"));
  it("does not guess that a mixed-engine Niro is electric", () => expect(vehicleFuel({ make: "Kia", model: "Niro" })).toBeNull());
  it("respects a member's explicit fuel choice", () => expect(vehicleFuel({ make: "Mazda", model: "MX-30", fuel_type: "hybrid" })).toBe("hybrid"));
  it("defaults to a current EV, not a previous EV or petrol car", () => {
    const car = { make: "Nissan", model: "Leaf", year: 2020, trim: null, spec: null };
    expect(defaultChargingCar([{ ...car, id: "old", ownership_status: "previous" }, { ...car, id: "petrol", model: "Juke", ownership_status: "current" }, { ...car, id: "ev", ownership_status: "current" }])?.id).toBe("ev");
  });
  it("includes the selected friend's car details", () => expect(chargingCarLabel({ make: "Kia", model: "EV6", year: 2023, trim: "GT-Line", spec: null })).toBe("2023 Kia EV6 GT-Line"));
  it("keeps editable text and chosen questions together", () => expect(chargeMessage(" Please help ", ["Do I need my own cable?"])).toBe("Please help\nDo I need my own cable?"));
});