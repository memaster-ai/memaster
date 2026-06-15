# memaster TypeScript SDK

TypeScript client for the Memaster cloud memory API.

## Install

```bash
pnpm add memaster
```

## Usage

```typescript
import { MemoryClient } from "memaster";

const client = new MemoryClient({ apiKey: "m0sk_xxx" });

await client.add({
  user_id: "user_123",
  messages: [{ role: "user", content: "我喜欢中文回复" }],
  infer: true,
});

const results = await client.search({
  query: "用户偏好什么回复语言？",
  user_id: "user_123",
  top_k: 5,
});
```
