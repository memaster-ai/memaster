#!/usr/bin/env python3
"""Memaster memory helper for AI editor Skills.

Loads config from ``<skill_dir>/.env.local`` and process environment.

Environment:
  MEMASTER_BASE_URL  default: https://api.memaster.cn
  MEMASTER_API_KEY   required for network commands
  MEMASTER_USER_ID   optional; not applied by default, pass --user-id when needed
  MEMASTER_AGENT_ID  optional default agent scope
  MEMASTER_SOURCE    optional metadata.source and filter source
  MEMASTER_SERVICE   default: Memaster
  MEMASTER_PROJECT   optional default metadata/filter project
  MEMASTER_AREA      optional default metadata/filter area
  MEMASTER_SCOPE     optional default metadata/filter scope
  MEMASTER_INFER     optional true/false; add sends infer=true when enabled
  MEMASTER_TIMEOUT_SECONDS optional request timeout, default 20
  MEMASTER_TOP_K     optional default search top_k, default 5
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

DEFAULT_BASE_URL = "https://api.memaster.cn"
DEFAULT_AGENT_ID = ""
DEFAULT_SERVICE = "Memaster"
REQUIRED_STRUCTURED_METADATA = ("project", "area")
SKILL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ENV_LOCAL_PATH = os.path.join(SKILL_DIR, ".env.local")


def load_env_local(path: str = ENV_LOCAL_PATH) -> None:
    if not os.path.exists(path):
        return
    with open(path, "r", encoding="utf-8") as file:
        for raw_line in file:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_env_local()


def env(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    value = env(name)
    if not value:
        return default
    return value.lower() in {"1", "true", "yes", "y", "on"}


def env_int(name: str, default: int) -> int:
    value = env(name)
    if not value:
        return default
    try:
        parsed = int(value)
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def base_url() -> str:
    return env("MEMASTER_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def api_key() -> str:
    value = env("MEMASTER_API_KEY")
    if not value:
        raise SystemExit("MEMASTER_API_KEY is required. Set it in .env.local or process environment.")
    return value


def request_json(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
    url = f"{base_url()}{path}"
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    req.add_header("X-API-Key", api_key())
    if body is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=env_int("MEMASTER_TIMEOUT_SECONDS", 20)) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise SystemExit(f"HTTP {exc.code}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"Request failed: {exc}") from exc


def print_json(data: Any) -> None:
    print(json.dumps(data, ensure_ascii=False, indent=2))


def load_metadata(raw: str) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        metadata = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid JSON: {exc}") from exc
    if not isinstance(metadata, dict):
        raise SystemExit("Invalid JSON: expected an object")
    return metadata


def parse_tags(raw: str) -> list[str]:
    return [tag.strip() for tag in raw.split(",") if tag.strip()]


def apply_structured_metadata(metadata: dict[str, Any], args: argparse.Namespace) -> None:
    for key in ("project", "area", "scope", "service"):
        value = getattr(args, key, "")
        if isinstance(value, str) and value.strip():
            metadata[key] = value.strip()


def require_structured_metadata(metadata: dict[str, Any]) -> None:
    missing = [key for key in REQUIRED_STRUCTURED_METADATA if not str(metadata.get(key, "")).strip()]
    if missing:
        fields = ", ".join(missing)
        raise SystemExit(
            f"Missing required metadata field(s): {fields}. "
            "Pass --project/--area or set MEMASTER_PROJECT/MEMASTER_AREA."
        )


def build_scope_body(args: argparse.Namespace) -> dict[str, Any]:
    body: dict[str, Any] = {}
    if getattr(args, "user_id", ""):
        body["user_id"] = args.user_id
    if getattr(args, "agent_id", ""):
        body["agent_id"] = args.agent_id
    if getattr(args, "run_id", ""):
        body["run_id"] = args.run_id
    return body


def source_metadata() -> dict[str, Any]:
    value = env("MEMASTER_SOURCE")
    return {"source": value} if value else {}


def default_filters(args: argparse.Namespace) -> dict[str, Any]:
    filters: dict[str, Any] = {}
    for key in ("project", "area", "scope", "source", "memory_type"):
        value = getattr(args, key, "")
        if isinstance(value, str) and value.strip():
            filters[key] = value.strip()
    if getattr(args, "tags", ""):
        filters["tags"] = parse_tags(args.tags)
    extra = load_metadata(getattr(args, "filters", ""))
    filters.update({key: value for key, value in extra.items() if value not in (None, "")})
    return filters


def cmd_doctor(args: argparse.Namespace) -> None:
    status = {
        "skill_dir": SKILL_DIR,
        "env_local_exists": os.path.exists(ENV_LOCAL_PATH),
        "base_url": base_url(),
        "has_api_key": bool(env("MEMASTER_API_KEY")),
        "env_user_id_configured": bool(env("MEMASTER_USER_ID")),
        "user_id_arg": bool(args.user_id),
        "agent_id": bool(args.agent_id),
        "project": args.project,
        "area": args.area,
        "source": args.source,
        "infer": env_bool("MEMASTER_INFER"),
        "timeout_seconds": env_int("MEMASTER_TIMEOUT_SECONDS", 20),
    }
    print_json(status)


def cmd_search(args: argparse.Namespace) -> None:
    body: dict[str, Any] = {"query": args.query, "top_k": args.top_k}
    body.update(build_scope_body(args))
    filters = default_filters(args)
    if filters:
        body["filters"] = filters
    print_json(request_json("POST", "/search", body))


def cmd_add(args: argparse.Namespace) -> None:
    metadata: dict[str, Any] = {
        "title": args.title,
        "memory_type": args.memory_type,
        "service": args.service,
    }
    metadata.update(source_metadata())
    metadata.update(load_metadata(args.metadata))
    apply_structured_metadata(metadata, args)
    require_structured_metadata(metadata)
    if args.tags:
        metadata["tags"] = parse_tags(args.tags)
    body: dict[str, Any] = {
        "messages": [{"role": "user", "content": args.content}],
        "metadata": metadata,
    }
    if args.infer:
        body["infer"] = True
    body.update(build_scope_body(args))
    print_json(request_json("POST", "/memories", body))


def cmd_list(args: argparse.Namespace) -> None:
    params = build_scope_body(args)
    for key in ("project", "area", "scope", "source", "memory_type"):
        value = getattr(args, key, "")
        if isinstance(value, str) and value.strip():
            params[key] = value.strip()
    if args.tags:
        params["tags"] = ",".join(parse_tags(args.tags))
    query = urllib.parse.urlencode({key: value for key, value in params.items() if value})
    path = f"/memories?{query}" if query else "/memories"
    print_json(request_json("GET", path))


def cmd_get(args: argparse.Namespace) -> None:
    print_json(request_json("GET", f"/memories/{args.memory_id}"))


def cmd_update(args: argparse.Namespace) -> None:
    metadata: dict[str, Any] = {"service": args.service}
    metadata.update(source_metadata())
    if args.memory_type:
        metadata["memory_type"] = args.memory_type
    metadata.update(load_metadata(args.metadata))
    apply_structured_metadata(metadata, args)
    require_structured_metadata(metadata)
    if args.tags:
        metadata["tags"] = parse_tags(args.tags)
    print_json(request_json("PUT", f"/memories/{args.memory_id}", {"text": args.content, "metadata": metadata}))


def cmd_delete(args: argparse.Namespace) -> None:
    if not args.yes:
        raise SystemExit("Delete is destructive. Re-run with --yes to confirm.")
    print_json(request_json("DELETE", f"/memories/{args.memory_id}"))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Memaster memory helper for AI editor Skills")
    subparsers = parser.add_subparsers(dest="command", required=True)

    def add_scope(p: argparse.ArgumentParser) -> None:
        p.add_argument("--user-id", default="", help="Optional terminal user filter. Not read from MEMASTER_USER_ID by default.")
        p.add_argument("--agent-id", default=env("MEMASTER_AGENT_ID", DEFAULT_AGENT_ID))
        p.add_argument("--run-id", default="")

    def add_filter_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--project", default=env("MEMASTER_PROJECT", ""))
        p.add_argument("--area", default=env("MEMASTER_AREA", ""))
        p.add_argument("--scope", default=env("MEMASTER_SCOPE", ""))
        p.add_argument("--source", default=env("MEMASTER_SOURCE", ""))
        p.add_argument("--memory-type", default="")
        p.add_argument("--tags", default="")

    def add_structured_metadata_args(p: argparse.ArgumentParser) -> None:
        p.add_argument("--project", default=env("MEMASTER_PROJECT", ""), help="Required metadata.project")
        p.add_argument("--area", default=env("MEMASTER_AREA", ""), help="Required metadata.area")
        p.add_argument("--scope", default=env("MEMASTER_SCOPE", ""), help="Optional metadata.scope")
        p.add_argument("--service", default=env("MEMASTER_SERVICE", DEFAULT_SERVICE), help="metadata.service")

    doctor = subparsers.add_parser("doctor", help="Show local configuration status without printing secrets")
    add_scope(doctor)
    add_filter_args(doctor)
    doctor.set_defaults(func=cmd_doctor)

    search = subparsers.add_parser("search", help="Search Memaster memory")
    add_scope(search)
    add_filter_args(search)
    search.add_argument("--query", required=True)
    search.add_argument("--top-k", type=int, default=env_int("MEMASTER_TOP_K", 5))
    search.add_argument("--filters", default="", help="Extra filters JSON")
    search.set_defaults(func=cmd_search)

    add = subparsers.add_parser("add", help="Add Memaster memory")
    add_scope(add)
    add_structured_metadata_args(add)
    add.add_argument("--title", required=True)
    add.add_argument("--content", required=True)
    add.add_argument("--memory-type", default="project_info")
    add.add_argument("--metadata", default="", help="Extra metadata JSON")
    add.add_argument("--tags", default="", help="Comma-separated tags")
    add.add_argument("--infer", action="store_true", default=env_bool("MEMASTER_INFER"), help="Enable server-side infer=true memory extraction")
    add.add_argument("--no-infer", dest="infer", action="store_false", help="Disable infer even when MEMASTER_INFER=true")
    add.set_defaults(func=cmd_add)

    list_cmd = subparsers.add_parser("list", help="List Memaster memory")
    add_scope(list_cmd)
    add_filter_args(list_cmd)
    list_cmd.set_defaults(func=cmd_list)

    get = subparsers.add_parser("get", help="Get a single Memaster memory by id")
    get.add_argument("--memory-id", required=True)
    get.set_defaults(func=cmd_get)

    update = subparsers.add_parser("update", help="Update Memaster memory")
    add_structured_metadata_args(update)
    update.add_argument("--memory-id", required=True)
    update.add_argument("--content", required=True)
    update.add_argument("--memory-type", default="")
    update.add_argument("--metadata", default="", help="Extra metadata JSON")
    update.add_argument("--tags", default="", help="Comma-separated tags")
    update.set_defaults(func=cmd_update)

    delete = subparsers.add_parser("delete", help="Delete Memaster memory")
    delete.add_argument("--memory-id", required=True)
    delete.add_argument("--yes", action="store_true", help="Confirm destructive delete")
    delete.set_defaults(func=cmd_delete)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
