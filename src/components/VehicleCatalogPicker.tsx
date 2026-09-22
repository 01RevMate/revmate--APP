import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { CarLogo } from "@/components/CarLogo";
import { NewtonsCradleLoader } from "@/components/NewtonsCradleLoader";
import {
  EMPTY_VEHICLE_CATALOG_SELECTION,
  engineOptionsForPowertrain,
  fetchVehicleDerivatives,
  fetchVehicleMakes,
  fetchVehicleModels,
  fetchVehiclePowertrains,
  type VehicleCatalogSelection,
} from "@/lib/vehicleCatalog";

type Props = {
  value: VehicleCatalogSelection;
  onChange: (value: VehicleCatalogSelection) => void;
};

const selectClass =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-wait disabled:opacity-60";

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
  const selectedPowertrain = powertrains.data?.find((item) => item.id === value.powertrainId);
  const engineOptions = selectedPowertrain ? engineOptionsForPowertrain(selectedPowertrain) : [];
  const needsFuelChoice = powertrains.isSuccess && powertrains.data.length > 1;

  useEffect(() => {
    if (!value.derivativeId || !powertrains.isSuccess || powertrains.data.length !== 1) return;

    const powertrain = powertrains.data[0];
    if (!powertrain) return;
    const options = engineOptionsForPowertrain(powertrain);
    const engine = options.length === 1 ? (options[0]?.value ?? "") : value.engine;
    if (
      value.powertrainId === powertrain.id &&
      value.fuelTypeCode === powertrain.fuel_type_code &&
      value.fuelType === powertrain.fuel_type &&
      value.engine === engine
    )
      return;

    onChange({
      ...value,
      powertrainId: powertrain.id,
      fuelTypeCode: powertrain.fuel_type_code,
      fuelType: powertrain.fuel_type,
      engine,
    });
  }, [onChange, powertrains.data, powertrains.isSuccess, value]);

  const catalogueUnavailable =
    makes.isError ||
    models.isError ||
    derivatives.isError ||
    powertrains.isError ||
    (!makes.isLoading && makes.data?.length === 0);

  if (makes.isLoading) {
    return <LoadingPanel label="Loading the UK vehicle catalogue…" />;
  }

  if (catalogueUnavailable) {
    return (
      <CatalogError
        onRetry={() => {
          void makes.refetch();
          if (value.makeId) void models.refetch();
          if (value.modelId) void derivatives.refetch();
          if (value.derivativeId) void powertrains.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PickerStep number={1} title="Choose the make" complete={!!value.makeId}>
        <div className="flex items-center gap-4">
          <div className="flex size-20 shrink-0 items-center justify-center rounded-2xl border border-border bg-white p-3 shadow-sm">
            {value.make ? (
              <CarLogo make={value.make} className="size-14" />
            ) : (
              <span className="text-center text-xs font-medium text-muted-foreground">
                Brand logo
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
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
              className={selectClass}
            >
              <option value="">Select a make</option>
              {makes.data?.map((make) => (
                <option key={make.id} value={make.id}>
                  {make.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </PickerStep>

      {value.makeId && (
        <PickerStep number={2} title="Choose the model" complete={!!value.modelId}>
          {models.isLoading ? (
            <InlineLoader label={`Loading ${value.make} models…`} />
          ) : (
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
                  engine: "",
                });
              }}
              required
              className={selectClass}
            >
              <option value="">Select a model</option>
              {models.data?.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          )}
        </PickerStep>
      )}

      {value.modelId && (
        <PickerStep number={3} title="Choose the version" complete={!!value.derivativeId}>
          {derivatives.isLoading ? (
            <InlineLoader label="Loading available versions…" />
          ) : (
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
                  engine: "",
                });
              }}
              required
              className={selectClass}
            >
              <option value="">Select a version</option>
              {derivatives.data?.map((derivative) => (
                <option key={derivative.id} value={derivative.id}>
                  {derivativeLabel(derivative.name, value.model)}
                </option>
              ))}
            </select>
          )}
        </PickerStep>
      )}

      {value.derivativeId && (powertrains.isLoading || needsFuelChoice) && (
        <PickerStep number={4} title="Choose fuel type" complete={!!value.powertrainId}>
          {powertrains.isLoading ? (
            <InlineLoader label="Loading available fuel types…" />
          ) : (
            <select
              value={value.powertrainId}
              onChange={(event) => {
                const powertrain = powertrains.data?.find((item) => item.id === event.target.value);
                const options = powertrain ? engineOptionsForPowertrain(powertrain) : [];
                onChange({
                  ...value,
                  powertrainId: powertrain?.id ?? "",
                  fuelTypeCode: powertrain?.fuel_type_code ?? "",
                  fuelType: powertrain?.fuel_type ?? "",
                  engine: options.length === 1 ? (options.at(0)?.value ?? "") : "",
                });
              }}
              required
              className={selectClass}
            >
              <option value="">Select a fuel type</option>
              {powertrains.data?.map((powertrain) => (
                <option key={powertrain.id} value={powertrain.id}>
                  {powertrain.fuel_type}
                </option>
              ))}
            </select>
          )}
        </PickerStep>
      )}

      {value.powertrainId && selectedPowertrain && engineOptions.length > 1 && (
        <PickerStep
          number={needsFuelChoice ? 5 : 4}
          title="Choose the engine"
          complete={!!value.engine}
        >
          <select
            value={value.engine}
            onChange={(event) => onChange({ ...value, engine: event.target.value })}
            required
            className={selectClass}
          >
            <option value="">Select an engine</option>
            {engineOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </PickerStep>
      )}

      {value.engine && (
        <p className="rounded-xl bg-primary/5 px-4 py-3 text-xs text-muted-foreground">
          Vehicle matched using the official UK DfT/DVLA catalogue. Detailed model names may include
          trim wording.
        </p>
      )}
    </div>
  );
}

function derivativeLabel(derivative: string, model: string) {
  const modelPrefix = new RegExp(`^${escapeRegExp(model)}(?:\\s+|$)`, "i");
  return derivative.replace(modelPrefix, "").trim() || derivative;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function PickerStep({
  number,
  title,
  complete,
  children,
}: {
  number: number;
  title: string;
  complete: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-3">
        <span
          className={`flex size-7 items-center justify-center rounded-full text-xs font-bold ${
            complete ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          }`}
        >
          {complete ? <Check className="size-4" /> : number}
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-muted/30 p-8 text-center">
      <NewtonsCradleLoader />
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Getting makes, models, trims and engines ready
        </p>
      </div>
    </div>
  );
}

function InlineLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      <NewtonsCradleLoader size={24} />
      {label}
    </div>
  );
}

function CatalogError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-center">
      <h3 className="font-semibold">The vehicle catalogue could not be loaded</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Check the connection and try loading the catalogue again.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
      >
        Try again
      </button>
    </div>
  );
}
