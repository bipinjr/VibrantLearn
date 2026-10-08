import Image from "next/image";
import Link from "next/link";

/** The official wordmark files from brand/. Never retyped or restyled. Min width 96px. */
export function Wordmark({ height = 28, href = "/" }: { height?: number; href?: string | null }) {
  const width = Math.round(height * 6.07);
  const imgs = (
    <>
      <Image priority src="/brand/logo-wordmark.svg" alt="VibrantLearn" width={width} height={height} className="only-light" />
      <Image priority src="/brand/logo-wordmark-dark.svg" alt="VibrantLearn" width={width} height={height} className="only-dark" />
    </>
  );
  if (!href) return imgs;
  return (
    <Link href={href} className="inline-flex shrink-0 rounded-sm" aria-label="VibrantLearn home">
      {imgs}
    </Link>
  );
}
