from __future__ import annotations

import ast
import re
from typing import Any

Symbol = dict[str, Any]
Chunk = dict[str, Any]


def parse_file(path: str, content: str, language: str | None) -> dict[str, Any]:
    lang = language or _lang(path)
    try:
        if lang == "python":
            symbols = _python_symbols(content)
        elif lang in {"javascript", "typescript"}:
            symbols = _js_symbols(content)
        else:
            symbols = []
        status = "ok" if symbols or lang not in {"python", "javascript", "typescript"} else "ok"
        chunks = _chunks_from_symbols(content, symbols)
        if not chunks:
            chunks = _line_chunks(content)
            if lang in {"python", "javascript", "typescript"} and not symbols:
                status = "fallback"
        summary = _summarize(path, lang, symbols, content)
        return {"path": path, "summary": summary, "parse_status": status, "symbols": symbols, "chunks": chunks}
    except Exception as exc:  # noqa: BLE001 — untrusted source files
        return {
            "path": path,
            "summary": f"Parse failed; stored as line chunks ({exc.__class__.__name__}).",
            "parse_status": "failed",
            "symbols": [],
            "chunks": _line_chunks(content),
        }


def _lang(path: str) -> str | None:
    lower = path.lower()
    if lower.endswith(".py"):
        return "python"
    if lower.endswith((".ts", ".tsx")):
        return "typescript"
    if lower.endswith((".js", ".jsx", ".mjs", ".cjs")):
        return "javascript"
    return None


def _python_symbols(content: str) -> list[Symbol]:
    tree = ast.parse(content)
    symbols: list[Symbol] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            start = node.lineno
            end = getattr(node, "end_lineno", start) or start
            kind = "class" if isinstance(node, ast.ClassDef) else "function"
            symbols.append({"name": node.name, "kind": kind, "start_line": start, "end_line": end})
        elif isinstance(node, ast.Import):
            for alias in node.names:
                symbols.append(
                    {"name": alias.name, "kind": "import", "start_line": node.lineno, "end_line": node.lineno}
                )
        elif isinstance(node, ast.ImportFrom) and node.module:
            symbols.append(
                {"name": node.module, "kind": "import", "start_line": node.lineno, "end_line": node.lineno}
            )
    # Keep imports compact; prefer definitions
    defs = [s for s in symbols if s["kind"] != "import"]
    imports = [s for s in symbols if s["kind"] == "import"][:30]
    return defs + imports


def _js_symbols(content: str) -> list[Symbol]:
    symbols: list[Symbol] = []
    for m in re.finditer(r"^import\s+.+?from\s+['\"]([^'\"]+)['\"]", content, re.M):
        line = content[: m.start()].count("\n") + 1
        symbols.append({"name": m.group(1), "kind": "import", "start_line": line, "end_line": line})
    for m in re.finditer(r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)", content, re.M):
        start = content[: m.start()].count("\n") + 1
        symbols.append({"name": m.group(1), "kind": "function", "start_line": start, "end_line": _guess_end(content, start)})
    for m in re.finditer(r"^(?:export\s+)?class\s+(\w+)", content, re.M):
        start = content[: m.start()].count("\n") + 1
        symbols.append({"name": m.group(1), "kind": "class", "start_line": start, "end_line": _guess_end(content, start)})
    for m in re.finditer(
        r"^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>",
        content,
        re.M,
    ):
        start = content[: m.start()].count("\n") + 1
        symbols.append({"name": m.group(1), "kind": "function", "start_line": start, "end_line": _guess_end(content, start)})
    for m in re.finditer(r"\.(get|post|put|patch|delete|use|all)\(\s*['\"]([^'\"]+)['\"]", content):
        start = content[: m.start()].count("\n") + 1
        symbols.append({"name": f"{m.group(1).upper()} {m.group(2)}", "kind": "route", "start_line": start, "end_line": start})
    return symbols[:80]


def _guess_end(content: str, start: int) -> int:
    lines = content.splitlines()
    if start - 1 >= len(lines):
        return start
    base = len(lines[start - 1]) - len(lines[start - 1].lstrip())
    end = start
    for i in range(start, min(len(lines), start + 120)):
        line = lines[i]
        if not line.strip():
            end = i + 1
            continue
        indent = len(line) - len(line.lstrip())
        if i > start and indent <= base and line.strip() and not line.strip().startswith(("*", "//", "#")):
            if line.strip() in {"}", "};", "},"}:
                return i + 1
            if indent < base:
                return i
        end = i + 1
    return end


def _chunks_from_symbols(content: str, symbols: list[Symbol]) -> list[Chunk]:
    lines = content.splitlines()
    chunks: list[Chunk] = []
    seen: set[tuple[int, int]] = set()
    for sym in symbols:
        if sym["kind"] == "import":
            continue
        start, end = int(sym["start_line"]), int(sym["end_line"])
        start = max(1, start)
        end = min(len(lines), max(start, end))
        key = (start, end)
        if key in seen:
            continue
        seen.add(key)
        body = "\n".join(lines[start - 1 : end])
        if len(body) > 6000:
            body = body[:6000]
        chunks.append(
            {"start_line": start, "end_line": end, "symbol_name": sym["name"], "content": body}
        )
    return chunks[:40]


def _line_chunks(content: str, size: int = 40) -> list[Chunk]:
    lines = content.splitlines()
    chunks: list[Chunk] = []
    for i in range(0, len(lines), size):
        slice_ = lines[i : i + size]
        chunks.append(
            {
                "start_line": i + 1,
                "end_line": i + len(slice_),
                "symbol_name": None,
                "content": "\n".join(slice_),
            }
        )
        if len(chunks) >= 16:
            break
    return chunks


def _summarize(path: str, lang: str | None, symbols: list[Symbol], content: str) -> str:
    name = path.rsplit("/", 1)[-1]
    defs = [s for s in symbols if s["kind"] in {"function", "class", "route"}]
    imports = [s["name"] for s in symbols if s["kind"] == "import"][:8]
    bits = [f"{name}"]
    if lang:
        bits.append(lang)
    if defs:
        preview = ", ".join(f"{s['kind']} {s['name']}" for s in defs[:6])
        bits.append(preview)
    elif imports:
        bits.append("imports " + ", ".join(imports))
    else:
        first = next((ln.strip() for ln in content.splitlines() if ln.strip() and not ln.strip().startswith("#")), "")
        if first:
            bits.append(first[:120])
    return " · ".join(bits)
