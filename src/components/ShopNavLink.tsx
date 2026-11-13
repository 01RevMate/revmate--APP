import { forwardRef, type MouseEventHandler } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink, ShoppingBag } from "lucide-react";
import { SHOP_LIVE, SHOP_URL } from "@/lib/shop";

type ShopNavLinkProps = {
  className: string;
  activeClassName?: string;
  showLabel?: boolean;
  showExternalIcon?: boolean;
  onNavigate?: () => void;
};

/** Shop in the menu: coming-soon page for now, live storefront once SHOP_LIVE is true. */
export const ShopNavLink = forwardRef<HTMLAnchorElement, ShopNavLinkProps>(function ShopNavLink(
  { className, activeClassName, showLabel = true, showExternalIcon = false, onNavigate },
  ref,
) {
  const icon = <ShoppingBag className="size-5 shrink-0" />;
  const onClick: MouseEventHandler<HTMLAnchorElement> | undefined = onNavigate
    ? () => onNavigate()
    : undefined;

  if (SHOP_LIVE) {
    return (
      <a
        ref={ref}
        href={SHOP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Shop, opens in a new tab"
        className={className}
        onClick={onClick}
      >
        {icon}
        {showLabel ? "Shop" : null}
        {showLabel && showExternalIcon ? (
          <ExternalLink className="ml-auto size-4 opacity-60" />
        ) : null}
      </a>
    );
  }

  return (
    <Link
      ref={ref}
      to="/shop"
      className={className}
      {...(activeClassName ? { activeProps: { className: activeClassName } } : {})}
      onClick={onClick}
    >
      {icon}
      {showLabel ? "Shop" : null}
    </Link>
  );
});
