// Mirrors apps/api/app/services/usernames.py and the DB CHECK on profiles.username.
const PATTERN = /^[A-Za-z0-9.|]{3,30}$/;

const RESERVED = new Set([
  "admin", "administrator", "support", "help", "vibrantlearn", "vibrant", "root", "system",
  "teacher", "teachers", "moderator", "mod", "staff", "official", "security", "api", "app",
  "null", "undefined", "me", "settings", "login", "signup", "auth", "onboarding",
]);

/** null when valid, otherwise a short reason to show under the field. */
export function usernameProblem(name: string): string | null {
  if (!PATTERN.test(name)) return "Use 3 to 30 letters, numbers, dots or | only.";
  if (/^[.|]|[.|]$/.test(name)) return "Start and end with a letter or number.";
  if (name.includes("..") || name.includes("||")) return "No two dots or two | in a row.";
  if (RESERVED.has(name.toLowerCase().replace(/[.|]/g, ""))) return "That name is reserved. Try another.";
  return null;
}
