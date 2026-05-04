#!/usr/bin/env python3

"""Verify that no remote Supabase migrations are missing from the repo.

This script runs as a pre-flight in `supabase-deploy-prod.yml` (and any
future deploy flow that wants the same guard) before pushing migrations.

The check is asymmetric on purpose:

- ``remote_only`` versions — applied to the linked project but absent
  from the repo — are *fatal*. They indicate someone applied a migration
  out-of-band (Studio SQL editor, manual SQL, branch reset, etc.) and
  pushing the repo state will either skip those changes or, worse, try
  to re-apply earlier migrations on top of them.
- ``local_only`` versions — present in the repo but not yet applied —
  are *expected*. Applying them is the reason the deploy workflow exists.
  We print them as informational output so the operator sees what is
  about to land.
"""

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

    if remote_only:
        sys.stderr.write("Supabase remote has migrations missing from the repo.\n")
        sys.stderr.write(f"Remote-only versions: {', '.join(remote_only)}\n")
        sys.stderr.write(
            "\nThese were applied out-of-band and must be reconciled before deploying.\n"
            "Either commit a matching migration file or reset the remote to match the repo.\n\n"
        )
        sys.stderr.write("Full `supabase migration list --linked` output:\n")
        sys.stderr.write(output)
        return 1

    if local_only:
        print(f"Local-only versions ready to apply: {', '.join(local_only)}")
    print("Supabase migration versions are aligned (no remote drift).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
