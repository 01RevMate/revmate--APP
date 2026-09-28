import { isPublicPath } from "@/components/AuthGate";
import { breadcrumbs, pickShareImage, seo, summarise, absoluteUrl } from "@/lib/seo";
import type {
  fetchGarageCarSeo,
  fetchGroupSeo,
  fetchMeetSeo,
  fetchPostSeo,
  fetchProfileSeo,
} from "@/lib/seoData";
import { displayUsername, displayUsernameWithoutAt } from "@/lib/usernames";

// Head tags for shareable pages. Pages that need an account (see AuthGate)
// still get rich link previews, but stay out of Google until they're
// viewable signed out — otherwise Google would index the join screen.

type Loaded<F extends (...args: never[]) => unknown> = Awaited<ReturnType<F>>;
const indexable = (path: string) => isPublicPath(path);

export function postHead(postId: string, post: Loaded<typeof fetchPostSeo>) {
  const path = `/posts/${postId}`;
  if (!post) {
    return seo({
      title: "Post — RevMate",
      description:
        "This post isn't available. See what the RevMate car community is talking about.",
      path,
      noindex: true,
    });
  }
  const author = post.profiles ? displayUsername(post.profiles.username) : "A RevMate member";
  const firstLine = summarise(post.body, 70) || "Photos";
  const images = [...(post.post_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((image) => image.image_url);
  return seo({
    title: `${author} on RevMate: “${firstLine}”`,
    description: post.body || `${author} shared a post on RevMate.`,
    path,
    image: pickShareImage(...images),
    type: "article",
    noindex: !indexable(path),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "SocialMediaPosting",
      headline: firstLine,
      articleBody: post.body,
      datePublished: post.created_at,
      url: absoluteUrl(path),
      author: post.profiles
        ? {
            "@type": "Person",
            name: author,
            url: absoluteUrl(`/u/${displayUsernameWithoutAt(post.profiles.username)}`),
          }
        : undefined,
    },
  });
}

export function profileHead(username: string, profile: Loaded<typeof fetchProfileSeo>) {
  const handle = displayUsername(username);
  const path = `/u/${displayUsernameWithoutAt(username)}`;
  if (!profile) {
    return seo({
      title: `${handle} — RevMate`,
      description: "This profile isn't available on RevMate.",
      path,
      noindex: true,
    });
  }
  const cars = profile.cars.map((car) => `${car.make} ${car.model}`);
  const description =
    profile.bio ||
    (cars.length
      ? `${handle} drives ${cars.slice(0, 3).join(", ")}. See their garage, builds and posts on RevMate.`
      : `See ${handle}'s garage, builds and posts on RevMate.`);
  return seo({
    title: `${handle}${cars[0] ? ` · ${cars[0]}` : ""} — RevMate`,
    description,
    path,
    image: pickShareImage(profile.cars[0]?.photo_url, profile.cover_photo_url, profile.avatar_url),
    type: "profile",
    noindex: !indexable(path),
    extraMeta: [{ property: "profile:username", content: displayUsernameWithoutAt(username) }],
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      mainEntity: {
        "@type": "Person",
        name: handle,
        alternateName: displayUsernameWithoutAt(username),
        ...(profile.bio ? { description: profile.bio } : {}),
        ...(profile.avatar_url ? { image: profile.avatar_url } : {}),
        url: absoluteUrl(path),
      },
    },
  });
}

export function garageCarHead(
  username: string,
  carId: string,
  car: Loaded<typeof fetchGarageCarSeo>,
) {
  const handle = displayUsername(username);
  const path = `/u/${displayUsernameWithoutAt(username)}/cars/${carId}`;
  if (!car) {
    return seo({
      title: `${handle}'s car — RevMate`,
      description: "This car isn't available on RevMate.",
      path,
      noindex: true,
    });
  }
  const name = [car.year, car.make, car.model, car.generation].filter(Boolean).join(" ");
  const title = `${car.nickname ? `“${car.nickname}” · ` : ""}${name} — ${handle} on RevMate`;
  const description =
    car.bio ||
    [
      `${handle}'s ${name}`,
      car.spec,
      car.horsepower ? `${car.horsepower}hp` : null,
      "See the build, mods and photos on RevMate.",
    ]
      .filter(Boolean)
      .join(" · ");
  return seo({
    title,
    description,
    path,
    image: pickShareImage(car.photo_url),
    imageAlt: name,
    noindex: !indexable(path),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Car",
      name,
      brand: { "@type": "Brand", name: car.make },
      model: car.model,
      ...(car.year ? { vehicleModelDate: String(car.year) } : {}),
      ...(car.photo_url ? { image: car.photo_url } : {}),
      url: absoluteUrl(path),
    },
  });
}

export function groupHead(slug: string, group: Loaded<typeof fetchGroupSeo>) {
  const path = `/groups/${slug}`;
  if (!group) {
    return seo({
      title: "Group — RevMate",
      description: "This group isn't available on RevMate.",
      path,
      noindex: true,
    });
  }
  const car = [group.make_name, group.model_name].filter(Boolean).join(" ");
  return seo({
    title: `${group.name}${car && !group.name.includes(car) ? ` · ${car}` : ""} — RevMate Group`,
    description:
      group.description ||
      `Join ${group.name} on RevMate: ${group.member_count} ${group.member_count === 1 ? "member" : "members"}${car ? ` talking ${car}` : ""}.`,
    path,
    noindex: group.visibility === "private" || !indexable(path),
    jsonLd: breadcrumbs([
      { name: "Groups", path: "/groups" },
      { name: group.name, path },
    ]),
  });
}

export function meetHead(meetId: string, meet: Loaded<typeof fetchMeetSeo>) {
  const path = `/meets/${meetId}`;
  if (!meet) {
    return seo({
      title: "Car Meet — RevMate",
      description: "Find car meets near you on RevMate.",
      path,
      noindex: true,
    });
  }
  const when = new Date(meet.starts_at).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
  return seo({
    title: `${meet.cancelled_at ? "Cancelled: " : ""}${meet.title} · ${when} — RevMate Car Meet`,
    description: `${when} at ${meet.location_name}. ${meet.description || "See who's going and RSVP on RevMate."}`,
    path,
    image: pickShareImage(meet.cover_url),
    noindex: !indexable(path),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Event",
      name: meet.title,
      startDate: meet.starts_at,
      ...(meet.ends_at ? { endDate: meet.ends_at } : {}),
      eventStatus: meet.cancelled_at
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: meet.location_name,
        address: meet.address || meet.location_name,
      },
      ...(meet.description ? { description: meet.description } : {}),
      ...(meet.cover_url ? { image: meet.cover_url } : {}),
      url: absoluteUrl(path),
    },
  });
}
