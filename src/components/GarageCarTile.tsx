import { Link } from "@tanstack/react-router";
import { Trophy, Tag } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import type { GarageCar } from "@/lib/garage";

export function GarageCarTile({
  username,
  car,
  rank,
  forSale,
}: {
  username: string;
  car: GarageCar;
  rank?: number | null;
  forSale?: boolean;
}) {
  const isPrevious = car.ownership_status === "previous";
  return (
    <Link
      to="/u/$username/cars/$carId"
      params={{ username, carId: car.id }}
      className={`group relative flex flex-col items-center gap-2 overflow-hidden rounded-lg border bg-card pb-4 pt-6 text-center transition-colors hover:bg-accent ${isPrevious ? "border-border opacity-75" : forSale ? "border-blue-500 ring-1 ring-blue-500" : "border-border"}`}
    >
      {forSale && (
        <span className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">
          <Tag className="size-2.5" />
          For sale
        </span>
      )}
      {rank && (
        <span className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-foreground/80 px-1.5 py-0.5 text-[9px] font-semibold text-background">
          <Trophy className="size-2.5 text-yellow-400" />#{rank}
        </span>
      )}
      {/* Garage door: ribbed panel lines above a "handle" strip, like a bay door */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-5 bg-muted/60"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent, transparent 3px, hsl(var(--border)) 3px, hsl(var(--border)) 4px)",
        }}
      />
      {isPrevious && (
        <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-foreground/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-background">
          Sold
        </span>
      )}
      <div className="relative">
        <Avatar
          photoUrl={car.photo_url}
          fallback={car.nickname}
          className={`size-16 ${isPrevious ? "grayscale" : ""}`}
        />
        <CarLogo
          make={car.make}
          className="absolute -bottom-1 -right-1 size-5 rounded-full border border-background bg-background"
        />
      </div>
      <div>
        <p className="text-sm font-medium">{car.nickname}</p>
        <p className="text-xs text-muted-foreground">
          {car.make} {car.model}
        </p>
      </div>
    </Link>
  );
}
