import json
import unittest
from io import BytesIO
from unittest.mock import patch
from urllib.error import HTTPError

from memaster import APIError, MemoryClient


class FakeResponse:
    def __init__(self, body):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self):
        return json.dumps(self.body).encode("utf-8")


class MemoryClientTest(unittest.TestCase):
    def test_add_uses_api_key_header_and_payload(self):
        calls = []

        def fake_urlopen(request, timeout):
            calls.append((request, timeout))
            return FakeResponse({"results": []})

        with patch("memaster.client.urlopen", fake_urlopen):
            client = MemoryClient(api_key="m0sk_test", base_url="https://example.test/", timeout=3)
            client.add(
                user_id="user_123",
                messages=[{"role": "user", "content": "hello"}],
                metadata={"project": "demo"},
                infer=True,
            )

        request, timeout = calls[0]
        self.assertEqual(timeout, 3)
        self.assertEqual(request.full_url, "https://example.test/memories")
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(request.headers["X-api-key"], "m0sk_test")
        self.assertEqual(
            json.loads(request.data.decode("utf-8")),
            {
                "user_id": "user_123",
                "messages": [{"role": "user", "content": "hello"}],
                "metadata": {"project": "demo"},
                "infer": True,
            },
        )

    def test_search_uses_post_search(self):
        calls = []

        def fake_urlopen(request, timeout):
            calls.append(request)
            return FakeResponse({"results": [{"id": "1", "memory": "hello"}]})

        with patch("memaster.client.urlopen", fake_urlopen):
            client = MemoryClient(api_key="m0sk_test", base_url="https://example.test")
            result = client.search(query="hello", user_id="user_123", top_k=5)

        self.assertEqual(calls[0].full_url, "https://example.test/search")
        self.assertEqual(json.loads(calls[0].data.decode("utf-8"))["top_k"], 5)
        self.assertEqual(result["results"][0]["memory"], "hello")

    def test_http_error_raises_api_error(self):
        def fake_urlopen(request, timeout):
            body = BytesIO(json.dumps({"error": "bad"}).encode("utf-8"))
            raise HTTPError(request.full_url, 400, "Bad Request", {}, body)

        with patch("memaster.client.urlopen", fake_urlopen):
            client = MemoryClient(api_key="m0sk_test")
            with self.assertRaises(APIError):
                client.get("missing")


if __name__ == "__main__":
    unittest.main()
