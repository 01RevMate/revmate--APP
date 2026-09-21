import { useState } from "react";
import { toast } from "sonner";
import { Check, ChevronDown, LogOut, UserRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { setActivePostingIdentity } from "@/lib/profiles";
import type { GarageCar } from "@/lib/garage";
import { Avatar } from "@/components/Avatar";
import { CarLogo } from "@/components/CarLogo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Picks which identity new posts default to, and which car's make/model the
// My Car / Same Brand feed scopes use when the person has more than one car.
//
// "button" (Garage section) spells it out: "Posting as <name>". "avatar" (top
// bar, every page) is the Untitled UI avatar-with-badge pattern instead —
// https://untitledui.com/components/avatars — your photo/initials with the
// car's logo overlaid bottom-right when you're posting as one.
export function PostingIdentitySwitcher({
  userId,
  username,
  avatarUrl,
  activeGarageCarId,
  cars,
  variant = "button",
  onSignOut,
}: {
  userId: string;
  username: string;
  avatarUrl?: string | null;
  activeGarageCarId: string | null;
  cars: GarageCar[];
  variant?: "button" | "avatar";
  onSignOut?: () => void;
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

  const trigger =
    variant === "avatar" ? (
      <button
        disabled={saving}
        title={`Posting as ${activeCar ? activeCar.nickname : username}`}
        className="relative shrink-0 rounded-full disabled:opacity-50"
      >
        <Avatar
          photoUrl={activeCar ? activeCar.photo_url : avatarUrl}
          fallback={activeCar ? activeCar.nickname : username}
          className="size-8"
        />
        {activeCar && (
          <CarLogo
            make={activeCar.make}
            className="absolute -bottom-1 -right-1 size-4 rounded-full border border-background bg-background"
          />
        )}
      </button>
    ) : (
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
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "avatar" ? "end" : "start"}>
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
        {onSignOut && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSignOut} className="flex items-center gap-2 text-muted-foreground">
              <LogOut className="size-4 shrink-0" />
              Sign out
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
