"""Upload step 3 (SECURITY.md §8): judge the actual bytes, never the name or declared type.

Pure functions, no I/O, so every rejection path is unit-tested with hostile fixtures.
"""

import io
import zipfile

from app.core.errors import ApiError

ZIP_MAX_RATIO = 10  # uncompressed total may be at most 10x the file
ZIP_MAX_TOTAL = 200 * 1024 * 1024
ZIP_MAX_ENTRIES = 2000
TEXT_EXTS = {"txt", "md", "csv", "json", "xml", "html", "css", "js", "ts", "py", "java", "c", "cpp"}

# Signatures of things that must never be accepted as notes, whatever they're called.
_EXECUTABLE = (b"MZ", b"\x7fELF", b"\xca\xfe\xba\xbe", b"\xcf\xfa\xed\xfe", b"#!")


class FileRejectedError(ApiError):
    """A file that failed verification. The message is shown on the file's row."""

    def __init__(self, message: str) -> None:
        super().__init__(422, "file_rejected", message)


def check_signature(data: bytes, ext: str) -> None:
    head = data[:16]
    if any(head.startswith(sig) for sig in _EXECUTABLE):
        raise FileRejectedError(
            "This file is a program, not notes. Only documents, text and images can be uploaded."
        )
    ok = {
        "pdf": data[:1024].find(b"%PDF-") != -1,
        "docx": head.startswith(b"PK\x03\x04"),
        "pptx": head.startswith(b"PK\x03\x04"),
        "png": head.startswith(b"\x89PNG\r\n\x1a\n"),
        "jpg": head.startswith(b"\xff\xd8\xff"),
        "jpeg": head.startswith(b"\xff\xd8\xff"),
        "webp": head[:4] == b"RIFF" and head[8:12] == b"WEBP",
    }
    if ext in TEXT_EXTS:
        if b"\x00" in data[:8192]:
            raise FileRejectedError(
                "This doesn't look like a text file. Save it as plain text and upload it again."
            )
        try:
            data.decode("utf-8-sig")
        except UnicodeDecodeError as e:
            raise FileRejectedError(
                "This text file isn't UTF-8. Save it as UTF-8 and upload it again."
            ) from e
        return
    if not ok.get(ext, False):
        raise FileRejectedError(
            f"This file's contents don't match its .{ext} name. "
            f"Open it and save it again as .{ext}."
        )


def check_zip(data: bytes, ext: str) -> zipfile.ZipFile:
    """DOCX/PPTX: zip-bomb limits from the central directory, before anything is decompressed."""
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
        infos = z.infolist()
    except (zipfile.BadZipFile, OSError) as e:
        raise FileRejectedError(f"This .{ext} file is damaged. Open it and save it again.") from e
    total = sum(i.file_size for i in infos)
    if (
        len(infos) > ZIP_MAX_ENTRIES
        or total > ZIP_MAX_TOTAL
        or total > ZIP_MAX_RATIO * max(len(data), 1)
    ):
        raise FileRejectedError(
            "This file expands to far more data than a real document. It can't be processed."
        )
    names = {i.filename for i in infos}
    want = "word/document.xml" if ext == "docx" else "ppt/presentation.xml"
    if want not in names:
        raise FileRejectedError(
            f"This isn't a real .{ext} file. Open it in Word or PowerPoint and save it again."
        )
    return z
