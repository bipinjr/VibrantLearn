"""End-to-end smoke test for the local demo.

Run with the demo server up (npm run demo):
    uv run --no-project --with playwright python apps/web/e2e/smoke.py

Uses the installed Google Chrome (BROWSER_CHANNEL=msedge for Edge) in a throwaway headless
context, so no browser download is needed and your own profile is never touched.
Exit code 0 = every step passed.
"""

import os
import re
import sys
import tempfile
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
CHANNEL = os.environ.get("BROWSER_CHANNEL", "chrome")
passed: list[str] = []


def step(name: str) -> None:
    passed.append(name)
    print(f"  ok  {name}", flush=True)


def send(page: Page, text: str) -> None:
    box = page.locator("textarea")
    box.fill(text)
    box.press("Enter")


def run() -> None:
    errors: list[str] = []
    tmp = Path(tempfile.mkdtemp(prefix="vl-e2e-", dir=Path(__file__).parent))
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=CHANNEL, headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light", reduced_motion="reduce", accept_downloads=True)
        page = ctx.new_page()
        page.on("pageerror", lambda e: errors.append(f"pageerror: {e}"))
        page.on("console", lambda m: m.type == "error" and errors.append(f"console: {m.text}"))

        # --- guard + headers ------------------------------------------------------------------
        page.goto(f"{BASE}/app/plans")
        expect(page).to_have_url(re.compile(r"/login\?next=%2Fapp%2Fplans"))
        step("signed-out visit to /app/plans redirects to /login?next=...")

        r = page.request.get(f"{BASE}/")
        csp = r.headers.get("content-security-policy", "")
        assert "nonce-" in csp and "frame-ancestors 'none'" in csp, csp
        assert r.headers.get("x-frame-options") == "DENY"
        assert "x-powered-by" not in r.headers
        step("security headers: nonce CSP, frame-ancestors none, X-Frame-Options, no X-Powered-By")

        # --- landing ----------------------------------------------------------------------------
        page.goto(BASE)
        expect(page.get_by_role("heading", level=1)).to_contain_text("Tell us your exam")
        expect(page.get_by_text("Built by Bipin A and Darshan H.S.", exact=False)).to_be_visible()
        page.get_by_role("radio", name="हिन्दी").check()
        expect(page.locator("p[lang=hi]").first).to_be_visible()
        step("landing renders; language switch shows Hindi notes")

        page.fill("#waitlist-email", "not-an-email")
        page.press("#waitlist-email", "Enter")
        expect(page.locator("#waitlist-error")).to_contain_text("Enter an email")
        page.fill("#waitlist-email", "teacher@college.edu")
        page.press("#waitlist-email", "Enter")
        expect(page.get_by_text("You’re on the list")).to_be_visible()
        step("teacher waitlist validates and confirms")

        # --- demo sign-in + dashboard -----------------------------------------------------------
        page.locator("header").get_by_role("button", name="Try the demo").click()
        expect(page).to_have_url(f"{BASE}/app")
        expect(page.get_by_text("Next up", exact=False)).to_be_visible()
        assert "vl_demo" not in page.evaluate("document.cookie"), "demo cookie must be httpOnly"
        step("Try the demo opens the dashboard (httpOnly cookie)")

        title = page.locator("section[aria-labelledby=next-h] p.font-display").first
        before = title.inner_text()
        page.get_by_role("button", name="Mark done").click()
        expect(title).not_to_have_text(before)
        step("Mark done moves Next up to the following step")

        # --- new session: Kanglish request -> follow-up -> plan ----------------------------------
        page.get_by_role("link", name="New study session").first.click()
        expect(page.get_by_role("heading", name="What’s your next test?")).to_be_visible()
        send(page, "nale DBMS test ide, normalization weak")
        expect(page.get_by_text("How many hours can you study each day?")).to_be_visible()
        page.get_by_role("button", name="2 hours").click()
        expect(page.get_by_role("link", name="Open plan")).to_be_visible(timeout=8000)
        expect(page.locator("#page-title")).to_have_text("DBMS test")
        expect(page.get_by_role("button", name="2 hours")).to_be_disabled()
        step("Kanglish request -> hours follow-up -> timed DBMS plan; chips lock after use")

        send(page, "explain normalization in kannada")
        expect(page.get_by_text("Notes: Normal forms 1NF to BCNF")).to_be_visible(timeout=8000)
        assert re.search(r"[ಀ-೿]", page.locator("p[lang=kn]").last.inner_text())
        step("notes for the right topic, in Kannada script")

        ai_badges = page.get_by_text("Written by AI", exact=False)
        before_ai = ai_badges.count()
        send(page, "who won the cricket match yesterday?")
        if os.environ.get("EXPECT_AI") == "1":
            # Notes are AI-written too, so wait for one more AI badge, not just any.
            expect(ai_badges).to_have_count(before_ai + 1, timeout=25000)
            expect(page.get_by_role("status")).to_have_count(0, timeout=25000)
        else:
            expect(page.get_by_text("isn't switched on in this demo", exact=False).last).to_be_visible(timeout=10000)
        send(page, "thanks")
        expect(page.get_by_text("You're welcome", exact=False).last).to_be_visible(timeout=5000)
        step("off-topic question handled (AI or polite fallback); small talk answered")

        send(page, "quiz me on dbms")
        quiz = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Quiz")))
        expect(quiz).to_be_visible(timeout=8000)
        quiz.locator("button").first.click()
        expect(quiz.get_by_role("status")).to_contain_text(re.compile("Correct|Not quite"))
        step("quiz answers and explains")

        send(page, "flashcards for dbms")
        cards = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Flashcards")))
        expect(cards).to_be_visible(timeout=8000)
        cards.get_by_role("button", name=re.compile("Press to see the answer")).click()
        cards.get_by_role("button", name="Know it").click()
        expect(cards.get_by_text("Card 2 of", exact=False)).to_be_visible()
        step("flashcards flip and advance")

        # --- plan page: tick + replan -------------------------------------------------------------
        page.get_by_role("link", name="Open plan").first.click()
        expect(page.get_by_role("button", name="Replan from now")).to_be_visible()
        first = page.get_by_role("checkbox").first
        first.click()
        expect(first).to_have_attribute("aria-checked", "true")
        page.get_by_role("button", name="Replan from now").click()
        expect(page.get_by_text("Replanned.", exact=False)).to_be_visible()
        step("tick a step, then replan from now")

        # --- files: allowlist, size cap, upload pipeline ------------------------------------------
        notes = tmp / "Unit4_Normalization.txt"
        notes.write_text("1NF removes repeating groups. 2NF removes partial dependencies.", encoding="utf-8")
        evil = tmp / "evil.exe"
        evil.write_bytes(b"MZ" + b"\0" * 64)
        big = tmp / "Full_textbook.pdf"
        with big.open("wb") as fh:
            fh.truncate(51 * 1024 * 1024)
        page.goto(f"{BASE}/app/files")
        page.locator("input[type=file]").set_input_files([str(notes), str(evil), str(big)])
        expect(page.get_by_role("alert").filter(has_text="evil.exe")).to_contain_text("this file type isn't supported")
        expect(page.get_by_text("This file is over 50 MB", exact=False).first).to_be_visible()
        row = page.locator("tr", has_text="Unit4_Normalization.txt")
        expect(row).to_contain_text("Ready", timeout=15000)
        step("uploads: .exe rejected, 51 MB rejected, text file uploads -> checks -> Ready")

        # --- settings -------------------------------------------------------------------------
        page.goto(f"{BASE}/app/settings")
        page.get_by_role("radio", name="Dark").click()
        assert page.evaluate("document.documentElement.dataset.theme") == "dark"
        page.get_by_role("radio", name="System").click()
        with page.expect_download() as dl:
            page.get_by_role("button", name="Export my data").click()
        assert dl.value.suggested_filename.startswith("vibrantlearn-export-")
        expect(page.get_by_role("button", name="Delete my account")).to_be_disabled()
        step("settings: theme switch, data export downloads, delete stays off in demo")

        # --- phone, tablet, laptop: no sideways scrolling anywhere ---------------------------------
        pages = ["/", "/login", "/privacy", "/app", "/app/new", "/app/plans", "/app/files", "/app/settings", "/app/s/java-internal"]
        for width, height in [(360, 780), (768, 1024), (1280, 800)]:
            page.set_viewport_size({"width": width, "height": height})
            for path in pages:
                page.goto(f"{BASE}{path}")
                page.wait_for_load_state("networkidle")
                sw, cw = page.evaluate("[document.documentElement.scrollWidth, document.documentElement.clientWidth]")
                assert sw <= cw, f"horizontal scroll on {path} at {width}px: {sw} > {cw}"
        page.set_viewport_size({"width": 360, "height": 780})
        page.goto(f"{BASE}/app")
        page.get_by_role("button", name="Open menu").click()
        expect(page.get_by_role("dialog", name="Menu")).to_be_visible()
        page.get_by_role("button", name="Close menu").click()
        step("phone 360 / tablet 768 / laptop 1280: no sideways scroll on 9 pages; mobile menu works")

        # --- sign out -------------------------------------------------------------------------
        page.set_viewport_size({"width": 1280, "height": 800})
        page.goto(f"{BASE}/app")
        page.get_by_role("button", name="Sign out").click()
        expect(page).to_have_url(f"{BASE}/")
        page.goto(f"{BASE}/app")
        expect(page).to_have_url(re.compile(r"/login"))
        step("sign out clears the demo session")

        browser.close()

    for f in tmp.iterdir():
        f.unlink()
    tmp.rmdir()
    assert not errors, "browser errors:\n" + "\n".join(errors)
    step("no page errors or console errors")


if __name__ == "__main__":
    print(f"VibrantLearn smoke test against {BASE}")
    try:
        run()
    except Exception as e:  # noqa: BLE001 - report any failure as a red run
        print(f"\nFAILED after {len(passed)} passing steps: {e}")
        sys.exit(1)
    print(f"\nAll {len(passed)} steps passed.")
