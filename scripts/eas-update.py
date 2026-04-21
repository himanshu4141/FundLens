#!/usr/bin/env python3
"""Deterministic wrapper for `eas update --json` in CI.

`eas update` can successfully publish and emit JSON, yet keep Metro/Node
processes alive long enough for GitHub Actions to hit the job timeout. This
wrapper:

1. runs the update command in its own process group,
2. forwards stderr live for progress/debugging,
3. buffers stdout so the caller still receives clean JSON,
4. detects a successful JSON payload,
5. gives the CLI a short grace period to exit naturally,
6. then terminates lingering child processes and returns success.
"""

from __future__ import annotations

import json
import os
import shlex
import signal
import subprocess
import sys
import tempfile
import time
from typing import Any


GRACE_SECONDS = int(os.environ.get("EAS_UPDATE_GRACE_SECONDS", "15"))
HARD_TIMEOUT_SECONDS = int(os.environ.get("EAS_UPDATE_TIMEOUT_SECONDS", str(18 * 60)))
EXPORT_MARKER = "Exported: dist"


def terminate_process_group(proc: subprocess.Popen[str]) -> None:
    if proc.poll() is not None:
        return

    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return

    deadline = time.monotonic() + 5
    while proc.poll() is None and time.monotonic() < deadline:
        time.sleep(0.2)

    if proc.poll() is None:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass


def parse_success(stdout_text: str) -> bool:
    text = stdout_text.strip()
    if not text:
        return False

    try:
        payload: Any = json.loads(text)
    except json.JSONDecodeError:
        return False

    if isinstance(payload, list) and payload:
        first = payload[0]
        return isinstance(first, dict) and bool(first.get("id"))

    return False


def list_descendants(root_pid: int) -> list[int]:
    result: set[int] = set()
    try:
        output = subprocess.check_output(
            ["ps", "-eo", "pid=", "-o", "ppid="],
            text=True,
        )
    except Exception:
        return []

    children_by_parent: dict[int, list[int]] = {}
    for line in output.splitlines():
        parts = line.split()
        if len(parts) != 2:
            continue
        pid, ppid = int(parts[0]), int(parts[1])
        children_by_parent.setdefault(ppid, []).append(pid)

    stack = list(children_by_parent.get(root_pid, []))
    while stack:
        pid = stack.pop()
        if pid in result:
            continue
        result.add(pid)
        stack.extend(children_by_parent.get(pid, []))
    return sorted(result)


def terminate_descendants(root_pid: int) -> None:
    for sig in (signal.SIGTERM, signal.SIGKILL):
        pids = list_descendants(root_pid)
        if not pids:
            return
        for pid in pids:
            try:
                os.kill(pid, sig)
            except ProcessLookupError:
                continue
        time.sleep(0.5)


def main() -> int:
    custom_command = os.environ.get("EAS_UPDATE_COMMAND")
    if custom_command:
        command = shlex.split(custom_command)
    else:
        command = [
            "eas",
            "update",
            "--branch",
            os.environ.get("EAS_UPDATE_BRANCH", "preview"),
            "--message",
            os.environ.get("EAS_UPDATE_MESSAGE", "CI update"),
            "--non-interactive",
            "--json",
        ]
    with tempfile.NamedTemporaryFile(mode="w+", delete=True) as stdout_file, tempfile.NamedTemporaryFile(
        mode="w+", delete=True
    ) as stderr_file:
        proc = subprocess.Popen(
            command,
            stdout=stdout_file,
            stderr=stderr_file,
            text=True,
            start_new_session=True,
        )

        success_at: float | None = None
        export_at: float | None = None
        descendants_terminated = False
        started_at = time.monotonic()
        stderr_pos = 0

        while True:
            time.sleep(0.5)

            stderr_file.flush()
            stderr_file.seek(stderr_pos)
            err_chunk = stderr_file.read()
            if err_chunk:
                sys.stderr.write(err_chunk)
                sys.stderr.flush()
                stderr_pos = stderr_file.tell()
                if export_at is None and EXPORT_MARKER in err_chunk:
                    export_at = time.monotonic()

            stdout_file.flush()
            stdout_file.seek(0)
            stdout_buffer = stdout_file.read()
            if success_at is None and parse_success(stdout_buffer):
                success_at = time.monotonic()

            exit_code = proc.poll()
            if exit_code is not None:
                if parse_success(stdout_buffer):
                    sys.stdout.write(stdout_buffer.strip())
                    return 0

                if stdout_buffer:
                    sys.stdout.write(stdout_buffer)
                return exit_code

            now = time.monotonic()
            if (
                export_at is not None
                and not descendants_terminated
                and success_at is None
                and now - export_at >= GRACE_SECONDS
            ):
                print(
                    "Expo export reached dist; terminating lingering child processes so EAS can finish.",
                    file=sys.stderr,
                )
                terminate_descendants(proc.pid)
                descendants_terminated = True

            if success_at is not None and now - success_at >= GRACE_SECONDS:
                print(
                    "EAS update completed; terminating lingering update processes.",
                    file=sys.stderr,
                )
                terminate_process_group(proc)
                sys.stdout.write(stdout_buffer.strip())
                return 0 if parse_success(stdout_buffer) else 1

            if now - started_at >= HARD_TIMEOUT_SECONDS:
                print("EAS update timed out before emitting success JSON.", file=sys.stderr)
                terminate_process_group(proc)
                if stdout_buffer:
                    sys.stdout.write(stdout_buffer)
                return 1


if __name__ == "__main__":
    raise SystemExit(main())
