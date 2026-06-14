# Memaster Clients

Memaster official client SDKs used by the documentation examples.

This repository contains only client SDK packages:

- `python/`: Python package `memaster`
- `typescript/`: TypeScript package `memaster`

Both clients default to `https://api.memaster.cn` and authenticate with the `X-API-Key` header.

## Python

```bash
pip install memaster
export MEMASTER_API_KEY="m0sk_xxx"
```

```python
from memaster import MemoryClient

client = MemoryClient()
client.add(
    user_id="user_123",
    messages=[{"role": "user", "content": "我喜欢中文回复"}],
)

results = client.search(
    query="用户偏好什么回复语言？",
    user_id="user_123",
    top_k=5,
)
```

## TypeScript

```bash
pnpm add memaster
```

```typescript
import { MemoryClient } from "memaster";

const client = new MemoryClient({ apiKey: process.env.MEMASTER_API_KEY! });

await client.add({
  user_id: "user_123",
  messages: [{ role: "user", content: "我喜欢中文回复" }],
});

const results = await client.search({
  query: "用户偏好什么回复语言？",
  user_id: "user_123",
  top_k: 5,
});
```
