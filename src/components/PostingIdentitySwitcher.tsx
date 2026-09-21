import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { setActivePostingIdentity } from "@/lib/profiles";
import type { GarageCar } from "@/lib/garage";
import { CarLogo } from "@/components/CarLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Picks which identity new posts default to, and which car's make/model the
// My Car / Same Brand feed scopes use when the person has more than one car.
export function PostingIdentitySwitcher({
  userId,
  username,
  activeGarageCarId,
  cars,
}: {
  userId: string;
  username: string;
  activeGarageCarId: string | null;
  cars: GarageCar[];
}) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const activeCar = cars.find((c) => c.id === activeGarageCarId) ?? null;

  async function choose(garageCarId: string | null) {
    if (garageCarId === activeGarageCarId || saving) return;
    setSaving(true);
    try {
      await setActivePostingIdentity(userId, garageCarId);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["profile-by-username", username] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't switch posting identity");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          {activeCar ? (
            <CarLogo make={activeCar.make} className="size-4 shrink-0 rounded-full" />
          ) : (
            <UserRound className="size-4 shrink-0" />
          )}
          Posting as {activeCar ? activeCar.nickname : username}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => choose(null)} className="flex items-center gap-2">
          <UserRound className="size-4 shrink-0" />
          {username}
          {!activeCar && <Check className="ml-auto size-3.5" />}
        </DropdownMenuItem>
        {cars.map((car) => (
          <DropdownMenuItem key={car.id} onClick={() => choose(car.id)} className="flex items-center gap-2">
            <CarLogo make={car.make} className="size-4 shrink-0 rounded-full" />
            {car.nickname}
            {activeGarageCarId === car.id && <Check className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
