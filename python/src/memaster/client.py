import json
import os
from typing import Any, Dict, List, Mapping, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DEFAULT_BASE_URL = "https://api.memaster.cn"


class APIError(Exception):
    def __init__(self, status_code: int, message: str, response: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


class MemoryClient:
    def __init__(self, api_key: Optional[str] = None, base_url: Optional[str] = None, timeout: float = 60):
        self.api_key = api_key or os.getenv("MEMASTER_API_KEY")
        if not self.api_key:
            raise ValueError("Memaster API key not provided. Set MEMASTER_API_KEY or pass api_key.")
        self.base_url = (base_url or os.getenv("MEMASTER_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout

    def add(
        self,
        *,
        messages: List[Mapping[str, Any]],
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        metadata: Optional[Mapping[str, Any]] = None,
        infer: Optional[bool] = None,
        memory_type: Optional[str] = None,
        prompt: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload = self._compact(
            {
                "messages": list(messages),
                "user_id": user_id,
                "agent_id": agent_id,
                "run_id": run_id,
                "metadata": dict(metadata) if metadata is not None else None,
                "infer": infer,
                "memory_type": memory_type,
                "prompt": prompt,
            }
        )
        return self._request("POST", "/memories", json_body=payload)

    def search(
        self,
        *,
        query: str,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        filters: Optional[Mapping[str, Any]] = None,
        top_k: Optional[int] = None,
        threshold: Optional[float] = None,
        explain: Optional[bool] = None,
    ) -> Dict[str, Any]:
        payload = self._compact(
            {
                "query": query,
                "user_id": user_id,
                "agent_id": agent_id,
                "run_id": run_id,
                "filters": dict(filters) if filters is not None else None,
                "top_k": top_k,
                "threshold": threshold,
                "explain": explain,
            }
        )
        return self._request("POST", "/search", json_body=payload)

    def get_all(
        self,
        *,
        user_id: Optional[str] = None,
        agent_id: Optional[str] = None,
        run_id: Optional[str] = None,
        title: Optional[str] = None,
        project: Optional[str] = None,
        area: Optional[str] = None,
        service: Optional[str] = None,
        scope: Optional[str] = None,
        memory_type: Optional[str] = None,
        source: Optional[str] = None,
        tags: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        params = self._compact(
            {
                "user_id": user_id,
                "agent_id": agent_id,
                "run_id": run_id,
                "title": title,
                "project": project,
                "area": area,
                "service": service,
                "scope": scope,
                "memory_type": memory_type,
                "source": source,
            }
        )
        if tags:
            params["tags"] = ",".join(tags)
        return self._request("GET", "/memories", params=params)

    def get(self, memory_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/memories/{memory_id}")

    def update(self, memory_id: str, *, text: str, metadata: Optional[Mapping[str, Any]] = None) -> Dict[str, Any]:
        payload = self._compact({"text": text, "metadata": dict(metadata) if metadata is not None else None})
        return self._request("PUT", f"/memories/{memory_id}", json_body=payload)

    def delete(self, memory_id: str) -> Dict[str, Any]:
        return self._request("DELETE", f"/memories/{memory_id}")

    def _request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Mapping[str, Any]] = None,
        json_body: Optional[Mapping[str, Any]] = None,
    ) -> Dict[str, Any]:
        query = f"?{urlencode(params)}" if params else ""
        data = None
        headers = {"X-API-Key": self.api_key, "Accept": "application/json"}
        if json_body is not None:
            data = json.dumps(json_body).encode("utf-8")
            headers["Content-Type"] = "application/json"
        request = Request(f"{self.base_url}{path}{query}", data=data, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except HTTPError as error:
            raw = error.read().decode("utf-8")
            parsed: Any
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
            message = parsed.get("error") or parsed.get("message") or parsed.get("detail") if isinstance(parsed, dict) else raw
            raise APIError(error.code, str(message), parsed) from error
        except URLError as error:
            raise APIError(0, str(error.reason)) from error

    @staticmethod
    def _compact(data: Mapping[str, Any]) -> Dict[str, Any]:
        return {key: value for key, value in data.items() if value is not None}
