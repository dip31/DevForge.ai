#!/usr/bin/env python
"""OpenHands bridge for DevForge.ai.

This is the smallest possible bridge between the TypeScript adapter and the
OpenHands Software Agent SDK. It uses the documented remote-workspace pattern
(Conversation + Workspace(host=..., api_key=..., working_dir=...)) against a
running OpenHands Agent Server on the same host.

Contract with the TypeScript caller:

  * A single JSON object is read from stdin. All secrets (session API key,
    bridge secret, LLM key) travel through stdin, never via argv or the
    environment, so they cannot leak into a process listing or a log line.
  * Exactly one JSON result object is written to the last line of stdout:
      {"ok": true,  "status": "finished", "model": "..."}
      {"ok": false, "error": {"code": "...", "message": "...", ...}}
  * All diagnostic logging goes to stderr and is never parsed by the caller.

Pinned SDK: openhands-sdk==1.55.1, openhands-tools==1.55.1,
openhands-workspace==1.55.1, openhands-agent-server==1.55.1 (Python >= 3.12).
"""

from __future__ import annotations

import json
import os
import sys
import threading


def log(message: str) -> None:
    """Diagnostics only. Never parsed by the caller."""
    print(message, file=sys.stderr, flush=True)


def emit(payload: dict) -> None:
    """Write the single protocol line to stdout."""
    print(json.dumps(payload), file=sys.stdout, flush=True)


def fail(code: str, message: str, **extra) -> None:
    error = {"code": code, "message": message}
    error.update(extra)
    emit({"ok": False, "error": error})


def read_payload() -> dict:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("empty payload")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("payload must be a JSON object")
    return data


def classify_error(exc: Exception) -> tuple[str, str]:
    """Map an SDK/transport exception to a normalized bridge error code.

    The message is intentionally generic: it never echoes credentials.
    """
    text = str(exc).lower()
    status = getattr(exc, "status_code", None) or getattr(
        getattr(exc, "response", None), "status_code", None
    )
    if status == 401 or "unauthor" in text or "401" in text:
        return "runtime_auth", "The OpenHands runtime rejected the session key."
    if status == 429 or "rate limit" in text or "429" in text:
        return "runtime_rate_limited", "The OpenHands runtime rate limited the request."
    if "timed out" in text or "timeout" in text:
        return "runtime_timeout", "The OpenHands agent run timed out."
    if "connection" in text or "refused" in text or "unreachable" in text:
        return "runtime_unavailable", "Could not reach the OpenHands Agent Server."
    return "runtime_upstream", "The OpenHands agent run failed."


def run(payload: dict) -> None:
    # Imported lazily so a missing install fails with a clear, single message.
    try:
        from pydantic import SecretStr
        from openhands.sdk import Conversation, LLM, Workspace
        from openhands.tools.preset.default import get_default_agent
    except Exception as exc:  # pragma: no cover - depends on the local install
        fail(
            "runtime_unavailable",
            "The OpenHands SDK is not installed in the bridge environment.",
            detail=str(exc)[:400],
        )
        return

    server_url = payload.get("server_url")
    session_api_key = payload.get("session_api_key")
    working_dir = payload.get("working_dir")
    prompt = payload.get("prompt")
    model = payload.get("model")
    llm_api_key = payload.get("llm_api_key")
    llm_base_url = payload.get("llm_base_url")
    instructions = payload.get("instructions")
    requirements = payload.get("requirements") or []
    timeout_ms = int(payload.get("timeout_ms") or 120000)

    if not server_url or not working_dir or not prompt:
        fail("runtime_invalid_response", "The bridge payload was incomplete.")
        return

    # Bound the run on the Python side as well; the caller also enforces a
    # timeout and kills the process. This watchdog makes a hang fail cleanly.
    def watchdog() -> None:
        fail("runtime_timeout", "The OpenHands agent run timed out.")
        log("bridge: watchdog fired; exiting")
        os._exit(0)

    timer = threading.Timer(timeout_ms / 1000.0, watchdog)
    timer.daemon = True
    timer.start()

    conversation = None
    try:
        workspace = Workspace(
            host=server_url,
            api_key=session_api_key,
            working_dir=working_dir,
        )

        # Prefer an explicitly configured LLM; otherwise use the LLM configured
        # on the Agent Server itself (Settings API via workspace.get_llm()).
        if llm_api_key:
            llm = LLM(
                model=model,
                api_key=SecretStr(llm_api_key),
                base_url=llm_base_url or None,
            )
        else:
            llm = workspace.get_llm(model=model)

        agent = get_default_agent(llm=llm, cli_mode=True)
        conversation = Conversation(agent=agent, workspace=workspace)

        message = prompt
        if instructions:
            message = f"{prompt}\n\nTask instructions:\n{instructions}"
        if requirements:
            bullets = "\n".join(f"- {r}" for r in requirements)
            message = f"{message}\n\nAcceptance criteria:\n{bullets}"

        conversation.send_message(message)
        conversation.run()

        status = "finished"
        runtime_status = None
        try:
            runtime_status = str(conversation.state.execution_status)
        except Exception:  # pragma: no cover - diagnostics only
            runtime_status = None

        emit({"ok": True, "status": status, "model": model, "runtime_status": runtime_status})
    except Exception as exc:  # noqa: BLE001 - normalize every failure honestly
        code, message = classify_error(exc)
        log(f"bridge: {type(exc).__name__}: {exc}")
        fail(code, message, detail=str(exc)[:400])
    finally:
        timer.cancel()
        if conversation is not None:
            try:
                conversation.close()
            except Exception:  # pragma: no cover - best-effort cleanup
                pass


def main() -> int:
    try:
        payload = read_payload()
    except Exception as exc:  # noqa: BLE001
        fail("runtime_invalid_response", "The bridge could not parse its input.", detail=str(exc)[:200])
        return 0
    run(payload)
    return 0


if __name__ == "__main__":
    sys.exit(main())
