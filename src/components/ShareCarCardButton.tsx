import { useState } from "react";
import { ImageDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { GarageCar } from "@/lib/garage";

const WIDTH = 1080;
const HEIGHT = 1350; // Instagram portrait

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // keeps the canvas exportable
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

async function renderCard(car: GarageCar, rank: number | null | undefined): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const background = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  background.addColorStop(0, "#0b0b0f");
  background.addColorStop(1, "#1c1c24");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const [photo, logo] = await Promise.all([
    car.photo_url ? loadImage(car.photo_url) : Promise.resolve(null),
    loadImage("/splash-logo.png"),
  ]);
  const photoHeight = 860;
  if (photo) {
    drawCover(ctx, photo, 0, 0, WIDTH, photoHeight);
    const fade = ctx.createLinearGradient(0, photoHeight - 260, 0, photoHeight);
    fade.addColorStop(0, "rgba(11,11,15,0)");
    fade.addColorStop(1, "rgba(11,11,15,1)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, photoHeight - 260, WIDTH, 260);
  }

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  let y = photoHeight + 20;
  if (rank) {
    ctx.fillStyle = "#f59e0b";
    ctx.font = "800 92px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(`#${rank} in the UK`, 72, y);
    y += 78;
  }
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 64px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(car.nickname.slice(0, 26), 72, y);
  y += 56;
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 40px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText([car.year, car.make, car.model].filter(Boolean).join(" ").slice(0, 40), 72, y);
  y += 70;

  const stats = [
    `❤️ ${car.likes_count} likes`,
    car.battle_wins ? `🏆 ${car.battle_wins} battle wins` : null,
    car.followers_count ? `👀 ${car.followers_count} followers` : null,
  ].filter(Boolean) as string[];
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 38px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(stats.join("   "), 72, y);

  if (logo) {
    const logoWidth = 260;
    const logoHeight = (logo.height / logo.width) * logoWidth;
    ctx.drawImage(logo, WIDTH - logoWidth - 56, HEIGHT - logoHeight - 48, logoWidth, logoHeight);
  }
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = "500 32px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("Rate it on RevMate", 72, HEIGHT - 70);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the image"))),
        "image/png",
      );
    } catch (err) {
      reject(err instanceof Error ? err : new Error("Couldn't make the image"));
    }
  });
}

/** Makes an Instagram-sized "ranked #3 in the UK" card for a car and shares it. */
export function ShareCarCardButton({
  car,
  rank,
}: {
  car: GarageCar;
  rank?: number | null | undefined;
}) {
  const [busy, setBusy] = useState(false);

  async function share() {
    setBusy(true);
    try {
      const blob = await renderCard(car, rank);
      const file = new File(
        [blob],
        `${car.nickname.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-revmate.png`,
        {
          type: "image/png",
        },
      );
      const url = window.location.href.includes("/cars/")
        ? window.location.href
        : window.location.origin;
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: car.nickname,
          text: `Check out ${car.nickname} on RevMate ${url}`,
        });
      } else {
        const link = document.createElement("a");
        link.href = URL.createObjectURL(file);
        link.download = file.name;
        link.click();
        URL.revokeObjectURL(link.href);
        toast.success("Card saved — post it to your story!");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      toast.error(err instanceof Error ? err.message : "Couldn't make the share card");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs font-medium text-primary underline disabled:opacity-50"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageDown className="size-3.5" />}
      Share card
    </button>
  );
}
