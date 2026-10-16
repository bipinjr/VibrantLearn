import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

export const metadata: Metadata = { title: "Page not found" };

/** 404: the learning path, with the step you were looking for missing. */
export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-3xl flex-col px-4 py-6 sm:px-8">
      <Wordmark height={22} />
      <div className="flex flex-1 flex-col justify-center py-16">
        <div aria-hidden="true" className="mb-10 flex items-center gap-3">
          <span className="size-4 rounded-full bg-leaf" />
          <span className="h-[3px] w-16 rounded-full bg-[linear-gradient(90deg,var(--color-ember),var(--color-orchid))]" />
          <span className="size-4 rounded-full border-[3px] border-dashed border-muted" />
          <span className="h-[3px] w-16 rounded-full bg-line" />
          <span className="size-4 rounded-full bg-line" />
        </div>
        <h1 className="font-display text-5xl font-bold sm:text-6xl">This page isn&rsquo;t on the path.</h1>
        <p className="mt-4 max-w-lg text-lg text-muted">
          The link may be old or mistyped, or the class or session was deleted. Pick up from one of these instead.
        </p>
        <ul className="mt-8 flex flex-wrap gap-3">
          <li>
            <Link href="/app" className="btn btn-primary">Go to my study plans</Link>
          </li>
          <li>
            <Link href="/app/classes" className="btn btn-secondary">See live classes</Link>
          </li>
          <li>
            <Link href="/teach" className="btn btn-secondary">Teacher home</Link>
          </li>
          <li>
            <Link href="/" className="btn btn-secondary">VibrantLearn home</Link>
          </li>
        </ul>
      </div>
    </main>
  );
}
