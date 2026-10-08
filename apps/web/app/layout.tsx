import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Noto_Sans_Devanagari, Noto_Sans_Kannada } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-bricolage",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});
// Generated content only; not preloaded so English pages don't pay for them.
const notoKn = Noto_Sans_Kannada({
  subsets: ["kannada"],
  weight: ["400", "600"],
  variable: "--font-noto-kn",
  display: "swap",
  preload: false,
});
const notoHi = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "600"],
  variable: "--font-noto-hi",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "VibrantLearn: study plans for the hours you have", template: "%s | VibrantLearn" },
  description:
    "Tell VibrantLearn your exam and deadline, or upload your notes. Get a timed study plan, short notes, important questions, quizzes and flashcards in English, Kannada or Hindi.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F2FB" },
    { media: "(prefers-color-scheme: dark)", color: "#120E22" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Every page renders per request so proxy.ts can stamp a CSP nonce on Next's scripts.
  await connection();
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${figtree.variable} ${notoKn.variable} ${notoHi.variable} antialiased`}
    >
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
