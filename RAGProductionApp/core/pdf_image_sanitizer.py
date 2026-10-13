"""Fixes a real, confirmed browser-rendering bug in ingested chapter PDFs.

The source NCERT PDFs embed their photographic/illustration figures as
JPEG2000 (Filter /JPXDecode), several of them in a CMYK colorspace.
PyMuPDF (server-side) decodes these correctly, but pdf.js's JPX decoder
(used by the student-facing Chapter Reader, react-pdf) does not reliably
render them — the figure silently renders as blank space while every
other page element (text, vector art, other embedded PNGs) renders fine.
Confirmed directly against a real ingested chapter: PyMuPDF decoded the
CMYK JPX figure correctly while pdf.js showed nothing for the same image.

The fix re-encodes just those JPX images as plain JPEG (DCTDecode, which
every PDF renderer — including pdf.js — handles natively) at ingestion
time, so the PDF streamed to students never contains an image pdf.js
can't render.
"""

import logging

import fitz

logger = logging.getLogger(__name__)

# JPX re-encode quality — visually lossless for these are diagrams/photos
# meant to render at page width, and this keeps file size close to the
# original instead of ballooning it (a naive lossless re-embed ran ~5x
# larger on a real chapter PDF).
JPEG_QUALITY = 85


def sanitize_pdf_images(pdf_bytes: bytes) -> bytes:
    """Returns pdf_bytes with any JPXDecode image re-encoded as JPEG.

    Never raises — a sanitization failure falls back to the original
    bytes (the PDF still ingests and mostly renders; only in this
    unlikely-failure case would the affected figure stay blank).
    """
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        fixed = 0
        for page in doc:
            for img in page.get_images(full=True):
                xref = img[0]
                if "JPXDecode" not in doc.xref_object(xref, compressed=False):
                    continue
                pix = fitz.Pixmap(doc, xref)
                if pix.alpha:
                    pix = fitz.Pixmap(pix, 0)
                if pix.colorspace and pix.colorspace.name not in ("DeviceRGB", "DeviceGray"):
                    pix = fitz.Pixmap(fitz.csRGB, pix)
                page.replace_image(xref, stream=pix.tobytes("jpg", jpg_quality=JPEG_QUALITY))
                fixed += 1
        if fixed == 0:
            return pdf_bytes
        logger.info("sanitize_pdf_images: re-encoded %d JPX image(s)", fixed)
        return doc.tobytes()
    except Exception:
        logger.exception("sanitize_pdf_images failed — uploading original PDF unmodified")
        return pdf_bytes
