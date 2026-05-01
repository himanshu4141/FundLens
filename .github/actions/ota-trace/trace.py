#!/usr/bin/env python3
"""Parse EAS update JSON, write job summary, optionally update the PR comment.

PR comment behaviour: the UUID table accumulates across pushes. On each run,
new rows are prepended so the latest UUIDs are at the top and every UUID from
every push on the PR stays searchable.

Reads from env vars set by action.yml:
  UPDATE_JSON  — raw JSON string from eas-update.py stdout
  CHANNEL      — EAS channel name
  COMMIT_SHA   — full git commit SHA
  PR_NUMBER    — PR number (empty → skip PR comment)
  GH_TOKEN     — GitHub token (required when PR_NUMBER is set)
  REPO         — owner/repo string (falls back to GITHUB_REPOSITORY)
  GITHUB_STEP_SUMMARY — path to the job summary file (set by the runner)
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

# Markers delimit the accumulated data rows inside the PR comment.
# Only raw table rows (no header/separator) are stored between them.
_HISTORY_START = "<!-- ota-trace:history-start -->"
_HISTORY_END = "<!-- ota-trace:history-end -->"


def main() -> None:
    raw = os.environ.get("UPDATE_JSON", "").strip()
    channel = os.environ.get("CHANNEL", "unknown")
    commit_sha = os.environ.get("COMMIT_SHA", "")
    pr_number = os.environ.get("PR_NUMBER", "").strip()
    gh_token = os.environ.get("GH_TOKEN", "").strip()
    repo = os.environ.get("REPO", "").strip() or os.environ.get("GITHUB_REPOSITORY", "")
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY", "")

    updates: list[dict] = []
    try:
        payload = json.loads(raw)
        if isinstance(payload, list):
            updates = payload
    except (json.JSONDecodeError, ValueError):
        pass

    ios = next((u for u in updates if u.get("platform") == "ios"), None)
    android = next((u for u in updates if u.get("platform") == "android"), None)

    short_sha = commit_sha[:8] if commit_sha else "unknown"
    actor: dict = (ios or android or {}).get("actor") or {}
    username = actor.get("username", "") if isinstance(actor, dict) else ""
    first_id = (ios or android or {}).get("id", "")
    eas_url = (
        f"https://expo.dev/accounts/{username}/projects/fundlens/updates/{first_id}"
        if username and first_id
        else ""
    )

    summary_md = _build_summary(channel, commit_sha, short_sha, ios, android, eas_url)
    if summary_path:
        with open(summary_path, "a") as f:
            f.write(summary_md)
    print(summary_md, flush=True)

    if pr_number and gh_token and repo:
        _upsert_pr_comment(gh_token, repo, pr_number, channel, commit_sha,
                           short_sha, ios, android, eas_url)


# ── Job summary (no history needed — each run is its own summary) ──────────

def _build_summary(channel: str, commit_sha: str, short_sha: str,
                   ios: dict | None, android: dict | None, eas_url: str) -> str:
    rows = []
    if ios:
        rows.append(f"| iOS | `{ios['id']}` | `{short_sha}` |")
    if android:
        rows.append(f"| Android | `{android['id']}` | `{short_sha}` |")

    table = (
        "| Platform | Update ID | Commit |\n"
        "|----------|-----------|--------|\n"
        + "\n".join(rows)
        if rows
        else "_No update IDs found in EAS output._"
    )
    url_line = f"\n[View on EAS Dashboard]({eas_url})\n" if eas_url else ""

    return (
        f"## OTA Update Trace — `{channel}`\n\n"
        f"**Commit:** `{commit_sha}`\n\n"
        f"{table}\n"
        f"{url_line}"
    )


# ── PR comment (accumulates rows across pushes) ─────────────────────────────

def _new_rows(ios: dict | None, android: dict | None, short_sha: str) -> str:
    rows = []
    if ios:
        rows.append(f"| iOS | `{ios['id']}` | `{short_sha}` |")
    if android:
        rows.append(f"| Android | `{android['id']}` | `{short_sha}` |")
    return "\n".join(rows)


def _extract_prev_rows(body: str) -> str:
    """Return the raw accumulated data rows from a previous comment, or ''."""
    if _HISTORY_START not in body or _HISTORY_END not in body:
        return ""
    start = body.index(_HISTORY_START) + len(_HISTORY_START)
    end = body.index(_HISTORY_END)
    return body[start:end].strip()


def _build_pr_comment(channel: str, ios: dict | None, android: dict | None,
                      short_sha: str, eas_url: str, all_rows: str) -> str:
    table = (
        "| Platform | Update ID | Commit |\n"
        "|----------|-----------|--------|\n"
        + all_rows
        if all_rows
        else "_No update IDs available._"
    )
    url_line = f"\n[View on EAS Dashboard]({eas_url})\n" if eas_url else ""

    return (
        f"### EAS Preview Update\n\n"
        f"Published to the shared **{channel}** stream for the installed **FundLens PR** preview app "
        f"(not Expo Go — native auth flows require a real build).\n\n"
        f"**OTA Update IDs** (latest first — search any ID in the app's About screen to "
        f"trace back to this PR):\n\n"
        f"{_HISTORY_START}\n{table}\n{_HISTORY_END}\n"
        f"{url_line}"
        f"\n> **Web preview:** use the Vercel preview URL in the Vercel bot comment below "
        f"to test browser-based flows."
    )


def _upsert_pr_comment(token: str, repo: str, pr_number: str, channel: str,
                       commit_sha: str, short_sha: str,
                       ios: dict | None, android: dict | None, eas_url: str) -> None:
    api = "https://api.github.com"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "ota-trace-action/1.0",
    }

    list_url = f"{api}/repos/{repo}/issues/{pr_number}/comments?per_page=100"
    req = urllib.request.Request(list_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as resp:
            comments: list[dict] = json.loads(resp.read())
    except urllib.error.URLError as exc:
        print(f"[ota-trace] Failed to list PR comments: {exc}", flush=True)
        return

    existing = next(
        (c for c in comments if c.get("body", "").startswith("### EAS Preview")),
        None,
    )

    # Prepend new rows; keep all previous rows so every UUID stays searchable.
    prev_rows = _extract_prev_rows(existing["body"]) if existing else ""
    this_rows = _new_rows(ios, android, short_sha)
    all_rows = this_rows + ("\n" + prev_rows if prev_rows else "")

    body = _build_pr_comment(channel, ios, android, short_sha, eas_url, all_rows)
    payload = json.dumps({"body": body}).encode()

    if existing:
        url = f"{api}/repos/{repo}/issues/comments/{existing['id']}"
        req = urllib.request.Request(url, data=payload, headers=headers, method="PATCH")
        action = "updated"
    else:
        url = f"{api}/repos/{repo}/issues/{pr_number}/comments"
        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
        action = "created"

    try:
        with urllib.request.urlopen(req) as resp:
            result: dict = json.loads(resp.read())
            print(f"[ota-trace] PR comment {action}: {result.get('html_url', '')}", flush=True)
    except urllib.error.URLError as exc:
        print(f"[ota-trace] Failed to write PR comment: {exc}", flush=True)


if __name__ == "__main__":
    main()
