import { useQuery } from "@tanstack/react-query";
import { CarLogo } from "@/components/CarLogo";
import { MakeSelect } from "@/components/MakeSelect";
import { ModelSelect } from "@/components/ModelSelect";
import {
  EMPTY_VEHICLE_CATALOG_SELECTION,
  fetchVehicleDerivatives,
  fetchVehicleMakes,
  fetchVehicleModels,
  fetchVehiclePowertrains,
  powertrainLabel,
  type VehicleCatalogSelection,
} from "@/lib/vehicleCatalog";

type Props = {
  value: VehicleCatalogSelection;
  onChange: (value: VehicleCatalogSelection) => void;
};

const selectClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

export function VehicleCatalogPicker({ value, onChange }: Props) {
  const makes = useQuery({ queryKey: ["vehicle-catalog", "makes"], queryFn: fetchVehicleMakes });
  const models = useQuery({
    queryKey: ["vehicle-catalog", "models", value.makeId],
    queryFn: () => fetchVehicleModels(value.makeId),
    enabled: !!value.makeId,
  });
  const derivatives = useQuery({
    queryKey: ["vehicle-catalog", "derivatives", value.modelId],
    queryFn: () => fetchVehicleDerivatives(value.modelId),
    enabled: !!value.modelId,
  });
  const powertrains = useQuery({
    queryKey: ["vehicle-catalog", "powertrains", value.derivativeId],
    queryFn: () => fetchVehiclePowertrains(value.derivativeId),
    enabled: !!value.derivativeId,
  });

  const catalogueUnavailable =
    makes.isError ||
    models.isError ||
    derivatives.isError ||
    powertrains.isError ||
    (!makes.isLoading && makes.data?.length === 0);

  if (catalogueUnavailable) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          The official catalogue has not been imported yet. You can still add the car manually.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make">
            <div className="flex items-center gap-2">
              <CarLogo make={value.make} className="size-8" />
              <MakeSelect
                value={value.make}
                onChange={(make) => onChange({ ...EMPTY_VEHICLE_CATALOG_SELECTION, make })}
                required
              />
            </div>
          </Field>
          <Field label="Model">
            <ModelSelect
              make={value.make}
              value={value.model}
              onChange={(model) => onChange({ ...value, model })}
              required
            />
          </Field>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Make">
          <div className="flex items-center gap-2">
            <CarLogo make={value.make} className="size-8" />
            <select
              value={value.makeId}
              onChange={(event) => {
                const make = makes.data?.find((item) => item.id === event.target.value);
                onChange({
                  ...EMPTY_VEHICLE_CATALOG_SELECTION,
                  makeId: make?.id ?? "",
                  make: make?.name ?? "",
                });
              }}
              required
              disabled={makes.isLoading}
              className={selectClass}
            >
              <option value="">{makes.isLoading ? "Loading makes…" : "Select a make"}</option>
              {makes.data?.map((make) => (
                <option key={make.id} value={make.id}>
                  {make.name}
                </option>
              ))}
            </select>
          </div>
        </Field>
        <Field label="Model">
          <select
            value={value.modelId}
            onChange={(event) => {
              const model = models.data?.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                modelId: model?.id ?? "",
                model: model?.name ?? "",
                derivativeId: "",
                derivative: "",
                powertrainId: "",
                fuelTypeCode: "",
                fuelType: "",
              });
            }}
            required
            disabled={!value.makeId || models.isLoading}
            className={selectClass}
          >
            <option value="">{models.isLoading ? "Loading models…" : "Select a model"}</option>
            {models.data?.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Detailed model / trim">
          <select
            value={value.derivativeId}
            onChange={(event) => {
              const derivative = derivatives.data?.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                derivativeId: derivative?.id ?? "",
                derivative: derivative?.name ?? "",
                powertrainId: "",
                fuelTypeCode: "",
                fuelType: "",
              });
            }}
            required
            disabled={!value.modelId || derivatives.isLoading}
            className={selectClass}
          >
            <option value="">
              {derivatives.isLoading ? "Loading detailed models…" : "Select a detailed model"}
            </option>
            {derivatives.data?.map((derivative) => (
              <option key={derivative.id} value={derivative.id}>
                {derivative.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fuel type">
          <select
            value={value.powertrainId}
            onChange={(event) => {
              const powertrain = powertrains.data?.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                powertrainId: powertrain?.id ?? "",
                fuelTypeCode: powertrain?.fuel_type_code ?? "",
                fuelType: powertrain?.fuel_type ?? "",
              });
            }}
            required
            disabled={!value.derivativeId || powertrains.isLoading}
            className={selectClass}
          >
            <option value="">
              {powertrains.isLoading ? "Loading fuel types…" : "Select fuel type"}
            </option>
            {powertrains.data?.map((powertrain) => (
              <option key={powertrain.id} value={powertrain.id}>
                {powertrainLabel(powertrain)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Official UK DfT/DVLA vehicle catalogue, 2026 Q1. Detailed model names may include trim
        wording.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
