"""Render docs/features-guide/features.html to VibrantLearn_Features.pdf (folder root) with headless Chrome.

    uv run --no-project --with playwright python docs/features-guide/build_pdf.py
"""

import os
from pathlib import Path

from playwright.sync_api import sync_playwright

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "VibrantLearn_Features.pdf"

FOOTER = """
<div style="width:100%;font:8px Figtree,Segoe UI,sans-serif;color:#5E5675;padding:0 16mm;display:flex;justify-content:space-between">
  <span>VibrantLearn: Features and demo guide</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
</div>"""

with sync_playwright() as p:
    browser = p.chromium.launch(channel=os.environ.get("BROWSER_CHANNEL", "chrome"), headless=True)
    page = browser.new_page()
    page.goto((HERE / "features.html").as_uri(), wait_until="load", timeout=60_000)
    # Web fonts if online; system fonts otherwise. Never block the build on them.
    page.evaluate("Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 8000))])")
    page.pdf(
        path=str(OUT),
        format="A4",
        print_background=True,
        prefer_css_page_size=True,
        display_header_footer=True,
        header_template="<span></span>",
        footer_template=FOOTER,
    )
    browser.close()
print("wrote", OUT)
