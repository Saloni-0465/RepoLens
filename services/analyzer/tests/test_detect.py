from app.detectors.stack import detect
from app.parsers.extract import parse_file
from app.main import AnalyzeRequest, SourceFile, analyze


def test_package_json_react_express():
    files = [
        {
            "path": "package.json",
            "content": '{"dependencies":{"react":"18.2.0","express":"4.18.2"}}',
        }
    ]
    names = {f["name"] for f in detect(files)}
    assert "React" in names
    assert "Express" in names
    assert "Node.js" in names


def test_requirements_flask():
    files = [{"path": "requirements.txt", "content": "flask==3.0.0\npytest==8.0.0\n"}]
    names = {f["name"] for f in detect(files)}
    assert "Flask" in names
    assert "pytest" in names


def test_python_function_lines():
    src = "import os\n\ndef greet(name):\n    return name\n"
    result = parse_file("app.py", src, "python")
    fn = next(s for s in result["symbols"] if s["name"] == "greet")
    assert fn["start_line"] == 3
    assert fn["end_line"] >= 3


def test_express_route_chunk_includes_handler_body():
    src = '''import express from "express";
const app = express();
app.post("/users", async (req, res) => {
  const user = await db.user.create({ data: req.body });
  return res.status(201).json(user);
});
'''
    result = parse_file("routes.ts", src, "typescript")
    route = next(s for s in result["symbols"] if s["kind"] == "route")
    chunk = next(c for c in result["chunks"] if c["symbol_name"] == route["name"])

    assert route["name"] == "POST /users"
    assert route["start_line"] == 3
    assert route["end_line"] == 6
    assert "db.user.create" in chunk["content"]
    assert "res.status(201).json(user)" in chunk["content"]


def test_overview_prefers_repository_readme_over_nested_fixture_readme():
    result = analyze(
        AnalyzeRequest(
            files=[
                SourceFile(path="tests/data/README.md", content="# GeoIP2 Test Databases\n\nFixture information."),
                SourceFile(path="README.rst", content="Django\n======\n\nA high-level overview of the Django web framework."),
            ]
        )
    )

    excerpt = result["overview_hints"]["readme_excerpt"]
    assert "Django" in excerpt
    assert "GeoIP2" not in excerpt


