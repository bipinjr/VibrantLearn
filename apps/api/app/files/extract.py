"""Upload step 4: text out of verified bytes, with hard caps. Never executes or renders anything.

- PDF: pypdf (pure Python, no JavaScript), at most 500 pages and 2 M characters.
- DOCX/PPTX: our own reader over zipfile + defusedxml (no DTDs, no external entities). python-docx
  and python-pptx were dropped because they parse with lxml, which defusedxml does not protect.
- Text and code: decoded as UTF-8; XML/HTML/JSON are treated as text and never parsed.
- Images: the browser does OCR (Tesseract.js) and sends the text; the server never decodes images.
"""

import io
import re
import zipfile
from dataclasses import dataclass
from xml.etree.ElementTree import Element

from defusedxml import ElementTree as SafeET
from defusedxml.common import DefusedXmlException
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from app.files.verify import TEXT_EXTS, FileRejectedError, check_zip

MAX_PAGES = 500
MAX_CHARS = 2_000_000
_W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
_A = "{http://schemas.openxmlformats.org/drawingml/2006/main}"


@dataclass
class Extracted:
    pages: list[str]  # text per page (or slide); one entry for files without pages

    @property
    def count(self) -> int:
        return len(self.pages)


def _xml(z: zipfile.ZipFile, name: str) -> Element:
    try:
        root: Element = SafeET.fromstring(z.read(name))
    except DefusedXmlException as e:
        raise FileRejectedError(
            "This file contains unsafe XML (external entities or DTDs). It can't be processed."
        ) from e
    except SafeET.ParseError as e:
        raise FileRejectedError("This file is damaged. Open it and save it again.") from e
    return root


def _docx(data: bytes) -> list[str]:
    root = _xml(check_zip(data, "docx"), "word/document.xml")
    paras = ["".join(t.text or "" for t in p.iter(f"{_W}t")) for p in root.iter(f"{_W}p")]
    return ["\n".join(x for x in paras if x.strip())]


def _pptx(data: bytes) -> list[str]:
    z = check_zip(data, "pptx")
    slides = sorted(
        (n for n in z.namelist() if re.fullmatch(r"ppt/slides/slide\d+\.xml", n)),
        key=lambda n: int(re.findall(r"\d+", n)[-1]),
    )[:MAX_PAGES]
    out = []
    for name in slides:
        root = _xml(z, name)
        paras = ["".join(t.text or "" for t in p.iter(f"{_A}t")) for p in root.iter(f"{_A}p")]
        out.append("\n".join(x for x in paras if x.strip()))
    return out


def _pdf(data: bytes) -> list[str]:
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            raise FileRejectedError(
                "This PDF is password-protected. Save an unlocked copy and upload that."
            )
        pages, total = [], 0
        for page in reader.pages[:MAX_PAGES]:
            text = page.extract_text() or ""
            total += len(text)
            pages.append(text)
            if total > MAX_CHARS:
                break
    except (PdfReadError, ValueError, KeyError, TypeError) as e:
        raise FileRejectedError(
            "This PDF is damaged. Open it and save (or print) it as a new PDF."
        ) from e
    if not any(p.strip() for p in pages):
        raise FileRejectedError(
            "This PDF has no text, probably a scan. "
            "Upload photos of the pages instead so we can read them."
        )
    return pages


def extract(data: bytes, ext: str, ocr_text: str | None = None) -> Extracted:
    if ext == "pdf":
        pages = _pdf(data)
    elif ext == "docx":
        pages = _docx(data)
    elif ext == "pptx":
        pages = _pptx(data)
    elif ext in TEXT_EXTS:
        pages = [data.decode("utf-8-sig", errors="replace")]
    else:  # image: text comes from OCR in the browser, or there is none to search
        pages = [ocr_text or ""]
    out, total = [], 0
    for p in pages:
        p = p[: max(0, MAX_CHARS - total)]
        total += len(p)
        out.append(p)
    return Extracted(out)


def chunks(doc: Extracted, size: int = 800, overlap: int = 120) -> list[tuple[int, str]]:
    """(page, text) pieces of about `size` characters, cut at whitespace, overlapping a little
    so an answer that straddles a cut is still found."""
    out: list[tuple[int, str]] = []
    for page_no, text in enumerate(doc.pages, start=1):
        text = re.sub(r"[ \t]+", " ", text).strip()
        start = 0
        while start < len(text):
            end = min(len(text), start + size)
            if end < len(text):
                cut = text.rfind(" ", start + size // 2, end)
                end = cut if cut != -1 else end
            piece = text[start:end].strip()
            if piece:
                out.append((page_no, piece))
            if end >= len(text):
                break
            start = max(end - overlap, start + 1)
    return out
