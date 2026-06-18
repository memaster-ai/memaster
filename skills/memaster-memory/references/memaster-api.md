# Memaster Memory API Reference

Base URL:

```text
https://api.memaster.cn
```

Authentication header:

```http
X-API-Key: <MEMASTER_API_KEY>
Content-Type: application/json
```

The REST API scopes requests by the API Key owner. `user_id` is optional and should be used only when you intentionally need a terminal-user filter. Prefer metadata filters such as `project`, `area`, `scope`, `source`, `memory_type`, and `tags` for project memories.

## Add memory

```http
POST /memories
```

```json
{
  "messages": [
    { "role": "user", "content": "Memory content" }
  ],
  "agent_id": "<MEMASTER_AGENT_ID>",
  "infer": false,
  "metadata": {
    "title": "Title",
    "memory_type": "project_info",
    "project": "Project",
    "area": "Area",
    "scope": "Scope",
    "source": "<MEMASTER_SOURCE>",
    "tags": ["tag"]
  }
}
```

Set `infer` to `true` when you want the server to extract durable memories from the input instead of storing the whole text verbatim.

## Search memory

```http
POST /search
```

```json
{
  "query": "What should I remember about this task?",
  "agent_id": "<MEMASTER_AGENT_ID>",
  "top_k": 5,
  "filters": {
    "project": "Project",
    "area": "Area",
    "source": "<MEMASTER_SOURCE>",
    "memory_type": "project_info",
    "tags": ["tag"]
  }
}
```

## List memory

```http
GET /memories?project=<Project>&area=<Area>&source=<MEMASTER_SOURCE>&tags=tag1,tag2
```

## Get memory

```http
GET /memories/{memoryID}
```

## Update memory

```http
PUT /memories/{memoryID}
```

```json
{
  "text": "Updated memory content",
  "metadata": {
    "memory_type": "project_info",
    "project": "Project",
    "area": "Area",
    "tags": ["tag"]
  }
}
```

## Delete memory

```http
DELETE /memories/{memoryID}
```

Deletion is destructive. The helper script requires `--yes` for delete.
