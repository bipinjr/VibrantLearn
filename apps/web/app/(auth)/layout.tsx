import { PlanPath } from "@/components/learn/PlanPath";
import { Wordmark } from "@/components/brand/Wordmark";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="flex flex-col px-4 py-6 sm:px-10">
        <Wordmark height={24} />
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          {children}
        </main>
      </div>
      <aside aria-hidden="true" className="hidden items-center justify-center bg-ink p-12 lg:flex" data-theme="dark">
        <div className="w-full max-w-md text-text">
          <p className="font-display text-3xl leading-tight font-bold">
            Python lab exam on Friday? That&rsquo;s three evenings. Here&rsquo;s the first one.
          </p>
          <div className="mt-10">
            <PlanPath
              label="Example plan"
              steps={[
                { kind: "block", time: "6:00 – 6:45 PM", title: "Lists, tuples and comprehensions", minutes: 45, state: "done" },
                { kind: "block", time: "6:50 – 7:30 PM", title: "Dictionaries and sets", minutes: 40, state: "now" },
                { kind: "block", time: "7:40 – 8:20 PM", title: "File handling with the with statement", minutes: 40 },
                { kind: "checkpoint", time: "8:25 PM", title: "Write a word-count program from memory" },
              ]}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
