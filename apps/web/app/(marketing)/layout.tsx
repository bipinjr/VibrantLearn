import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { enterDemo } from "../(auth)/demo-actions";
import { demoEnabled } from "@/lib/demo/mode";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  const demo = demoEnabled();
  return (
    <>
      <span className="scroll-progress" aria-hidden="true" />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-md focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="site-header sticky top-0 z-50 border-b border-transparent backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-4 sm:px-6">
          <Wordmark height={22} />
          <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted no-underline hover:text-text md:inline">
              How it works
            </a>
            <a href="#notes" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted no-underline hover:text-text md:inline">
              Your notes
            </a>
            <a href="#privacy" className="hidden rounded-md px-3 py-2 text-sm font-medium text-muted no-underline hover:text-text md:inline">
              Privacy
            </a>
            <Link href="/login" className="whitespace-nowrap rounded-md px-2 py-2 text-sm font-medium text-text no-underline hover:underline sm:px-3">
              Sign in
            </Link>
            {demo ? (
              <form action={enterDemo}>
                <button type="submit" className="btn btn-primary min-h-10 whitespace-nowrap px-4 text-sm">
                  Try the demo
                </button>
              </form>
            ) : (
              <Link href="/signup" className="btn btn-primary min-h-10 px-4 text-sm">
                Get started
              </Link>
            )}
          </nav>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="mt-28 border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="grid content-start gap-3">
            <Wordmark height={24} />
            <p className="max-w-sm text-sm text-muted">
              Personal study plans for Indian college students. Built by Bipin A and Darshan H.S., BCA, KLE Society&rsquo;s S.
              Nijalingappa College, Bengaluru.
            </p>
          </div>
          <nav aria-label="Product" className="grid content-start gap-2 text-sm">
            <p className="font-semibold">Product</p>
            <a href="#how" className="text-muted no-underline hover:text-text">How it works</a>
            <a href="#notes" className="text-muted no-underline hover:text-text">Ask your notes</a>
            <Link href="/signup" className="text-muted no-underline hover:text-text">Create an account</Link>
          </nav>
          <nav aria-label="Company" className="grid content-start gap-2 text-sm">
            <p className="font-semibold">VibrantLearn</p>
            <Link href="/privacy" className="text-muted no-underline hover:text-text">Privacy notice</Link>
            <Link href="/login" className="text-muted no-underline hover:text-text">Sign in</Link>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-muted sm:px-6">
            &copy; 2026 Bipin A and Darshan H.S. Made in Bengaluru.
          </p>
        </div>
      </footer>
    </>
  );
}
