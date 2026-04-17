"""Guards against `backend.*` imports that fail on Render's runtime.

Render runs the FastAPI app with working directory `backend/`, so imports
prefixed with `backend.` don't resolve. This test fails if any .py file
inside backend/ uses such imports.
"""
import pathlib
import re

BAD_PATTERN = re.compile(r'^\s*(from|import)\s+backend\.', re.MULTILINE)


def test_no_backend_prefixed_imports():
    backend_root = pathlib.Path(__file__).parent.parent
    offenders = []
    for py_file in backend_root.rglob("*.py"):
        if ".venv" in py_file.parts or "site-packages" in py_file.parts:
            continue
        if py_file.resolve() == pathlib.Path(__file__).resolve():
            continue
        content = py_file.read_text()
        for match in BAD_PATTERN.finditer(content):
            line_no = content[:match.start()].count("\n") + 1
            offenders.append(
                f"{py_file.relative_to(backend_root)}:{line_no} {match.group().strip()}"
            )
    assert not offenders, (
        "Found `backend.*` prefixed imports that will fail on Render runtime:\n  "
        + "\n  ".join(offenders)
    )
