import { useQuery } from "@tanstack/react-query";
import { CoverPicker } from "@/components/CoverPicker";
import { fetchMyPastMeetCovers, MEET_COVER_DESIGNS } from "@/lib/meetCovers";

/** Meet covers: your own photo, one from a past meet, or a RevMate design. */
export function MeetCoverPicker({
  userId,
  value,
  onChange,
}: {
  userId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const { data: past } = useQuery({
    queryKey: ["meet-covers", "mine", userId],
    queryFn: () => fetchMyPastMeetCovers(userId),
    staleTime: 5 * 60_000,
  });
  return (
    <CoverPicker
      label="Cover image"
      hint="A great cover gets more people going. Use a photo from a previous meet, or pick a design."
      userId={userId}
      value={value}
      onChange={onChange}
      suggestions={[
        { title: "Used on your past meets", options: past ?? [] },
        { title: "RevMate designs", options: MEET_COVER_DESIGNS },
      ]}
    />
  );
}
