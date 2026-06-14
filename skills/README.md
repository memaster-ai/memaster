# Memaster Skills

Ready-to-use Skills for AI editors and coding assistants.

## Available Skills

- `memaster-memory/`: long-term memory Skill backed by Memaster Cloud.

## Install

Copy a skill directory into your editor or agent skills directory:

```bash
cp -R skills/memaster-memory ~/.claude/skills/memaster-memory
cp -R skills/memaster-memory .cursor/skills/memaster-memory
cp -R skills/memaster-memory .devin/skills/memaster-memory
```

Then create `.env.local` from `.env.example` and set `MEMASTER_API_KEY`.

## Why Skills?

Skills are useful when you want memory behavior to be part of the assistant workflow, not only exposed as tools through MCP.

The Memaster Memory Skill tells the assistant when to search, when to write, what metadata to include, and what must never be stored.
