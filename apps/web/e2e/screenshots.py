"""Capture the screenshots used in VibrantLearn_Features.pdf (light theme, finished animation states).

Run with the demo server up:
    uv run --no-project --with playwright python apps/web/e2e/screenshots.py
"""

import os
import re
import tempfile
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
OUT = Path(__file__).resolve().parents[3] / "docs" / "features-guide" / "screenshots"


def shot(page: Page, name: str, full: bool = False) -> None:
    page.wait_for_timeout(500)
    page.screenshot(path=str(OUT / f"{name}.jpg"), type="jpeg", quality=88, full_page=full)
    print("saved", name)


def scroll_to(page: Page, selector: str, offset: int = -80) -> None:
    page.locator(selector).first.scroll_into_view_if_needed()
    page.evaluate(f"(() => {{ document.querySelector('{selector}').scrollIntoView(); window.scrollBy(0, {offset}); }})()")


def send(page: Page, text: str) -> None:
    page.locator("textarea").fill(text)
    page.locator("textarea").press("Enter")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.jpg"):
        old.unlink()
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.environ.get("BROWSER_CHANNEL", "chrome"), headless=True)
        ctx = browser.new_context(viewport={"width": 1280, "height": 800}, color_scheme="light", reduced_motion="reduce", device_scale_factor=1.5)
        page = ctx.new_page()

        # Landing
        page.goto(BASE)
        shot(page, "01-landing-hero")
        scroll_to(page, "#how", -70)
        shot(page, "02-landing-how-it-works")
        scroll_to(page, "#get-h", -90)
        page.get_by_role("radio", name="ಕನ್ನಡ").check()
        shot(page, "03-landing-what-you-get")
        scroll_to(page, "#notes", -60)
        shot(page, "04-landing-your-notes")
        scroll_to(page, "#privacy", -60)
        shot(page, "05-landing-privacy-and-cta")

        # Sign in
        page.goto(f"{BASE}/login")
        shot(page, "06-sign-in-demo")
        page.get_by_role("button", name="Continue with the demo account").click()
        expect(page.get_by_text("Next up", exact=False)).to_be_visible()
        shot(page, "07-dashboard")

        # New session -> plan
        page.get_by_role("link", name="New study session").first.click()
        expect(page.locator("textarea")).to_be_visible()
        shot(page, "08-new-session")
        send(page, "nale DBMS test ide, normalization weak")
        expect(page.get_by_text("How many hours can you study each day?")).to_be_visible()
        shot(page, "09-follow-up-question")
        page.get_by_role("button", name="2 hours").click()
        expect(page.get_by_role("link", name="Open plan")).to_be_visible(timeout=8000)
        page.wait_for_timeout(600)
        shot(page, "10-plan-generated")

        send(page, "explain normalization in kannada")
        expect(page.get_by_text("Notes: Normal forms 1NF to BCNF")).to_be_visible(timeout=8000)
        send(page, "what can you do?")
        expect(page.get_by_text("I can plan your study hours", exact=False)).to_be_visible(timeout=8000)
        page.wait_for_timeout(800)
        shot(page, "11-chat-notes-and-help")

        # Plan view: tick + replan
        page.get_by_role("link", name="Open plan").first.click()
        expect(page.get_by_role("button", name="Replan from now")).to_be_visible()
        page.get_by_role("checkbox").first.click()
        page.get_by_role("button", name="Replan from now").click()
        expect(page.get_by_text("Replanned.", exact=False)).to_be_visible()
        shot(page, "12-plan-view")

        # Java session blocks
        page.goto(f"{BASE}/app/s/java-internal")
        notes = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Notes")))
        notes.scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -120)")
        shot(page, "13-notes-in-kannada")
        qs = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Important")))
        qs.scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -120)")
        shot(page, "14-important-questions")
        quiz = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Quiz")))
        quiz.scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -100)")
        quiz.get_by_role("button", name=re.compile("super")).click()
        shot(page, "15-quiz")
        cards = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Flashcards")))
        cards.scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -100)")
        cards.get_by_role("button", name=re.compile("Press to see the answer")).click()
        shot(page, "16-flashcards")

        # Files
        tmp = Path(tempfile.mkdtemp(prefix="vl-shots-"))
        (tmp / "Unit4_Normalization_notes.txt").write_text("1NF, 2NF, 3NF, BCNF notes", encoding="utf-8")
        (tmp / "setup.exe").write_bytes(b"MZ")
        page.goto(f"{BASE}/app/files")
        page.locator("input[type=file]").set_input_files([str(tmp / "Unit4_Normalization_notes.txt"), str(tmp / "setup.exe")])
        page.wait_for_timeout(700)
        shot(page, "17-files-uploading")
        for f in tmp.iterdir():
            f.unlink()
        tmp.rmdir()

        # Settings
        page.goto(f"{BASE}/app/settings")
        page.wait_for_timeout(900)
        shot(page, "18-settings")

        # Dark mode
        page.emulate_media(color_scheme="dark")
        page.goto(f"{BASE}/app")
        expect(page.get_by_text("Next up", exact=False)).to_be_visible()
        shot(page, "19-dashboard-dark")
        page.emulate_media(color_scheme="light")

        # Phone
        page.set_viewport_size({"width": 390, "height": 844})
        page.goto(BASE)
        shot(page, "20-phone-landing")
        page.goto(f"{BASE}/app")
        expect(page.get_by_text("Next up", exact=False)).to_be_visible()
        shot(page, "21-phone-dashboard")
        page.goto(f"{BASE}/app/s/java-internal")
        quiz = page.locator("section", has=page.get_by_role("heading", name=re.compile("^Quiz")))
        quiz.scroll_into_view_if_needed()
        page.evaluate("window.scrollBy(0, -80)")
        shot(page, "22-phone-session")
        page.get_by_role("button", name="Open menu").click()
        page.wait_for_timeout(400)
        shot(page, "23-phone-menu")

        browser.close()


if __name__ == "__main__":
    main()
