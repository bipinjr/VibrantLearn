"""C2/C3: uploaded bytes are verified before anything trusts them, then extracted and indexed.

Hostile fixtures (TESTING.md §2.4) are built here in code, so nothing dangerous is committed.
"""

import io
import uuid
import zipfile
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.core.db import get_conn
from app.core.storage import get_storage
from app.files.extract import Extracted, chunks
from app.main import app
from tests.conftest import make_token
from tests.fake_db import FakeDb
from tests.fakes import FakeStorage

A, B = str(uuid.uuid4()), str(uuid.uuid4())
SA = str(uuid.uuid4())
MB = 1024 * 1024


# ---- fixtures ------------------------------------------------------------------------------------


def pdf(pages: list[str], pad_bytes: int = 0) -> bytes:
    """A real, minimal PDF: one line of text per page, optionally padded with an unused stream."""
    objs: list[bytes] = []
    kids = " ".join(f"{4 + 2 * i} 0 R" for i in range(len(pages)))
    objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {len(pages)} >>".encode())
    objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    for i, text in enumerate(pages):
        content = f"BT /F1 12 Tf 72 720 Td ({text}) Tj ET".encode()
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {5 + 2 * i} 0 R "
            "/Resources << /Font << /F1 3 0 R >> >> >>".encode()
        )
        objs.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
    if pad_bytes:
        objs.append(b"<< /Length %d >>\nstream\n" % pad_bytes + b"0" * pad_bytes + b"\nendstream")
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % n + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return bytes(out)


def docx(document_xml: bytes, extra: dict[str, bytes] | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", "<Types/>")
        z.writestr("word/document.xml", document_xml)
        for k, v in (extra or {}).items():
            z.writestr(k, v)
    return buf.getvalue()


W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
GOOD_DOCX = docx(
    f"<w:document {W}><w:body>"
    "<w:p><w:r><w:t>Method overriding happens at runtime.</w:t></w:r></w:p>"
    f"<w:p><w:r><w:t>super calls the parent.</w:t></w:r></w:p></w:body></w:document>".encode()
)
XXE_DOCX = docx(
    b'<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]>'
    + f"<w:document {W}><w:body><w:p><w:r><w:t>&x;</w:t></w:r></w:p></w:body></w:document>".encode()
)
ZIP_BOMB = docx(f"<w:document {W}/>".encode(), {"word/media/fill.bin": b"\0" * (60 * MB)})


@pytest.fixture
def env() -> Iterator[tuple[TestClient, FakeDb, FakeStorage]]:
    db, storage = FakeDb({}), FakeStorage()
    db.state["sessions"] = {SA: {"user_id": A}}
    app.dependency_overrides[get_conn] = lambda: db
    app.dependency_overrides[get_storage] = lambda: storage
    yield TestClient(app), db, storage
    app.dependency_overrides.clear()


def upload(
    client: TestClient, storage: FakeStorage, name: str, data: bytes, uid: str = A
) -> dict[str, Any]:
    h = {"Authorization": f"Bearer {make_token(uid)}"}
    r = client.post(
        f"/api/v1/sessions/{SA}/files/upload-url",
        json={"name": name, "size_bytes": len(data)},
        headers=h,
    )
    assert r.status_code == 201, r.text
    body = r.json()
    storage.objects[body["path"]] = data  # what the browser's PUT would store
    p = client.post(f"/api/v1/files/{body['file_id']}/process", headers=h)
    assert p.status_code == 200, p.text
    return {**body, **p.json()}


# ---- must be rejected ------------------------------------------------------------------------


def test_renamed_exe_is_rejected_on_its_bytes(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, db, storage = env
    out = upload(client, storage, "notes.pdf", b"MZ\x90\x00" + b"\0" * 2000)
    assert out["status"] == "failed" and "program" in out["error"]
    assert out["path"] not in storage.objects  # deleted at once
    assert db.state["audit"][-1]["action"] == "upload_rejected"


def test_zip_bomb_docx_is_rejected_before_decompressing(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, _, storage = env
    out = upload(client, storage, "unit2.docx", ZIP_BOMB)
    assert out["status"] == "failed" and "expands" in out["error"]


def test_xxe_docx_is_refused_and_nothing_is_fetched(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, db, storage = env
    out = upload(client, storage, "unit3.docx", XXE_DOCX)
    assert out["status"] == "failed" and "unsafe XML" in out["error"]
    assert db.state["chunks"] == []


def test_xxe_xml_file_is_stored_as_inert_text(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, db, storage = env
    data = b'<?xml version="1.0"?><!DOCTYPE d [<!ENTITY x SYSTEM "file:///etc/passwd">]><d>&x;</d>'
    out = upload(client, storage, "data.xml", data)
    assert out["status"] == "ready"
    assert "&x;" in db.state["chunks"][0]["content"]  # never parsed, never resolved
    assert "root:" not in db.state["chunks"][0]["content"]


@pytest.mark.parametrize(
    ("name", "data"), [("notes.txt", b"hello\x00world"), ("notes.md", "नमस्ते".encode("utf-16"))]
)
def test_text_that_isnt_text_is_rejected(
    env: tuple[TestClient, FakeDb, FakeStorage], name: str, data: bytes
) -> None:
    client, _, storage = env
    assert upload(client, storage, name, data)["status"] == "failed"


def test_png_named_pdf_is_rejected(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, _, storage = env
    out = upload(client, storage, "unit1.pdf", b"\x89PNG\r\n\x1a\n" + b"\0" * 100)
    assert out["status"] == "failed" and "don't match" in out["error"]


def test_a_file_bigger_than_declared_is_rejected(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, _, storage = env
    h = {"Authorization": f"Bearer {make_token(A)}"}
    body = client.post(
        f"/api/v1/sessions/{SA}/files/upload-url",
        json={"name": "a.txt", "size_bytes": 5},
        headers=h,
    ).json()
    storage.objects[body["path"]] = b"much more than five bytes"
    out = client.post(f"/api/v1/files/{body['file_id']}/process", headers=h).json()
    assert out["status"] == "failed"


# ---- must work -----------------------------------------------------------------------------------


def test_20_page_pdf_is_chunked_with_page_numbers(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, db, storage = env
    out = upload(
        client,
        storage,
        "Unit3_Inheritance.pdf",
        pdf([f"Page {i} covers topic {i}" for i in range(1, 21)]),
    )
    assert out["status"] == "ready" and out["pages"] == 20
    pages = {c["page"] for c in db.state["chunks"]}
    assert pages == set(range(1, 21))
    row = db.state["files"][0]
    assert len(row["sha256"]) == 64 and row["status"] == "ready"


def test_49_mb_pdf_processes(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, _, storage = env
    big = pdf(["Exception handling: try, catch, finally"], pad_bytes=49 * MB - 2000)
    assert 48 * MB < len(big) <= 49 * MB
    out = upload(client, storage, "big_notes.pdf", big)
    assert out["status"] == "ready" and out["chunks"] >= 1


def test_docx_text_is_extracted(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, db, storage = env
    assert upload(client, storage, "unit3.docx", GOOD_DOCX)["status"] == "ready"
    assert "Method overriding happens at runtime." in db.state["chunks"][0]["content"]


def test_the_same_file_twice_reuses_the_first(env: tuple[TestClient, FakeDb, FakeStorage]) -> None:
    client, db, storage = env
    first = upload(client, storage, "notes.md", b"# Stacks\nLIFO order")
    second = upload(client, storage, "notes-copy.md", b"# Stacks\nLIFO order")
    assert second["duplicate"] is True and second["file_id"] == first["file_id"]
    assert len(db.state["files"]) == 1 and second["path"] not in storage.objects


def test_another_student_cannot_process_or_download_my_file(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, _, storage = env
    mine = upload(client, storage, "notes.md", b"mine")
    hb = {"Authorization": f"Bearer {make_token(B)}"}
    assert client.post(f"/api/v1/files/{mine['file_id']}/process", headers=hb).status_code == 404
    assert (
        client.get(f"/api/v1/files/{mine['file_id']}/download-url", headers=hb).status_code == 404
    )
    assert client.delete(f"/api/v1/files/{mine['file_id']}", headers=hb).status_code == 404


def test_download_link_is_short_lived_and_an_attachment(
    env: tuple[TestClient, FakeDb, FakeStorage],
) -> None:
    client, _, storage = env
    mine = upload(client, storage, "notes.html", b"<script>alert(1)</script>")
    r = client.get(
        f"/api/v1/files/{mine['file_id']}/download-url",
        headers={"Authorization": f"Bearer {make_token(A)}"},
    )
    assert r.json()["expires_in"] == 300 and "download=notes.html" in r.json()["url"]


def test_chunks_overlap_and_cut_at_spaces() -> None:
    words = " ".join(f"word{i}" for i in range(400))
    pieces = chunks(Extracted([words]))
    assert len(pieces) > 2
    assert all(len(t) <= 800 for _, t in pieces)
    assert all(not t.startswith("ord") for _, t in pieces)  # never split mid-word
    assert pieces[0][1].split()[-1] in pieces[1][1]  # overlap carries context across the cut
