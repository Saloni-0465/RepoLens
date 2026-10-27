from __future__ import annotations

import json
import re
from typing import Any

Finding = dict[str, str]


def _finding(name: str, category: str, path: str, detail: str, confidence: str = "high") -> Finding:
    return {
        "name": name,
        "category": category,
        "evidence_file": path,
        "evidence_detail": detail,
        "confidence": confidence,
    }


KNOWN_JS = {
    "react": ("ui", "React"),
    "react-dom": ("ui", "React DOM"),
    "next": ("framework", "Next.js"),
    "vue": ("ui", "Vue"),
    "nuxt": ("framework", "Nuxt"),
    "svelte": ("ui", "Svelte"),
    "express": ("framework", "Express"),
    "fastify": ("framework", "Fastify"),
    "koa": ("framework", "Koa"),
    "hono": ("framework", "Hono"),
    "vite": ("tooling", "Vite"),
    "webpack": ("tooling", "webpack"),
    "typescript": ("language", "TypeScript"),
    "prisma": ("data", "Prisma"),
    "mongoose": ("data", "Mongoose"),
    "sequelize": ("data", "Sequelize"),
    "typeorm": ("data", "TypeORM"),
    "pg": ("data", "PostgreSQL client"),
    "sqlite3": ("data", "SQLite"),
    "tailwindcss": ("ui", "Tailwind CSS"),
    "jest": ("testing", "Jest"),
    "vitest": ("testing", "Vitest"),
    "playwright": ("testing", "Playwright"),
    "redux": ("state", "Redux"),
    "zod": ("validation", "Zod"),
    "axios": ("http", "Axios"),
    "socket.io": ("realtime", "Socket.IO"),
    "graphql": ("api", "GraphQL"),
    "@nestjs/core": ("framework", "NestJS"),
    "electron": ("runtime", "Electron"),
}

KNOWN_PY = {
    "django": ("framework", "Django"),
    "flask": ("framework", "Flask"),
    "fastapi": ("framework", "FastAPI"),
    "starlette": ("framework", "Starlette"),
    "tornado": ("framework", "Tornado"),
    "celery": ("jobs", "Celery"),
    "sqlalchemy": ("data", "SQLAlchemy"),
    "alembic": ("data", "Alembic"),
    "psycopg2": ("data", "psycopg2"),
    "psycopg": ("data", "psycopg"),
    "pymongo": ("data", "PyMongo"),
    "redis": ("data", "Redis"),
    "pandas": ("data", "pandas"),
    "numpy": ("data", "NumPy"),
    "pytest": ("testing", "pytest"),
    "uvicorn": ("runtime", "Uvicorn"),
    "gunicorn": ("runtime", "Gunicorn"),
    "pydantic": ("validation", "Pydantic"),
    "requests": ("http", "Requests"),
    "httpx": ("http", "HTTPX"),
    "beautifulsoup4": ("parsing", "BeautifulSoup"),
    "scrapy": ("framework", "Scrapy"),
    "torch": ("ml", "PyTorch"),
    "tensorflow": ("ml", "TensorFlow"),
    "langchain": ("ml", "LangChain"),
}


def detect(files: list[dict[str, Any]]) -> list[Finding]:
    findings: list[Finding] = []
    for f in files:
        path = f.get("path") or ""
        content = f.get("content") or ""
        name = path.rsplit("/", 1)[-1].lower()
        if name == "package.json":
            findings.extend(_from_package_json(path, content))
        elif name == "requirements.txt":
            findings.extend(_from_requirements(path, content))
        elif name == "pyproject.toml":
            findings.extend(_from_pyproject(path, content))
        elif name == "pipfile":
            findings.extend(_from_pipfile(path, content))
        elif name == "dockerfile":
            findings.extend(_from_dockerfile(path, content))
        elif name in {"docker-compose.yml", "docker-compose.yaml", "compose.yaml", "compose.yml"}:
            findings.append(_finding("Docker Compose", "infra", path, "Compose file present"))
        elif name == "tsconfig.json":
            findings.append(_finding("TypeScript", "language", path, "tsconfig.json present"))
        elif name == "go.mod":
            findings.append(_finding("Go", "language", path, "go.mod present", "medium"))
        elif name == "cargo.toml":
            findings.append(_finding("Rust", "language", path, "Cargo.toml present", "medium"))
        elif name == "pom.xml":
            findings.append(_finding("Maven", "tooling", path, "pom.xml present", "medium"))
        elif name == "gemfile":
            findings.append(_finding("Ruby", "language", path, "Gemfile present", "medium"))
    return _dedupe(findings)


def _from_package_json(path: str, content: str) -> list[Finding]:
    out: list[Finding] = []
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        return [_finding("Node.js", "runtime", path, "package.json present (unparseable JSON)", "medium")]
    out.append(_finding("Node.js", "runtime", path, "package.json present"))
    deps = {}
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        if isinstance(data.get(key), dict):
            deps.update(data[key])
    for dep, meta in KNOWN_JS.items():
        if dep in deps:
            category, label = meta
            version = str(deps[dep])
            out.append(_finding(label, category, path, f"{dep}: {version}"))
    engines = data.get("engines") if isinstance(data.get("engines"), dict) else {}
    if engines.get("node"):
        out.append(_finding("Node.js engine", "runtime", path, f"engines.node: {engines['node']}"))
    scripts = data.get("scripts") if isinstance(data.get("scripts"), dict) else {}
    if "next" in " ".join(str(v) for v in scripts.values()):
        out.append(_finding("Next.js", "framework", path, "next script in package.json", "medium"))
    return out


def _from_requirements(path: str, content: str) -> list[Finding]:
    out = [_finding("Python", "language", path, "requirements.txt present")]
    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        pkg = re.split(r"[=<>~\[]", line, maxsplit=1)[0].strip().lower()
        if pkg in KNOWN_PY:
            category, label = KNOWN_PY[pkg]
            out.append(_finding(label, category, path, line.strip()))
    return out


def _from_pyproject(path: str, content: str) -> list[Finding]:
    out = [_finding("Python", "language", path, "pyproject.toml present")]
    if re.search(r"\[tool\.poetry\]", content):
        out.append(_finding("Poetry", "tooling", path, "[tool.poetry] table"))
    if re.search(r"\[tool\.hatch", content):
        out.append(_finding("Hatch", "tooling", path, "[tool.hatch] table", "medium"))
    lower_content = content.lower()
    for pkg, meta in KNOWN_PY.items():
        if re.search(rf"[\"']{re.escape(pkg)}[\"']|{re.escape(pkg)}\s*[=<>]", lower_content):
            category, label = meta
            out.append(_finding(label, category, path, f"{pkg} declared in pyproject.toml"))
    return out


def _from_pipfile(path: str, content: str) -> list[Finding]:
    out = [_finding("Pipenv", "tooling", path, "Pipfile present")]
    for pkg, meta in KNOWN_PY.items():
        if re.search(rf"^{re.escape(pkg)}\s*=", content, re.I | re.M):
            category, label = meta
            out.append(_finding(label, category, path, f"{pkg} in Pipfile"))
    return out


def _from_dockerfile(path: str, content: str) -> list[Finding]:
    out = [_finding("Docker", "infra", path, "Dockerfile present")]
    first = next((ln for ln in content.splitlines() if ln.strip().upper().startswith("FROM ")), "")
    if first:
        out.append(_finding("Base image", "infra", path, first.strip(), "medium"))
    return out


def _dedupe(findings: list[Finding]) -> list[Finding]:
    seen: set[tuple[str, str]] = set()
    unique: list[Finding] = []
    for f in findings:
        key = (f["name"], f["evidence_file"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(f)
    return unique
