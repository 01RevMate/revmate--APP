import { useQuery } from "@tanstack/react-query";
import { carLabel, fetchCars } from "@/lib/cars";

export function CarPicker({
  value,
  onChange,
  id = "car",
}: {
  value: string;
  onChange: (carId: string) => void;
  id?: string;
}) {
  const { data: cars, isLoading } = useQuery({ queryKey: ["cars"], queryFn: () => fetchCars() });

  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      required
    >
      <option value="">{isLoading ? "Loading cars…" : "Select a car"}</option>
      {cars?.map((car) => (
        <option key={car.id} value={car.id}>
          {carLabel(car)}
        </option>
      ))}
    </select>
  );
}
