import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10 sm:px-6 [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_p]:mt-3 [&_li]:mt-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-4xl font-extrabold sm:text-5xl">Privacy notice</h1>
      <p className="text-muted">Draft for the v0.4 prototype. Last updated 8 October 2026.</p>

      <h2>What we store</h2>
      <ul>
        <li>Your email address and how you sign in (email or Google).</li>
        <li>Your profile: username, university, course, semester, syllabus scheme, language and study preferences.</li>
        <li>Your study sessions: what you type, the plans, notes, questions, quizzes and flashcards we make for you, and your quiz scores.</li>
        <li>Files you upload and the text we read from them.</li>
        <li>Basic security records, such as sign-ins and rate-limit hits. We store a scrambled form of your IP address, never the address itself.</li>
      </ul>

      <h2>Why we store it</h2>
      <p>
        Only to build and show your study plans and materials, keep your account secure and stop abuse. We don&rsquo;t sell
        your data, show ads, or share it with your college.
      </p>

      <h2>AI processing</h2>
      <p>
        To write notes and questions, we send the smallest needed part of your request or notes to our AI provider (Groq).
        Your files and chats are never used to train any model, by us or by them.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Edit your profile and preferences any time in Settings.</li>
        <li>Download a copy of your data from Settings.</li>
        <li>Delete a session, or your whole account. Deleting removes your rows and your uploaded files.</li>
      </ul>

      <h2>How long we keep things</h2>
      <p>
        Your study data stays until you delete it. Security logs are kept for 180 days, usage counts for 90 days and
        cached AI answers for 30 days.
      </p>

      <h2>Contact</h2>
      <p>
        VibrantLearn is a student project from KLE Society&rsquo;s S. Nijalingappa College, Bengaluru. A contact address
        for privacy requests will be listed here before public launch.
      </p>
    </article>
  );
}
