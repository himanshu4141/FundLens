#!/usr/bin/env python3

from __future__ import annotations

import re
import subprocess
import sys


ROW_RE = re.compile(r"^\s*(\d{14})?\s*\|\s*(\d{14})?\s*\|")


def main() -> int:
    command = ["supabase", "migration", "list", "--linked"]
    result = subprocess.run(command, capture_output=True, text=True)
    output = (result.stdout or "") + (result.stderr or "")

    if result.returncode != 0:
        sys.stderr.write(output)
        return result.returncode

    local_only: list[str] = []
    remote_only: list[str] = []

    for line in output.splitlines():
        match = ROW_RE.match(line)
        if not match:
            continue

        local_version, remote_version = match.groups()
        if local_version and not remote_version:
            local_only.append(local_version)
        elif remote_version and not local_version:
            remote_only.append(remote_version)

    if local_only or remote_only:
        sys.stderr.write("Supabase migration versions are out of sync.\n")
        if local_only:
            sys.stderr.write(f"Local-only versions: {', '.join(local_only)}\n")
        if remote_only:
            sys.stderr.write(f"Remote-only versions: {', '.join(remote_only)}\n")
        sys.stderr.write("\nFull `supabase migration list --linked` output:\n")
        sys.stderr.write(output)
        return 1

    print("Supabase migration versions are aligned.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
