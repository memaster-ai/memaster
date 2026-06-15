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

## Add memory

```http
POST /memories
```

```json
{
  "messages": [
    { "role": "user", "content": "Memory content" }
  ],
  "user_id": "<MEMASTER_USER_ID>",
  "agent_id": "<MEMASTER_AGENT_ID>",
  "infer": true,
  "metadata": {
    "title": "Title",
    "memory_type": "project_info",
    "project": "Project",
    "area": "Area",
    "source": "<MEMASTER_SOURCE>",
    "tags": ["tag"]
  }
}
```

At least one of `user_id`, `agent_id`, or `run_id` is required.

Set `infer` to `true` when you want the server to extract durable memories from the input instead of storing the whole text verbatim.

## Search memory

```http
POST /search
```

```json
{
  "query": "What should I remember about this task?",
  "user_id": "<MEMASTER_USER_ID>",
  "agent_id": "<MEMASTER_AGENT_ID>",
  "top_k": 5,
  "filters": {
    "project": "Project"
  }
}
```

## List memory

```http
GET /memories?user_id=<MEMASTER_USER_ID>&project=<Project>
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
    "area": "Area"
  }
}
```

## Delete memory

```http
DELETE /memories/{memoryID}
```

Deletion is destructive. The helper script requires `--yes` for delete.
