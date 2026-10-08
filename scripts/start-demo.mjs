#!/usr/bin/env node
// One command local demo: install (first run), build (first run or --rebuild), start on :3000, open the browser.
// Usage: node scripts/start-demo.mjs [--rebuild] [--dev] [--no-open]
import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = join(root, "apps", "web");
const args = new Set(process.argv.slice(2));
const PNPM = ["--yes", "pnpm@12.10.1"];
const isWin = process.platform === "win32";
const URL = "http://localhost:3000";

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`Node.js 20 or newer is needed (you have ${process.versions.node}). Install it from https://nodejs.org and try again.`);
  process.exit(1);
}

function pnpm(cmdArgs, opts = {}) {
  const r = spawnSync("npx", [...PNPM, ...cmdArgs], { cwd: web, stdio: "inherit", shell: isWin, ...opts });
  if (r.status !== 0) {
    console.error(`\n"pnpm ${cmdArgs.join(" ")}" failed. Scroll up for the reason.`);
    process.exit(r.status ?? 1);
  }
}

if (!existsSync(join(web, ".env.local"))) {
  copyFileSync(join(web, ".env.demo"), join(web, ".env.local"));
  console.log("Created apps/web/.env.local from .env.demo (demo settings, no secrets).");
}

if (!existsSync(join(web, "node_modules"))) {
  console.log("Installing packages (first run only, takes a few minutes)...");
  pnpm(["install", "--frozen-lockfile"]);
}

const dev = args.has("--dev");
if (!dev && (args.has("--rebuild") || !existsSync(join(web, ".next", "BUILD_ID")))) {
  console.log("Building the app (about a minute)...");
  pnpm(["build"]);
}

console.log(`\nStarting VibrantLearn on ${URL}  (press Ctrl+C to stop)\n`);
const server = spawn("npx", [...PNPM, dev ? "dev" : "start"], { cwd: web, stdio: "inherit", shell: isWin });

if (!args.has("--no-open")) {
  const opener = isWin ? ["cmd", ["/c", "start", "", URL]] : process.platform === "darwin" ? ["open", [URL]] : ["xdg-open", [URL]];
  // Open once the server answers.
  const started = Date.now();
  const poll = setInterval(async () => {
    try {
      const r = await fetch(URL, { redirect: "manual" });
      if (r.status < 500) {
        clearInterval(poll);
        spawn(opener[0], opener[1], { stdio: "ignore", detached: true }).unref();
      }
    } catch {
      if (Date.now() - started > 120_000) clearInterval(poll);
    }
  }, 1000);
}

server.on("exit", (code) => process.exit(code ?? 0));
