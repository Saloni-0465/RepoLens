from app.detectors.stack import detect
from app.parsers.extract import parse_file


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
