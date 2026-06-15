# Memaster Memory Skill

A ready-to-use AI editor Skill for Memaster long-term memory.

It works without MCP. Any editor or agent that can read a Skill/Rule file and run a local Python script can use it.

## Install

Copy this directory into your editor's skills directory:

```bash
cp -R skills/memaster-memory ~/.claude/skills/memaster-memory
# or
cp -R skills/memaster-memory .cursor/skills/memaster-memory
# or
cp -R skills/memaster-memory .devin/skills/memaster-memory
```

Then configure environment variables:

```bash
cp ~/.claude/skills/memaster-memory/.env.example ~/.claude/skills/memaster-memory/.env.local
```

Edit `.env.local` and set:

```text
MEMASTER_API_KEY=m0sk_xxx
MEMASTER_USER_ID=your-user-id
MEMASTER_AGENT_ID=your-agent-id
MEMASTER_PROJECT=your-project
MEMASTER_AREA=your-area
MEMASTER_INFER=false
MEMASTER_TIMEOUT_SECONDS=20
```

## Verify

```bash
python3 scripts/memaster_memory.py doctor
python3 scripts/memaster_memory.py search --query "test" --top-k 1
```

## Common commands

```bash
python3 scripts/memaster_memory.py search --query "What are the project conventions?"
python3 scripts/memaster_memory.py add --title "Project convention" --content "This project uses pnpm." --memory-type project_info --tags "项目,规范"
python3 scripts/memaster_memory.py add --infer --title "Extract memories" --content "User prefers concise Chinese replies and pnpm." --memory-type user_preference --tags "偏好,写入"
python3 scripts/memaster_memory.py list --project "my-project"
python3 scripts/memaster_memory.py update --memory-id "memory-id" --content "Updated memory" --project "my-project" --area "docs"
python3 scripts/memaster_memory.py delete --memory-id "memory-id" --yes
```

## Safety

Do not store API keys, tokens, passwords, cookies, private keys, certificates, or raw `.env` values.
