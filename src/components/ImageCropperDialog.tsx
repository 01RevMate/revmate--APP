import { useEffect, useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Offset = { x: number; y: number };

// Renders a touch-friendly pan/zoom crop box and hands back a JPEG blob.
// Everything goes through a canvas, so HEIC/large phone photos come out as
// small, browser-safe JPEGs regardless of what the camera roll provided.
export function ImageCropperDialog({
  open,
  file,
  aspect,
  circular = false,
  title,
  saving,
  onCancel,
  onConfirm,
  onPickAnother,
}: {
  open: boolean;
  file: File | null;
  aspect: number;
  circular?: boolean;
  title: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
  onPickAnother: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: number; startX: number; startY: number; base: Offset } | null>(null);

  useEffect(() => {
    if (!file) {
      setSrc(null);
      setImg(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setImg(null);
    setLoadError(null);
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    const image = new Image();
    image.onload = () => setImg(image);
    image.onerror = () =>
      setLoadError("This image format isn't supported by your browser. Try a JPEG or PNG.");
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function boxSize() {
    const el = boxRef.current;
    const w = el?.clientWidth ?? 320;
    return { w, h: w / aspect };
  }

  function baseScale() {
    if (!img) return 1;
    const { w, h } = boxSize();
    return Math.max(w / img.naturalWidth, h / img.naturalHeight);
  }

  function clamp(next: Offset, z = zoom): Offset {
    if (!img) return { x: 0, y: 0 };
    const { w, h } = boxSize();
    const dw = img.naturalWidth * baseScale() * z;
    const dh = img.naturalHeight * baseScale() * z;
    const maxX = Math.max(0, (dw - w) / 2);
    const maxY = Math.max(0, (dh - h) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (!img) return;
    dragRef.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, base: offset };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag || drag.id !== e.pointerId) return;
    setOffset(
      clamp({ x: drag.base.x + (e.clientX - drag.startX), y: drag.base.y + (e.clientY - drag.startY) }),
    );
  }

  function handlePointerUp() {
    dragRef.current = null;
  }

  function changeZoom(next: number) {
    setZoom(next);
    setOffset((o) => clamp(o, next));
  }

  async function handleConfirm() {
    if (!img) return;
    const { w, h } = boxSize();
    const scale = baseScale() * zoom;
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    // Top-left of the displayed image relative to the crop box.
    const left = (w - dw) / 2 + offset.x;
    const top = (h - dh) / 2 + offset.y;
    const sx = Math.max(0, -left / scale);
    const sy = Math.max(0, -top / scale);
    const sw = Math.min(img.naturalWidth - sx, w / scale);
    const sh = Math.min(img.naturalHeight - sy, h / scale);

    const maxOut = 1600;
    const outW = Math.round(Math.min(maxOut, sw));
    const outH = Math.round(outW / aspect);
    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.9),
    );
    if (blob) onConfirm(blob);
  }

  const displayStyle = img
    ? {
        width: `${img.naturalWidth * baseScale() * zoom}px`,
        height: `${img.naturalHeight * baseScale() * zoom}px`,
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }
    : undefined;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <DialogContent className="max-w-md gap-4">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Drag to reposition and use the slider to zoom.</DialogDescription>
        </DialogHeader>

        <div
          ref={boxRef}
          className={`relative w-full touch-none select-none overflow-hidden bg-muted ${
            circular ? "rounded-full" : "rounded-lg"
          }`}
          style={{ aspectRatio: String(aspect) }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {src && !loadError ? (
            <img
              src={src}
              alt=""
              draggable={false}
              className="absolute left-1/2 top-1/2 max-w-none cursor-grab active:cursor-grabbing"
              style={displayStyle}
            />
          ) : null}
          {!img && !loadError ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : null}
          {loadError ? (
            <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {loadError}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <RotateCcw
            className="size-4 shrink-0 cursor-pointer text-muted-foreground"
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
          />
          <Slider
            value={[zoom]}
            min={1}
            max={4}
            step={0.01}
            disabled={!img || saving}
            onValueChange={(v) => changeZoom(v[0] ?? 1)}
            aria-label="Zoom"
          />
        </div>

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onPickAnother} disabled={saving}>
            Choose another
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirm} disabled={!img || saving}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
              {saving ? "Saving…" : "Save photo"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
