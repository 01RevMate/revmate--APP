import { Link } from "@tanstack/react-router";
import { Avatar } from "@/components/Avatar";
import type { GarageCar } from "@/lib/garage";

export function GarageCarTile({ username, car }: { username: string; car: GarageCar }) {
  return (
    <Link
      to="/u/$username/cars/$carId"
      params={{ username, carId: car.id }}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center hover:bg-accent"
    >
      <Avatar photoUrl={car.photo_url} fallback={car.nickname} className="size-16" />
      <div>
        <p className="text-sm font-medium">{car.nickname}</p>
        <p className="text-xs text-muted-foreground">
          {car.make} {car.model}
        </p>
      </div>
    </Link>
  );
}
