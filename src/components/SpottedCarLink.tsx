import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye } from "lucide-react";
import { CarLogo } from "@/components/CarLogo";
import { fetchSpottedCar } from "@/lib/social";
import { displayUsernameWithoutAt } from "@/lib/usernames";

/** "Spotted: @owner's BMW M3" — links a spotted photo to the owner's garage car. */
export function SpottedCarLink({ garageCarId }: { garageCarId: string }) {
  const { data: car } = useQuery({
    queryKey: ["spotted-car", garageCarId],
    queryFn: () => fetchSpottedCar(garageCarId),
    staleTime: 5 * 60_000,
  });
  if (!car?.profiles) return null;
  return (
    <Link
      to="/u/$username/cars/$carId"
      params={{ username: car.profiles.username, carId: car.id }}
      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 hover:underline dark:text-amber-400"
    >
      <Eye className="size-3.5" />
      Spotted: {displayUsernameWithoutAt(car.profiles.username)}'s
      <CarLogo make={car.make} className="size-3.5" />
      {car.nickname}
    </Link>
  );
}
