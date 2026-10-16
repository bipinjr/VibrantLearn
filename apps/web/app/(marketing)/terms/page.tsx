import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of use" };

/** Plain-language terms for the prototype. A lawyer reviews this before money moves (ROADMAP v0.5). */
export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:mt-3 [&_li]:mt-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Terms of use</h1>
      <p className="text-muted">Draft for the VibrantLearn prototype. Last updated 17 October 2026.</p>
      <p>
        These terms are the rules for using VibrantLearn, as a student or as a teacher. By creating an account you agree to
        them. How we handle your data is in the <Link href="/privacy">privacy notice</Link>.
      </p>

      <h2>Who can use VibrantLearn</h2>
      <ul>
        <li>Students in college or pre-university courses. If you are under 18, use it with a parent or guardian&rsquo;s permission.</li>
        <li>Teachers who are 18 or older and pass our manual check of their certificate or college ID.</li>
        <li>One person per account. Keep your password to yourself; you are responsible for what happens on your account.</li>
      </ul>

      <h2>Study plans, notes and AI answers</h2>
      <ul>
        <li>Plans, notes, questions and quizzes are study help, generated partly by AI. They can be wrong. Check important facts with your textbook or lecturer.</li>
        <li>We don&rsquo;t promise marks or results.</li>
        <li>Only upload notes and files you have the right to use. Don&rsquo;t upload other people&rsquo;s personal information.</li>
      </ul>

      <h2>Live classes: rules for everyone</h2>
      <ul>
        <li>Classes are live only. Nobody may record, screenshot or share a class or its chat.</li>
        <li>Be respectful. No abuse, sexual content, hate, threats, spam or harassment, in any language.</li>
        <li>Don&rsquo;t share or ask for phone numbers, social media handles or other contact details. You join and talk only inside VibrantLearn.</li>
        <li>
          A moderation bot checks every chat message before others see it. A hidden message counts as a warning; after 3 warnings
          in a class you are removed from it. Repeated removals can block your account from live classes.
        </li>
        <li>You can report a person or a message. We review reports and tell you the outcome.</li>
      </ul>

      <h2>For teachers</h2>
      <ul>
        <li>Teach the topic you posted, at the time you posted it, and keep it suitable for students.</li>
        <li>A class runs only if enough students mark Interested by the start time; otherwise it cancels itself at no cost to you.</li>
        <li>If you don&rsquo;t join your own class within 10 minutes of the start, it is cancelled and you get a warning. Three warnings suspend your teaching account. You can appeal any warning.</li>
        <li>
          Pay: about &#8377;2,000 per class, minus a 20% platform fee shown before you post. During the prototype, payouts are made by
          UPI or bank transfer after you request a withdrawal. Online payments, invoices and tax deductions come later and these
          terms will be updated first.
        </li>
        <li>You never see students&rsquo; private study data, and you must not try to.</li>
      </ul>

      <h2>Rewards and leaderboards</h2>
      <p>
        Points and badges are for fun and motivation. They have no cash value, and we may reset them if they are earned by
        cheating.
      </p>

      <h2>Ending your account</h2>
      <p>
        You can delete your account at any time from Settings; your data goes with it. We may suspend accounts that break
        these rules, and we&rsquo;ll tell you why.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We&rsquo;ll update this page when the rules change and show the new date at the top. Questions: write to the
        VibrantLearn team, Bipin A and Darshan H.S., KLE Society&rsquo;s S. Nijalingappa College, Bengaluru.
      </p>
    </article>
  );
}
