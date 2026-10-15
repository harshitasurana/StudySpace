from pathlib import Path
import shutil


PROJECT_ROOT = Path(__file__).resolve().parent.parent
KNOWLEDGE_BASE = PROJECT_ROOT / "knowledge_base"
LFS_OBJECTS = PROJECT_ROOT / ".git" / "lfs" / "objects"


def get_lfs_oid(file_path: Path) -> str | None:
    """
    Return the SHA-256 OID if the file is a Git LFS pointer.
    Otherwise return None.
    """
    try:
        content = file_path.read_text(
            encoding="utf-8",
            errors="strict",
        )
    except (UnicodeDecodeError, OSError):
        return None

    if not content.startswith(
        "version https://git-lfs.github.com/spec/v1"
    ):
        return None

    for line in content.splitlines():
        if line.startswith("oid sha256:"):
            return line.replace("oid sha256:", "").strip()

    return None


def find_lfs_object(oid: str) -> Path | None:
    """
    Git LFS stores objects as:

    .git/lfs/objects/
        first-2-chars/
        next-2-chars/
        full-oid
    """
    object_path = (
        LFS_OBJECTS
        / oid[:2]
        / oid[2:4]
        / oid
    )

    if object_path.exists():
        return object_path

    return None


def restore_all_pdfs():
    restored = 0
    skipped = 0
    missing = 0

    pdf_files = list(
        KNOWLEDGE_BASE.rglob("*.pdf")
    )

    print(
        f"📚 Found {len(pdf_files)} PDF files"
    )

    for pdf_path in pdf_files:

        relative_path = pdf_path.relative_to(
            PROJECT_ROOT
        )

        oid = get_lfs_oid(pdf_path)

        # Already a real PDF
        if oid is None:
            print(
                f"✅ Already valid/non-pointer: "
                f"{relative_path}"
            )
            skipped += 1
            continue

        print(
            f"\n🔎 LFS pointer found: "
            f"{relative_path}"
        )

        print(
            f"   OID: {oid}"
        )

        lfs_object = find_lfs_object(oid)

        if lfs_object is None:
            print(
                "   ❌ LFS object missing locally"
            )
            missing += 1
            continue

        # Safety check:
        # Ensure cached object looks like a PDF
        try:
            with lfs_object.open("rb") as file:
                header = file.read(5)
        except OSError as exc:
            print(
                f"   ❌ Cannot read LFS object: {exc}"
            )
            missing += 1
            continue

        if header != b"%PDF-":
            print(
                f"   ❌ Cached object is not a PDF "
                f"(header={header!r})"
            )
            missing += 1
            continue

        shutil.copy2(
            lfs_object,
            pdf_path,
        )

        print(
            f"   ✅ Restored "
            f"({pdf_path.stat().st_size} bytes)"
        )

        restored += 1

    print("\n" + "=" * 50)

    print(
        f"✅ Restored: {restored}"
    )

    print(
        f"⏭️ Already real/non-pointer: {skipped}"
    )

    print(
        f"❌ Missing LFS objects: {missing}"
    )

    print("=" * 50)


if __name__ == "__main__":
    restore_all_pdfs()

