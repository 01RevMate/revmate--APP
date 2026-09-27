import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type CarMeet = Tables<"car_meets">;
export type MeetStatus = "going" | "interested";

export type MeetWithOrganizer = CarMeet & {
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
};

export type MeetAttendee = {
  user_id: string;
  status: MeetStatus;
  profiles: Pick<Tables<"profiles">, "username" | "avatar_url"> | null;
};

const MEET_SELECT = "*, profiles!car_meets_organizer_id_fkey(username, avatar_url)";

export async function fetchUpcomingMeets(): Promise<MeetWithOrganizer[]> {
  // Still show meets that started in the last few hours (they may be on now).
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("car_meets")
    .select(MEET_SELECT)
    .is("cancelled_at", null)
    .gte("starts_at", since)
    .order("starts_at", { ascending: true })
    .limit(100);
  if (error) throw error;
  return data as unknown as MeetWithOrganizer[];
}

/** Meets you organise or have RSVP'd to, including past ones. */
export async function fetchMyMeets(userId: string): Promise<MeetWithOrganizer[]> {
  const { data: rsvps, error: rsvpError } = await supabase
    .from("meet_attendees")
    .select("meet_id")
    .eq("user_id", userId);
  if (rsvpError) throw rsvpError;
  const ids = rsvps.map((row) => row.meet_id);
  const filter = ids.length
    ? `organizer_id.eq.${userId},id.in.(${ids.join(",")})`
    : `organizer_id.eq.${userId}`;
  const { data, error } = await supabase
    .from("car_meets")
    .select(MEET_SELECT)
    .or(filter)
    .order("starts_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data as unknown as MeetWithOrganizer[];
}

export async function fetchMeet(id: string): Promise<MeetWithOrganizer | null> {
  const { data, error } = await supabase
    .from("car_meets")
    .select(MEET_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as MeetWithOrganizer | null;
}

export async function createMeet(input: {
  organizerId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string | null;
  locationName: string;
  address: string | null;
  coverUrl: string | null;
}): Promise<string> {
  // Client-side id, no RETURNING — same pattern as createPost.
  const id = crypto.randomUUID();
  const { error } = await supabase.from("car_meets").insert({
    id,
    organizer_id: input.organizerId,
    title: input.title.trim(),
    description: input.description.trim(),
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    location_name: input.locationName.trim(),
    address: input.address?.trim() || null,
    cover_url: input.coverUrl,
  });
  if (error) throw error;
  // The organiser is going to their own meet.
  await supabase
    .from("meet_attendees")
    .insert({ meet_id: id, user_id: input.organizerId, status: "going" });
  return id;
}

export async function cancelMeet(id: string) {
  const { error } = await supabase
    .from("car_meets")
    .update({ cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMeet(id: string) {
  const { error } = await supabase.from("car_meets").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchAttendees(meetId: string): Promise<MeetAttendee[]> {
  const { data, error } = await supabase
    .from("meet_attendees")
    .select("user_id, status, profiles!meet_attendees_user_id_fkey(username, avatar_url)")
    .eq("meet_id", meetId)
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data as unknown as MeetAttendee[];
}

export async function fetchMyRsvps(userId: string): Promise<Map<string, MeetStatus>> {
  const { data, error } = await supabase
    .from("meet_attendees")
    .select("meet_id, status")
    .eq("user_id", userId);
  if (error) throw error;
  return new Map(data.map((row) => [row.meet_id, row.status as MeetStatus]));
}

export async function setRsvp(meetId: string, userId: string, status: MeetStatus | null) {
  if (status === null) {
    const { error } = await supabase
      .from("meet_attendees")
      .delete()
      .eq("meet_id", meetId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from("meet_attendees")
    .upsert({ meet_id: meetId, user_id: userId, status }, { onConflict: "meet_id,user_id" });
  if (error) throw error;
}

export function mapsSearchUrl(meet: Pick<CarMeet, "location_name" | "address">) {
  const query = [meet.location_name, meet.address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function mapsEmbedUrl(meet: Pick<CarMeet, "location_name" | "address">) {
  const query = [meet.location_name, meet.address].filter(Boolean).join(", ");
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}

/** An .ics file so people can drop the meet into their phone calendar. */
export function meetCalendarFile(meet: CarMeet, url: string): string {
  const stamp = (iso: string) =>
    new Date(iso)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const end =
    meet.ends_at ?? new Date(new Date(meet.starts_at).getTime() + 3 * 60 * 60 * 1000).toISOString();
  const escape = (text: string) => text.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//RevMate//Car Meets//EN",
    "BEGIN:VEVENT",
    `UID:${meet.id}@revmate`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(meet.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(meet.title)}`,
    `LOCATION:${escape([meet.location_name, meet.address].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${escape(`${meet.description}\n\n${url}`.trim())}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
