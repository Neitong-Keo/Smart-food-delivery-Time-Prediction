"use client";

import { Utensils } from "lucide-react";
import { useState } from "react";

interface RestaurantImageProps {
  src: string | null;
  alt: string;
  className?: string;
  size?: number;
  eager?: boolean;
}

export function RestaurantImage({ src, alt, className, size = 800, eager = false }: RestaurantImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span className={`restaurant-photo-empty ${className ?? ""}`} role="img" aria-label={alt}>
        <Utensils size={22} aria-hidden />
      </span>
    );
  }

  return (
    // Backend-provided URLs may be on any host, so next/image is not used here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={className}
      src={src}
      alt={alt}
      width={size}
      height={Math.round(size * 0.75)}
      loading={eager ? "eager" : "lazy"}
      onError={() => setFailed(true)}
    />
  );
}
