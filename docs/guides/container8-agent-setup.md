# Container8 Agent Setup Guide

How to deploy an OpenClaw agent on Hetzner (via startlobster) with a book/document as persistent context.

---

## Context Injection in OpenClaw

OpenClaw has a layered context injection system. Workspace bootstrap files are loaded every session from `~/.openclaw/workspace/`:

| File           | Purpose                                   | Max chars             |
| -------------- | ----------------------------------------- | --------------------- |
| `AGENTS.md`    | Operating instructions, methodology steps | 20,000                |
| `SOUL.md`      | Persona, tone, boundaries                 | 20,000                |
| `MEMORY.md`    | Long-term knowledge base                  | searchable, unlimited |
| `TOOLS.md`     | Tool/convention notes                     | 20,000                |
| `IDENTITY.md`  | Agent name, emoji, avatar                 | 20,000                |
| `USER.md`      | User profile + preferred address          | 20,000                |
| `HEARTBEAT.md` | Optional checklist for heartbeat runs     | 20,000                |
| `BOOTSTRAP.md` | One-time first-run ritual                 | 20,000                |

---

## Recommended Approach for a Book-Length Document

1. **Convert the Container8 book to Markdown** (see PDF vs Markdown section below).
2. **Put the core methodology into `AGENTS.md`** - the weekly plan, implementation steps, key protocols (injected every session, 20K char limit).
3. **Put the full book content into `MEMORY.md` + `memory/*.md` files** - the agent can semantically search these via `memory_search(query)` with no size limit.
4. **Configure memory search** in `~/.openclaw/openclaw.json`:

```json
{
  "memory": {
    "backend": "builtin",
    "citations": "auto"
  },
  "agents": {
    "defaults": {
      "bootstrapMaxChars": 50000,
      "memorySearch": {
        "enabled": true,
        "provider": "openai",
        "query": { "maxResults": 8 }
      }
    }
  }
}
```

5. **On the Hetzner VPS**, mount the workspace directory in Docker Compose:

```yaml
volumes:
  - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
```

### Advanced Options

- **QMD backend** - local vector search (BM25 + embeddings) without external API calls.
- **`agent:bootstrap` hooks** - programmatic context injection at runtime.
- **Channel-specific system prompts** - per-channel context via config.

---

## PDF vs Markdown: Use Markdown

### Why Markdown wins

- **3-6x fewer tokens** - PDF pages cost 1,500-3,000 tokens each (image encoding). A 200-page book = ~400K tokens as PDF vs ~80K as Markdown.
- **Better LLM comprehension** - LLMs are trained on Markdown; they understand headers, tables, and structure natively.
- **Better retrieval** - Markdown improves RAG/search accuracy by up to 35% vs unstructured text.
- **Universal compatibility** - works across all LLM providers without limitations.
- **Prompt caching** - smaller payload = cheaper cached reads.
- **Editable** - you can refine, update, and reorganize easily.

### Only downside

Figures/diagrams need text descriptions. For a methodology agent giving weekly advice, the textual content is what matters.

### What Markdown handles well

- Chapter/section hierarchy (headers)
- Body text, paragraphs, emphasis
- Tables of data
- Numbered/bulleted lists, protocols, steps
- Citations and references (footnotes or inline)
- Mathematical formulas (LaTeX notation, e.g. `$E = mc^2$`)
- Code examples (fenced code blocks)

### Conversion tools

- [Marker](https://github.com/datalab-to/marker) - best open-source option, handles tables + equations. Use `--use_llm` flag for highest accuracy.
- [MinerU](https://github.com/opendatalab/MinerU) - alternative for complex documents.
- Then a manual cleanup pass for quality.

---

## Recommended Workspace Structure

```
~/.openclaw/workspace/
├── AGENTS.md          # "You help implement Container8. Each week, review progress
│                      #  and send the next implementation steps based on the book."
├── SOUL.md            # Persona: implementation coach, scientific rigor, encouraging
├── MEMORY.md          # Table of contents + key summaries linking to chapters
└── memory/
    ├── ch01-foundations.md
    ├── ch02-scientific-background.md
    ├── ch03-implementation-protocol.md
    └── ...
```

The agent will have the methodology instructions in every session via `AGENTS.md`, and can `memory_search("week 3 implementation steps")` to pull relevant sections from the full book.

---

## Memory Search Configuration (Advanced)

### QMD Backend (local-first, no API calls)

```json
{
  "memory": {
    "backend": "qmd",
    "qmd": {
      "includeDefaultMemory": true,
      "paths": [
        {
          "path": "/home/node/.openclaw/workspace/memory",
          "name": "container8-book",
          "pattern": "*.md"
        }
      ],
      "limits": { "maxResults": 6, "maxSnippetChars": 2000 },
      "update": {
        "interval": "5m",
        "debounceMs": 15000,
        "onBoot": true
      }
    }
  }
}
```

### Hybrid Search Tuning

```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "enabled": true,
        "sources": ["memory", "sessions"],
        "provider": "openai",
        "query": {
          "maxResults": 6,
          "minScore": 0.35,
          "hybrid": {
            "enabled": true,
            "vectorWeight": 0.7,
            "textWeight": 0.3
          }
        }
      }
    }
  }
}
```

---

## Docker Compose Setup (Hetzner)

```yaml
volumes:
  - ${OPENCLAW_CONFIG_DIR}:/home/node/.openclaw
  - ${OPENCLAW_WORKSPACE_DIR}:/home/node/.openclaw/workspace
  - ${DOCUMENTS_DIR}:/home/node/.openclaw/workspace/documents:ro
```

`.env` file:

```bash
OPENCLAW_IMAGE=openclaw:latest
OPENCLAW_GATEWAY_TOKEN=<strong-random-token>
OPENCLAW_GATEWAY_BIND=lan
OPENCLAW_GATEWAY_PORT=18789

OPENCLAW_CONFIG_DIR=/root/.openclaw
OPENCLAW_WORKSPACE_DIR=/root/.openclaw/workspace
DOCUMENTS_DIR=/root/documents

# For OpenAI embeddings (optional, needed for memory search with openai provider)
OPENAI_API_KEY=sk-...
```

---

## Token Cost Comparison

| Format               | 200-page book           | Cost factor   |
| -------------------- | ----------------------- | ------------- |
| PDF (image encoding) | ~300,000-600,000 tokens | 1x (baseline) |
| Markdown (text)      | ~78,000-90,000 tokens   | 3-6x cheaper  |

---

## Sources

- [Marker - PDF to Markdown converter](https://github.com/datalab-to/marker)
- [MinerU - Document to Markdown](https://github.com/opendatalab/MinerU)
- [Anthropic - Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Claude API - PDF Support](https://docs.anthropic.com/en/docs/build-with-claude/pdf-support)
