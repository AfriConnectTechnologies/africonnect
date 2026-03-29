import Image from "next/image";

import { cn } from "@/lib/utils";

const BRAND_ICON_SRC = "/logo2.webp?v=20260314a";

type BrandIconProps = {
  className?: string;
  priority?: boolean;
  size?: number;
};

export function BrandIcon({
  className,
  priority = false,
  size = 32,
}: BrandIconProps) {
  return (
    <Image
      src={BRAND_ICON_SRC}
      alt="AfriConnect"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
