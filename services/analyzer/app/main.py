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
    readme = next((f.content for f in req.files if f.path.lower().endswith("readme.md")), None)
    excerpt = None
    if readme:
        lines = [ln for ln in readme.splitlines() if ln.strip() and not ln.strip().startswith("![")]
        excerpt = " ".join(lines[:12])[:800]
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
