# OpenHands Agent Server Integration

DevForge integrates with the [OpenHands Software Agent SDK](https://docs.openhands.dev/sdk) to provide AI-powered coding assistance as an alternative to the Groq agent.

## Architecture

```
DevForge IDE → DevForge API → OpenHands Agent Server → Isolated Workspace
                    ↓                                           ↓
            WorkspaceStore ← ─ ─ ─ ─ ─ Reconciliation ← ─ ─ ─ ┘
```

The integration:
1. Seeds an isolated temporary workspace from the candidate's authorized workspace
2. Sends the coding task to OpenHands Agent Server
3. Reconciles actual file changes back into the WorkspaceStore
4. Validates every change for conflicts, read-only violations, and path traversal
5. Stages deletions for explicit approval

## Prerequisites

- **Python 3.12+** installed
- **OpenHands SDK v1.55.1** (already installed in `.openhands-env`)
- **Running Agent Server** on localhost

## Installation

The Python environment and OpenHands packages are already installed in `.openhands-env`. If you need to reinstall:

### Windows (PowerShell)

```powershell
# Using uv (recommended)
uv venv --python 3.12 .openhands-env
.openhands-env\Scripts\python.exe -m pip install `
  openhands-sdk==1.55.1 `
  openhands-tools==1.55.1 `
  openhands-workspace==1.55.1 `
  openhands-agent-server==1.55.1
```

### macOS/Linux

```bash
# Using uv (recommended)
uv venv --python 3.12 .openhands-env
.openhands-env/bin/python -m pip install \
  openhands-sdk==1.55.1 \
  openhands-tools==1.55.1 \
  openhands-workspace==1.55.1 \
  openhands-agent-server==1.55.1
```

## Configuration

### 1. Start the Agent Server

The Agent Server must be running before enabling the OpenHands feature.

**Windows:**
```powershell
.openhands-env\Scripts\python.exe -m openhands.agent_server --host 127.0.0.1 --port 8999
```

**macOS/Linux:**
```bash
.openhands-env/bin/python -m openhands.agent_server --host 127.0.0.1 --port 8999
```

Verify it's running:
```powershell
curl http://127.0.0.1:8999/health
# Should return: {"status":"ok"}
```

### 2. Generate Authentication Keys

The Agent Server requires session API key authentication when accessed by DevForge.

**Windows PowerShell:**
```powershell
# Generate a secure 32-character key
-join ((48..57)+(65..90)+(97..122)|Get-Random -Count 32|%{[char]$_})
```

**macOS/Linux:**
```bash
# Generate a secure key
openssl rand -base64 32
```

### 3. Configure Environment Variables

Add to `.env` (or `apps/api/.env`):

```bash
# Enable OpenHands (default: false)
OPENHANDS_ENABLED=true

# Agent Server URL (local only - never expose publicly)
OPENHANDS_AGENT_SERVER_URL=http://127.0.0.1:8999

# Session API key for DevForge → Agent Server authentication
OPENHANDS_SESSION_API_KEY=<your-generated-key>

# Bridge secret (reserved for future use)
OPENHANDS_SECRET_KEY=<your-generated-key>

# Model to use (must be available on Agent Server or via LLM credentials)
OPENHANDS_MODEL=openai/gpt-oss-120b

# Timeout for agent runs (milliseconds)
OPENHANDS_TIMEOUT_MS=120000

# Optional: Pass LLM credentials directly to the bridge
# (Alternative to configuring them on the Agent Server)
# OPENHANDS_LLM_API_KEY=<your-llm-key>
# OPENHANDS_LLM_BASE_URL=<your-llm-endpoint>
```

### 4. Start the Agent Server with Authentication

Set the session API key before starting:

**Windows PowerShell:**
```powershell
$env:OH_SESSION_API_KEYS_0="<your-generated-key>"
.openhands-env\Scripts\python.exe -m openhands.agent_server --host 127.0.0.1 --port 8999
```

**macOS/Linux:**
```bash
export OH_SESSION_API_KEYS_0="<your-generated-key>"
.openhands-env/bin/python -m openhands.agent_server --host 127.0.0.1 --port 8999
```

## Usage

Once configured and enabled, the OpenHands agent automatically replaces the Groq agent for all coding tasks.

### Testing

Run the test suite:

```bash
npm test apps/api/src/services/openhands
```

### Manual Smoke Test

With the Agent Server running and OPENHANDS_ENABLED=true:

1. Start the DevForge API server
2. Create or open an assessment session
3. Ask the AI agent to create a simple file (e.g., "Create src/test.ts with a hello function")
4. Verify the file appears in the workspace
5. Ask to edit the file
6. Verify the changes are applied

## Security

- **Never bind the Agent Server to 0.0.0.0** - Always use 127.0.0.1 for local-only access
- **Never commit credentials** - Keep `.env` in `.gitignore`
- **Session isolation** - Each agent run uses a temporary isolated workspace
- **Path validation** - All paths are validated against traversal attacks
- **Read-only protection** - Read-only files cannot be modified or deleted
- **Stale detection** - Conflicting concurrent edits are rejected
- **Deletion approval** - File deletions always require explicit candidate approval

## Troubleshooting

### Agent Server won't start

**Error: `No module named openhands`**
```powershell
# Reinstall packages
.openhands-env\Scripts\python.exe -m pip install --force-reinstall openhands-agent-server==1.55.1
```

**Error: `Address already in use`**
```powershell
# Check if another process is using port 8999
netstat -ano | findstr :8999
# Kill the process or use a different port
```

### Authentication failures

**Error: `401 Unauthorized`**
- Verify `OPENHANDS_SESSION_API_KEY` matches `OH_SESSION_API_KEYS_0`
- Ensure the Agent Server was started with the environment variable set
- Check the key doesn't have leading/trailing whitespace

### Runtime errors

**Error: `The OpenHands runtime is not available`**
- Verify the Python interpreter path in `.env` is correct
- Check `.openhands-env/Scripts/python.exe` (Windows) or `.openhands-env/bin/python` (Unix) exists
- Ensure `apps/api/src/services/openhands/bridge/run_task.py` exists

**Error: `Could not reach the OpenHands Agent Server`**
- Verify the Agent Server is running: `curl http://127.0.0.1:8999/health`
- Check firewall isn't blocking localhost connections
- Verify `OPENHANDS_AGENT_SERVER_URL` matches the server's bind address

## Reverting to Groq

To disable OpenHands and revert to the Groq agent:

```bash
# In .env
OPENHANDS_ENABLED=false
```

Restart the API server. No other changes are needed.

## Architecture Details

### Python Bridge (`bridge/run_task.py`)

The bridge is a minimal wrapper that:
1. Accepts a JSON payload via stdin (secrets never pass through argv/env)
2. Creates a `Workspace(host=..., api_key=..., working_dir=...)` pointing to the Agent Server
3. Creates a `Conversation` and sends the coding task
4. Waits for completion with timeout
5. Returns structured JSON result to stdout

### TypeScript Adapter (`adapter.ts`)

The adapter:
1. Spawns the Python bridge as a subprocess
2. Writes the request JSON to stdin
3. Reads the response JSON from stdout
4. Maps errors to typed `OpenHandsRuntimeError` instances
5. Never fabricates success or silently falls back to Groq

### Workspace Bridge (`workspaceBridge.ts`)

The bridge:
1. Seeds a temporary directory with current workspace files
2. Passes the directory path to OpenHands
3. After execution, reads actual file changes from disk
4. Plans reconciliation (create/edit/delete) with conflict detection
5. Applies safe operations; stages destructive operations for approval
6. Cleans up temporary directory

## References

- [OpenHands SDK Documentation](https://docs.openhands.dev/sdk)
- [Agent Server Package](https://docs.openhands.dev/sdk/arch/agent-server)
- [Local Agent Server Guide](https://docs.openhands.dev/sdk/guides/agent-server/local-server)
- [OpenHands GitHub](https://github.com/OpenHands/software-agent-sdk)
