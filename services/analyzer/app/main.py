from __future__ import annotations

from fastapi import FastAPI
from pydantic import BaseModel, Field

from app.detectors.stack import detect
from app.parsers.extract import parse_file

app = FastAPI(title="RepoLens Analyzer")


class SourceFile(BaseModel):
    path: str
    content: str
    language: str | None = None
    role: str | None = None


class AnalyzeRequest(BaseModel):
    files: list[SourceFile] = Field(default_factory=list)


@app.get("/health")
def health() -> dict[str, str]:
    return {"ok": "true", "service": "repolens-analyzer"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    payload = [f.model_dump() for f in req.files]
    technologies = detect(payload)
    parsed = [parse_file(f.path, f.content, f.language) for f in req.files]
    readme_names = {"readme", "readme.md", "readme.rst", "readme.txt"}
    readmes = [f for f in req.files if f.path.rsplit("/", 1)[-1].lower() in readme_names]
    # Prefer the repository's own overview; test fixtures can contain unrelated READMEs.
    readmes.sort(key=lambda f: (f.path.count("/"), f.path.lower()))
    readme = readmes[0].content if readmes else None
    excerpt = None
    if readme:
        lines = []
        for line in readme.splitlines():
            value = line.strip()
            if not value or value.startswith(("![", ".. image::", ".. figure::", ".. _")):
                continue
            if set(value) <= {"=", "-", "~", "#", "*"}:
                continue
            value = value.lstrip("# ").strip() if value.startswith("#") else value
            if value:
                lines.append(value)
            if len(" ".join(lines)) >= 1200:
                break
        excerpt = " ".join(lines)[:1200] or None
    entries = [f.path for f in req.files if f.role == "entry"]
    if not entries:
        entries = [
            f.path
            for f in req.files
            if f.path.rsplit("/", 1)[-1].lower() in {"main.py", "app.py", "index.ts", "index.js", "server.js", "main.ts"}
        ]
    folders: list[str] = []
    for f in req.files:
        if "/" in f.path:
            top = f.path.split("/", 1)[0]
            if top not in folders:
                folders.append(top)
    return {
        "technologies": technologies,
        "files": parsed,
        "overview_hints": {
            "readme_excerpt": excerpt,
            "entry_points": entries[:12],
            "key_folders": folders[:16],
        },
    }
