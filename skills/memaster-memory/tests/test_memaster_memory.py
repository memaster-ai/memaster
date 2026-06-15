import importlib.util
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "memaster_memory.py"
spec = importlib.util.spec_from_file_location("memaster_memory", SCRIPT)
memaster_memory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(memaster_memory)


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.body).encode("utf-8")


class MemasterMemoryScriptTest(unittest.TestCase):
    def test_doctor_does_not_require_api_key(self):
        parser = memaster_memory.build_parser()
        args = parser.parse_args(["doctor"])
        with patch.dict(os.environ, {}, clear=True):
            args.func(args)

    def test_add_builds_expected_payload(self):
        calls = []

        def fake_urlopen(request, timeout):
            calls.append((request, timeout))
            return FakeResponse({"results": []})

        parser = memaster_memory.build_parser()
        args = parser.parse_args([
            "add",
            "--user-id", "alice",
            "--agent-id", "skills",
            "--project", "Memaster",
            "--area", "docs",
            "--title", "Package manager",
            "--content", "This project uses pnpm.",
            "--memory-type", "project_info",
            "--tags", "项目,规范",
        ])

        with patch.dict(os.environ, {"MEMASTER_API_KEY": "m0sk_test"}, clear=True):
            with patch.object(memaster_memory.urllib.request, "urlopen", fake_urlopen):
                args.func(args)

        request, timeout = calls[0]
        self.assertEqual(timeout, 20)
        self.assertEqual(request.full_url, "https://api.memaster.cn/memories")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["X-api-key"], "m0sk_test")
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["user_id"], "alice")
        self.assertEqual(payload["agent_id"], "skills")
        self.assertEqual(payload["metadata"]["project"], "Memaster")
        self.assertEqual(payload["metadata"]["area"], "docs")
        self.assertEqual(payload["metadata"]["tags"], ["项目", "规范"])

    def test_add_uses_infer_and_timeout_env(self):
        calls = []

        def fake_urlopen(request, timeout):
            calls.append((request, timeout))
            return FakeResponse({"results": []})

        with patch.dict(os.environ, {"MEMASTER_API_KEY": "m0sk_test", "MEMASTER_INFER": "true", "MEMASTER_TIMEOUT_SECONDS": "120"}, clear=True):
            parser = memaster_memory.build_parser()
            args = parser.parse_args([
                "add",
                "--user-id", "alice",
                "--agent-id", "skills",
                "--project", "Memaster",
                "--area", "docs",
                "--title", "Infer test",
                "--content", "Use infer.",
            ])
            with patch.object(memaster_memory.urllib.request, "urlopen", fake_urlopen):
                args.func(args)

        request, timeout = calls[0]
        self.assertEqual(timeout, 120)
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(payload["infer"], True)

    def test_delete_requires_yes(self):
        parser = memaster_memory.build_parser()
        args = parser.parse_args(["delete", "--memory-id", "abc"])
        with self.assertRaises(SystemExit):
            args.func(args)


if __name__ == "__main__":
    unittest.main()
