# Disk Space Management Guide

How to diagnose, fix, and prevent disk-full events on machines running OpenClaw (especially always-on hosts like Mac Minis).

---

## Why Disk Fills Up

OpenClaw stores all persistent data under `~/.openclaw/`. Several data types grow over time, and **the default maintenance mode is `"warn"` — meaning nothing is actually pruned automatically**.

### Growth Vectors (Ranked by Impact)

| #   | Data                      | Path                                              | Default Cleanup                           |
| --- | ------------------------- | ------------------------------------------------- | ----------------------------------------- |
| 1   | Session transcripts       | `~/.openclaw/agents/<id>/sessions/*.jsonl`        | None (`mode: "warn"`)                     |
| 2   | Gateway daemon logs       | `~/.openclaw/logs/gateway.log`                    | None (append-only)                        |
| 3   | Application logs          | `/tmp/openclaw/openclaw-*.log`                    | Pruned >24h on startup, up to 500 MB/file |
| 4   | Memory SQLite DB          | `~/.openclaw/memory/<agentId>.sqlite`             | None                                      |
| 5   | Workspace memory files    | `~/.openclaw/workspace/memory/*.md`               | None                                      |
| 6   | Plugin node_modules       | `~/.openclaw/extensions/<pluginId>/`              | None                                      |
| 7   | Anthropic payload log     | `~/.openclaw/logs/anthropic-payload.jsonl`        | None (opt-in, but unbounded)              |
| 8   | QMD ML models             | `~/.cache/qmd/models/`                            | None                                      |
| 9   | Session archive artifacts | `*.jsonl.deleted.*`, `*.jsonl.reset.*`, `*.bak.*` | None by default                           |

---

## Full Directory Layout

```
~/.openclaw/
├── openclaw.json                              # main config
├── agents/
│   └── <agentId>/                             # e.g. "main"
│       ├── agent/                             # auth profiles, identity
│       └── sessions/
│           ├── sessions.json                  # session index (capped at 10 MB, then rotated)
│           ├── <sessionId>.jsonl              # conversation transcripts (UNBOUNDED)
│           ├── <sessionId>.jsonl.deleted.*    # soft-deleted archives
│           ├── <sessionId>.jsonl.reset.*      # reset archives
│           └── sessions.json.bak.*            # store backups (max 3 kept)
├── credentials/                               # OAuth tokens, pairing allowlists
├── extensions/<pluginId>/node_modules/        # per-plugin npm deps
├── logs/
│   ├── gateway.log                            # gateway stdout (UNBOUNDED)
│   ├── gateway.err.log                        # gateway stderr (UNBOUNDED)
│   └── anthropic-payload.jsonl                # optional request log (UNBOUNDED)
├── media/
│   ├── inbound/                               # received media (2-min TTL, auto-cleaned)
│   ├── outbound/                              # outgoing media (2-min TTL, auto-cleaned)
│   └── browser/                               # screenshots (2-min TTL, auto-cleaned)
├── memory/
│   └── <agentId>.sqlite                       # vector/FTS memory index (UNBOUNDED)
├── workspace/
│   ├── MEMORY.md                              # agent memory
│   └── memory/*.md                            # dated memory files (UNBOUNDED)
├── subagents/runs.json                        # subagent registry
└── canvas/                                    # agent-created canvas files
```

Media files (`inbound/`, `outbound/`, `browser/`) are **not a concern** — they have a 2-minute TTL and auto-delete after being served.

---

## Immediate Triage

SSH into the host and run:

```bash
# Overall usage
du -sh ~/.openclaw/

# Breakdown by subdirectory
du -sh ~/.openclaw/*/ 2>/dev/null | sort -rh | head -20

# Session transcripts (likely biggest offender)
du -sh ~/.openclaw/agents/*/sessions/ 2>/dev/null | sort -rh
find ~/.openclaw/agents -name "*.jsonl" | wc -l
find ~/.openclaw/agents -name "*.jsonl" -exec du -ch {} + | tail -1

# Gateway logs
ls -lh ~/.openclaw/logs/

# Memory database
du -sh ~/.openclaw/memory/*.sqlite 2>/dev/null

# Application logs
du -sh /tmp/openclaw/ 2>/dev/null

# Plugins
du -sh ~/.openclaw/extensions/*/ 2>/dev/null | sort -rh

# QMD models (if using QMD memory backend)
du -sh ~/.cache/qmd/ 2>/dev/null
```

Also run the built-in diagnostics:

```bash
openclaw doctor
```

This flags orphan transcripts, permission issues, and cloud-synced state dirs.

---

## Fix 1: Enable Session Disk Budget (Most Important)

The **single biggest win**. Edit `~/.openclaw/openclaw.json`:

```json
{
  "session": {
    "maintenance": {
      "mode": "enforce",
      "maxDiskBytes": "2gb",
      "highWaterBytes": "1.5gb",
      "maxEntries": 300,
      "pruneAfter": "14d",
      "resetArchiveRetention": "3d"
    }
  }
}
```

| Setting                 | Default            | Recommended | What It Does                                        |
| ----------------------- | ------------------ | ----------- | --------------------------------------------------- |
| `mode`                  | `"warn"`           | `"enforce"` | Actually prune instead of just logging              |
| `maxDiskBytes`          | `null` (unlimited) | `"2gb"`     | Hard ceiling on sessions directory                  |
| `highWaterBytes`        | N/A                | `"1.5gb"`   | Evict oldest sessions until under this              |
| `maxEntries`            | 500                | 300         | Max session entries per agent                       |
| `pruneAfter`            | 30 days            | `"14d"`     | Remove sessions untouched for 14 days               |
| `resetArchiveRetention` | 30 days            | `"3d"`      | Clean `.deleted.*`/`.reset.*` archives after 3 days |

Then force an immediate cleanup:

```bash
# Enforce cleanup now for all agents
openclaw sessions cleanup --enforce --all-agents

# Preview first with dry-run if you want to see what would be removed
openclaw sessions cleanup --enforce --all-agents --dry-run
```

Maintenance runs automatically on every session store save once `mode: "enforce"` is set.

---

## Fix 2: Rotate Gateway Logs

Gateway logs have no built-in rotation. Add a daily cron job:

```bash
# Option A: Truncate (simple, loses old logs)
0 3 * * * truncate -s 0 ~/.openclaw/logs/gateway.log ~/.openclaw/logs/gateway.err.log

# Option B: Keep last 10 MB (preserves recent context)
0 3 * * * tail -c 10M ~/.openclaw/logs/gateway.log > ~/.openclaw/logs/gateway.log.tmp && mv ~/.openclaw/logs/gateway.log.tmp ~/.openclaw/logs/gateway.log
```

Or on macOS, create a LaunchAgent plist for the same effect.

---

## Fix 3: Vacuum Memory SQLite

The SQLite database doesn't reclaim space from deleted rows automatically:

```bash
sqlite3 ~/.openclaw/memory/main.sqlite "VACUUM;"
```

To limit the embedding cache, add to `openclaw.json`:

```json
{
  "agents": {
    "defaults": {
      "memorySearch": {
        "cache": {
          "maxEntries": 5000
        }
      }
    }
  }
}
```

---

## Fix 4: Prune Old Workspace Memory Files

The agent appends dated memory files during pre-compaction flushes. Remove old ones:

```bash
# Remove memory files older than 30 days
find ~/.openclaw/workspace/memory/ -name "*.md" -mtime +30 -delete
```

---

## Fix 5: Remove Unused Plugins

```bash
# List installed plugins and their sizes
du -sh ~/.openclaw/extensions/*/

# Remove unused ones
rm -rf ~/.openclaw/extensions/<unused-plugin>/
```

---

## Fix 6: Disable Anthropic Payload Log (If Enabled)

If `OPENCLAW_ANTHROPIC_PAYLOAD_LOG=1` is set in your environment, this log grows without bound:

```bash
# Check if it exists
ls -lh ~/.openclaw/logs/anthropic-payload.jsonl

# Remove the env var from your profile, then delete the log
rm ~/.openclaw/logs/anthropic-payload.jsonl
```

---

## Ongoing Monitoring

### Disk Usage Alert Script

Save as `~/.openclaw/check-disk.sh` and run via cron:

```bash
#!/bin/bash
THRESHOLD_MB=5000
USAGE_MB=$(du -sm ~/.openclaw/ | cut -f1)
if [ "$USAGE_MB" -gt "$THRESHOLD_MB" ]; then
  echo "WARNING: ~/.openclaw/ is ${USAGE_MB}MB (threshold: ${THRESHOLD_MB}MB)"
  # Add your alert mechanism here (email, webhook, etc.)
fi
```

```bash
# Run hourly
0 * * * * bash ~/.openclaw/check-disk.sh
```

### Recommended Config Summary

```json
{
  "session": {
    "maintenance": {
      "mode": "enforce",
      "maxDiskBytes": "2gb",
      "highWaterBytes": "1.5gb",
      "maxEntries": 300,
      "pruneAfter": "14d",
      "resetArchiveRetention": "3d"
    }
  },
  "logging": {
    "maxFileBytes": 104857600
  },
  "agents": {
    "defaults": {
      "memorySearch": {
        "cache": {
          "maxEntries": 5000
        }
      }
    }
  }
}
```

The `logging.maxFileBytes` setting caps each daily app log at 100 MB (down from the 500 MB default).

---

## Quick Reference: Cleanup Commands

| Task                           | Command                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| Run diagnostics                | `openclaw doctor`                                            |
| Preview session cleanup        | `openclaw sessions cleanup --enforce --all-agents --dry-run` |
| Force session cleanup          | `openclaw sessions cleanup --enforce --all-agents`           |
| Vacuum memory DB               | `sqlite3 ~/.openclaw/memory/main.sqlite "VACUUM;"`           |
| Truncate gateway logs          | `truncate -s 0 ~/.openclaw/logs/gateway.{log,err.log}`       |
| Check overall disk usage       | `du -sh ~/.openclaw/`                                        |
| Check session transcript count | `find ~/.openclaw/agents -name "*.jsonl" \| wc -l`           |
