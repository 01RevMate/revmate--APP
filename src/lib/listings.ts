import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Listing = Tables<"listings">;
export type ListingWithCar = Listing & {
  cars: { make: string; model: string; generation: string } | null;
  garage_cars: {
    id: string;
    nickname: string;
    likes_count: number;
    dislikes_count: number;
    followers_count: number;
  } | null;
};

// A car-for-sale listing needs enough photos to actually sell it — mirrors
// what buyers expect from a Facebook Marketplace / AutoTrader listing.
export const MIN_CAR_LISTING_PHOTOS = 5;

const LISTING_SELECT =
  "*, cars(make, model, generation), garage_cars(id, nickname, likes_count, dislikes_count, followers_count)";

export async function fetchActiveListings(): Promise<ListingWithCar[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ListingWithCar[];
}

export async function fetchListingsForCar(carId: string): Promise<ListingWithCar[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("car_id", carId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ListingWithCar[];
}

// Used to badge a garage car "For sale" — a car is on the market if it has
// any active listing pointing at it.
export async function fetchListingsForGarageCar(garageCarId: string): Promise<Listing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select("*")
    .eq("garage_car_id", garageCarId)
    .eq("status", "active");
  if (error) throw error;
  return data;
}

// For a profile's "Selling" section.
export async function fetchActiveListingsByUser(userId: string): Promise<ListingWithCar[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ListingWithCar[];
}

// Only the seller's own currently-owned cars — for the sell.tsx picker.
export async function fetchMySellableGarageCars(userId: string) {
  const { data, error } = await supabase
    .from("garage_cars")
    .select(
      "id, nickname, make, model, generation, year, mileage, photo_url, car_id, likes_count, dislikes_count, followers_count",
    )
    .eq("user_id", userId)
    .eq("ownership_status", "current")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createListing(input: {
  userId: string;
  carId: string | null;
  garageCarId?: string | undefined;
  showCarStats: boolean;
  type: Listing["type"];
  title: string;
  description: string;
  price: number | null;
  mileage?: number | null;
  photos?: string[];
  headline?: string | null;
}): Promise<string> {
  const { data, error } = await supabase
    .from("listings")
    .insert({
      user_id: input.userId,
      car_id: input.carId || null,
      garage_car_id: input.garageCarId || null,
      show_car_stats: input.garageCarId ? input.showCarStats : false,
      type: input.type,
      title: input.title,
      description: input.description,
      price: input.price,
      mileage: input.mileage ?? null,
      photos: input.photos ?? [],
      headline: input.headline || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
