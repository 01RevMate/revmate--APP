import { useCallback, useState, type ImgHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SkeletonImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  /** Extra classes applied only while loading, e.g. a min-height for images that have no fixed size. */
  placeholderClassName?: string;
};

/**
 * A drop-in <img> that shows a pulsing grey placeholder until the picture has
 * loaded, so grids and galleries don't pop in as blank gaps. If the image
 * fails to load the placeholder stops, leaving the browser's normal fallback.
 */
export function SkeletonImage({
  className,
  placeholderClassName,
  src,
  onLoad,
  onError,
  ...props
}: SkeletonImageProps) {
  // Track which src has finished rather than a plain boolean, so swapping the
  // src on the same element shows the placeholder again.
  const [doneSrc, setDoneSrc] = useState<string | undefined>();
  const done = doneSrc === src;

  // An image already in the browser cache can finish before React attaches
  // onLoad (server-rendered pages), so check once it's mounted too.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete && img.naturalWidth > 0) setDoneSrc(src);
    },
    [src],
  );

  return (
    <img
      {...props}
      ref={ref}
      src={src}
      onLoad={(e) => {
        setDoneSrc(src);
        onLoad?.(e);
      }}
      onError={(e) => {
        setDoneSrc(src);
        onError?.(e);
      }}
      className={cn(className, !done && ["animate-pulse bg-muted text-transparent", placeholderClassName])}
    />
  );
}
