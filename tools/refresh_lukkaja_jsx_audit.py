#!/usr/bin/env python3
"""Refresh pinned, read-only LUKKAJA JSX inventory vs PENGUIN Firebase JSX.

Usage: python3 tools/refresh_lukkaja_jsx_audit.py --source ../lukkhaja_bankalert_stripe
Writes only destination docs. Does NOT change Source, deploy or assess behavior.
"""
import argparse
import collections
import datetime
import hashlib
import json
from pathlib import Path
import re
import subprocess


def git(root, *args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def tracked_jsx(root, prefix):
    values = {}
    for line in git(root, "ls-files", "--", prefix).splitlines():
        rel = line[len(prefix) + 1:]
        if not rel.endswith(".jsx"):
            continue
        if re.fullmatch(r"pages/[^/]+\.jsx", rel):
            group = "pages"
        elif re.fullmatch(r"components/[^/]+\.jsx", rel):
            group = "components"
        elif rel.split("/")[0] not in ("pages", "components"):
            group = "other"
        else:
            continue
        blob = (root / line).read_bytes()
        values[rel] = {"group": group, "lines": len(blob.splitlines()),
                       "hash": hashlib.sha256(blob).hexdigest()}
    return values


def changed_paths(root, base, head, prefix):
    return {s[len(prefix) + 1:] for s in
            git(root, "diff", "--name-only", base + ".." + head,
                "--", prefix).splitlines()
            if s.startswith(prefix + "/")}


def diff_numstat(root, base, head, prefix):
    stats = {}
    for line in git(root, "diff", "--numstat", base + ".." + head,
                    "--", prefix).splitlines():
        cells = line.split("\t", 2)
        if len(cells) != 3 or not cells[2].startswith(prefix + "/"):
            continue
        a, d, path = cells
        if a.isdigit() and d.isdigit():
            stats[path[len(prefix) + 1:]] = {"added": int(a), "deleted": int(d)}
    return stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Local read-only Source Git checkout")
    parser.add_argument("--prior", default="auto",
                        help="Prior pinned JSX audit JSON, or auto-select last different Source revision")
    parser.add_argument("--output-date", default=datetime.datetime.now(
        datetime.timezone(datetime.timedelta(hours=7))).strftime("%Y-%m-%d"))
    parser.add_argument("--update-page-matrix", action="store_true")
    args = parser.parse_args()
    target = Path(__file__).resolve().parents[1]
    source = Path(args.source).expanduser().resolve()
    source_commit = git(source, "rev-parse", "HEAD")
    target_commit = git(target, "rev-parse", "HEAD")
    if args.prior == "auto":
        options = sorted((target / "docs").glob(
            "LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_20*.json"), reverse=True)
        prior_path = next((candidate for candidate in options
                           if json.loads(candidate.read_text(encoding="utf-8"))
                           .get("source", {}).get("commit") != source_commit), None)
        if prior_path is None:
            raise SystemExit("No earlier different Source JSX snapshot for refresh")
    else:
        prior_path = target / args.prior
    previous = json.loads(prior_path.read_text(encoding="utf-8"))
    source_branch = git(source, "branch", "--show-current")
    target_branch = git(target, "branch", "--show-current")
    if (source_branch != "feature/lukkaja_bankalert_stripe" or
            target_branch != "feature/react-firebase-port" or
            previous["source"]["commit"] == source_commit):
        raise SystemExit("Wrong branch or no new source revision: audit aborted")
    old_source = previous["source"]["commit"]
    old_target = previous["target"]["commit"]
    subprocess.run(["git", "-C", str(source), "merge-base", "--is-ancestor",
                    old_source, source_commit], check=True)
    subprocess.run(["git", "-C", str(target), "merge-base", "--is-ancestor",
                    old_target, target_commit], check=True)
    source_prefix = previous["source"]["root"]
    target_prefix = previous["target"]["root"]
    if git(source, "status", "--porcelain", "--", source_prefix):
        raise SystemExit("Source JSX working tree has uncommitted changes: cannot pin audit to HEAD")
    if git(target, "status", "--porcelain", "--", target_prefix):
        raise SystemExit("Target JSX working tree has uncommitted changes: cannot pin audit to HEAD")
    sf, tf = tracked_jsx(source, source_prefix), tracked_jsx(target, target_prefix)
    changed_source = changed_paths(source, old_source, source_commit, source_prefix)
    changed_target = changed_paths(target, old_target, target_commit, target_prefix)
    stat = diff_numstat(source, old_source, source_commit, source_prefix)
    old_files = {f["path"]: f for f in previous["files"]}
    groups, rows = {}, []
    for group in ("pages", "components", "other"):
        src = {k for k, v in sf.items() if v["group"] == group}
        dst = {k for k, v in tf.items() if v["group"] == group}
        prev = previous["groups"][group]
        groups[group] = {
            "priorSourceFiles": prev["sourceFiles"],
            "priorSourceLines": prev["sourceLines"],
            "sourceFiles": len(src),
            "sourceLines": sum(sf[k]["lines"] for k in src),
            "newSourceFiles": len({k for k in src if k not in old_files
                                  or old_files[k]["sourceLines"] is None}),
            "removedSourceFiles": len({k for k, v in old_files.items()
                                      if v["group"] == group and v["sourceLines"] is not None
                                      and k not in src}),
            "sourceChangedSincePrior": len(src & changed_source),
            "priorTargetFiles": prev["targetFiles"],
            "priorTargetLines": prev["targetLines"],
            "targetFiles": len(dst),
            "targetLines": sum(tf[k]["lines"] for k in dst),
            "targetAddedSincePrior": len({k for k in dst if k not in old_files
                                          or old_files[k]["targetLines"] is None}),
            "targetChangedSincePrior": len(dst & changed_target),
            "matchedPaths": len(src & dst),
            "sourceOnly": len(src - dst),
            "targetOnly": len(dst - src),
            "exactBlobMatches": sum(sf[k]["hash"] == tf[k]["hash"] for k in src & dst),
        }
        for k in sorted(src | dst):
            s, t, prior = sf.get(k), tf.get(k), old_files.get(k, {})
            rows.append({
                "group": group, "path": k,
                "priorSourceLines": prior.get("sourceLines"),
                "sourceLines": s["lines"] if s else None,
                "sourceChangedSincePrior": k in changed_source,
                "newSourceFile": s is not None and prior.get("sourceLines") is None,
                "sourceDiffLines": stat.get(k),
                "priorTargetLines": prior.get("targetLines"),
                "targetLines": t["lines"] if t else None,
                "targetChangedSincePrior": k in changed_target,
                "exactContentMatch": bool(s and t and s["hash"] == t["hash"]),
                "status": ("target_only_preserve" if not s else
                           "source_only_review_route_or_dependency" if not t else
                           "exact_blob_match_verify_behavior" if s["hash"] == t["hash"] else
                           "jsx_visual_and_firebase_behavior_review_required"),
            })
    commits = [v.split("\t", 1) for v in git(
        source, "log", "--format=%h%x09%s",
        old_source + ".." + source_commit).splitlines()]
    delta = [row for row in rows if row["sourceChangedSincePrior"]]
    new_source = [row for row in rows if row["newSourceFile"]]
    target_new = [row for row in rows if row["targetLines"] is not None
                  and row["priorTargetLines"] is None]
    source_all_changes = git(source, "diff", "--name-only",
                             old_source + ".." + source_commit).splitlines()
    notes = {
        "sourceChangedFilesAllExtensions": len(source_all_changes),
        "sourceChangedJsxFiles": len(delta),
        "newSourceJsxFiles": len(new_source),
        "targetNewJsxFilesSincePrior": len(target_new),
        "sourceNonJsxChangesByFamily": dict(sorted(collections.Counter(
            "/".join(path.split("/")[:2]) for path in source_all_changes
            if not path.startswith(source_prefix + "/")).items())),
        "sourceRouteFileChanged": any(
            v == source_prefix + "/PortRoutes.jsx" for v in source_all_changes),
        "sourceCommittedApp": "apps/lk-shop" if any(
            v.startswith("apps/lk-shop/") for v in source_all_changes) else None,
    }
    result = {
        "capturedAt": args.output_date,
        "method": "Physical UTF-8 committed JSX line counts, blanks included; direct pages/"
                  " and components/ and remaining JSX under React port root. Lines and"
                  " names never prove visual or behavioral parity.",
        "source": {"repository": previous["source"]["repository"],
                   "branch": source_branch, "commit": source_commit, "root": source_prefix},
        "target": {"repository": previous["target"]["repository"],
                   "branch": target_branch, "commit": target_commit, "root": target_prefix},
        "priorSourceCommit": old_source, "priorTargetCommit": old_target,
        "sourceCommitsSincePrior": len(commits),
        "sourceCommits": [{"commit": c[0], "subject": c[1]} for c in commits],
        "groups": groups, "delta": notes, "files": rows,
    }
    docs = target / "docs"
    path = docs / ("LUKKAJA_BANKALERT_STRIPE_JSX_AUDIT_" +
                   args.output_date.replace("-", "") + ".json")
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")

    def total(field):
        return sum(groups[k][field] for k in ("pages", "components", "other"))
    table = [
        "| Group | Prior Source | New Source | Source Δ lines | Target current | Matched names | Source only | Target only | Changed Source |",
        "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ]
    for g, v in groups.items():
        table.append(
            f"| {g} | {v['priorSourceFiles']} / {v['priorSourceLines']:,} |"
            f" **{v['sourceFiles']} / {v['sourceLines']:,}** |"
            f" {v['sourceLines'] - v['priorSourceLines']:+,} |"
            f" **{v['targetFiles']} / {v['targetLines']:,}** |"
            f" {v['matchedPaths']} | {v['sourceOnly']} | {v['targetOnly']} |"
            f" {v['sourceChangedSincePrior']} |")
    table.append(
        f"| **Total** | **{total('priorSourceFiles')} / {total('priorSourceLines'):,}** |"
        f" **{total('sourceFiles')} / {total('sourceLines'):,}** |"
        f" **{total('sourceLines')-total('priorSourceLines'):+,}** |"
        f" **{total('targetFiles')} / {total('targetLines'):,}** |"
        f" **{total('matchedPaths')}** | **{total('sourceOnly')}** |"
        f" **{total('targetOnly')}** | **{total('sourceChangedSincePrior')}** |")
    lines = [
        "# LUKKAJA BankAlert Stripe → PENGUIN: refreshed JSX inventory (" +
        args.output_date + ")", "",
        f"**Source (read-only):** `cosmatch/lukkhaja` `{source_branch}` `{source_commit}`",
        f"**Destination:** `Natchanon45/food-order-app` `{target_branch}` `{target_commit}`",
        f"**Previous Source audit:** `{old_source}`. **New Source commits:** {len(commits)}.",
        f"**Previous target audit:** `{old_target}`. These are counts at the pinned commits, not tests of JSX parity.",
        "", "## Latest numbers", "", *table, "",
        f"Source JSX net change: **{total('sourceLines')-total('priorSourceLines'):+,} lines**"
        f" across {len(delta)} changed JSX files, including **{len(new_source)} newly added JSX files**.",
        f"Target now has **{len(target_new)} additional JSX files** compared with the previous audit.",
        "Do not interpret source-only names, unmatched bodies or line difference as a"
        " confirmed unimplemented feature; route usage and Firebase actions require"
        " manual verification.", "",
        "## Source commits included in this refresh", "",
        *[f"- `{c['commit']}` — {c['subject']}" for c in result["sourceCommits"]],
        "", "## Changed Source JSX since previous audit (exact file delta)", "",
        "| Source path | Previous LOC | Current LOC | Δ LOC | Added / removed lines | Target current LOC | Review |",
        "|---|---:|---:|---:|---:|---:|---|",
    ]
    for r in sorted(delta, key=lambda row: (row["group"], row["path"])):
        old, new, present = r["priorSourceLines"] or 0, r["sourceLines"], r["targetLines"]
        stat = r["sourceDiffLines"] or {}
        lines.append(f"| `{r['path']}` | {r['priorSourceLines'] if r['priorSourceLines'] is not None else '—'} "
                     f"| {new} | {new-old:+} |"
                     f" +{stat.get('added',0)} / -{stat.get('deleted',0)} |"
                     f" {present if present is not None else '—'} |"
                     f" {'New dependency: inventory first' if r['newSourceFile'] else 'Compare UI and behavior'} |")
    lines += [
        "", "## Source-only JSX names (evaluate route/usage, not blindly copy)", "",
        *[f"- `{r['path']}` — {r['sourceLines']} lines" for r in rows
          if r["sourceLines"] is not None and r["targetLines"] is None],
        "", "## New JSX files in Firebase destination since previous audit", "",
        *[f"- `{r['path']}` — {r['targetLines']} lines" for r in target_new],
        "", "## Per-file current JSX LOC", "",
        "| File | Group | Old Source LOC | Source current LOC | Old Target LOC | Target current LOC | Changed Source | Exact JSX bytes |",
        "|---|---|---:|---:|---:|---:|---|---|",
    ]
    for row in rows:
        fmt = lambda key: row[key] if row[key] is not None else "—"
        lines.append(
            f"| `{row['path']}` | {row['group']} | {fmt('priorSourceLines')} |"
            f" {fmt('sourceLines')} | {fmt('priorTargetLines')} |"
            f" {fmt('targetLines')} |"
            f" {'yes' if row['sourceChangedSincePrior'] else 'no'} |"
            f" {'yes' if row['exactContentMatch'] else 'no'} |")
    lines += [
        "", "## Scope and safety", "",
        "- New Source includes **LK Shop Flutter mobile app** and Go FCM/QR pairing endpoints;"
        " these are outside JSX LOC and need a separate Firebase-side FCM/mobile contract, not copy/paste of Go/SQL or Android binaries.",
        "- Latest customer order-success UI changes payment badges, card grouping,"
        " mobile icon controls and a Stripe Sandbox build flag. Their presentation"
        " must be compared for PC/mobile, but must never infer Paid from a badge.",
        "- New `LKShopPairingPanel` has role-scoped room selection, QR expiry/revoke"
        " and device listing. No Firebase implementation may activate FCM/device"
        " pairing until Auth, tenant scope, revocation and replay tests pass.",
        "- No new Source page file or `PortRoutes.jsx` change occurred in this delta."
        " Existing 65 page-file phase scopes remain; 65 is *not* a route count.",
        "- New JSX in Target since last audit is not automatically accepted as Source parity."
        " Prior verified tests/financial hold gates must be preserved.",
        "- No Production deploy, Source write or arbitrary cross-repo merge is part of this refresh.",
        "", "Regenerate with `python3 tools/refresh_lukkaja_jsx_audit.py"
        " --source ../lukkhaja_bankalert_stripe --update-page-matrix` (source must be checked out at the intended commit).",
        "",
    ]
    md = path.with_suffix(".md")
    md.write_text("\n".join(lines), encoding="utf-8")

    if args.update_page_matrix:
        tracker_path = docs / "LUKKAJA_TO_PENGUIN_PAGE_MATRIX.json"
        tracker = json.loads(tracker_path.read_text(encoding="utf-8"))
        tracker.setdefault("historicalBaseline", {
            "source": dict(tracker["source"]), "target": dict(tracker["target"]),
            "counts": dict(tracker["counts"]), "capturedAt": tracker["capturedAt"],
        })
        tracker["source"].update({"branch": source_branch, "commit": source_commit})
        tracker["target"].update({"branch": target_branch, "commit": target_commit})
        tracker["capturedAt"] = args.output_date
        tracker["counts"] = {
            "sourcePageJsx": groups["pages"]["sourceFiles"],
            "destinationPageJsx": groups["pages"]["targetFiles"],
            "existingFilenameMatches": groups["pages"]["matchedPaths"],
            "sourceOnlyPageJsx": groups["pages"]["sourceOnly"],
            "sourceComponentJsx": groups["components"]["sourceFiles"],
            "destinationComponentJsx": groups["components"]["targetFiles"],
            "sourceOnlyComponentJsx": groups["components"]["sourceOnly"],
        }
        tracker["sourceOnlyComponents"] = [
            r["path"].split("/", 1)[1] for r in rows
            if r["group"] == "components" and r["sourceLines"] is not None
            and r["targetLines"] is None
        ]
        tracker["sourceEvolution"] = {
            "fromPriorPortSource": tracker["previousPortCandidate"]["sourceBaseline"],
            "toCurrentSource": source_commit,
            "aheadCommits": int(git(source, "rev-list", "--count",
                                    tracker["previousPortCandidate"]["sourceBaseline"] + ".." + source_commit)),
            "newSincePreviousJsxAudit": len(commits),
            "previousJsxAuditSource": old_source,
        }
        tracker["latestJsxAudit"] = str(md.relative_to(target))
        tracker["latestJsxAuditJson"] = str(path.relative_to(target))
        by_path = {r["path"]: r for r in rows}
        for item in tracker["pages"]:
            key = "pages/" + item["filename"]
            r = by_path.get(key)
            if not r:
                raise SystemExit("Page tracker drift: " + key)
            item["inventoryCurrent"] = {
                "sourceLines": r["sourceLines"],
                "targetLines": r["targetLines"],
                "sourceChangedSincePreviousAudit": r["sourceChangedSincePrior"],
                "sourceCommit": source_commit,
                "targetCommit": target_commit,
            }
        tracker_path.write_text(json.dumps(tracker, ensure_ascii=False, indent=2) + "\n",
                                encoding="utf-8")
    print("Source SHA:", source_commit, "Target SHA:", target_commit)
    print("Changed JSX:", len(delta), "New Source JSX:", len(new_source),
          "New Target JSX:", len(target_new))
    for g, row in groups.items():
        print(g, row["sourceFiles"], row["sourceLines"],
              "target", row["targetFiles"], row["targetLines"],
              "sourceOnly", row["sourceOnly"])
    print("WROTE", md.name, path.name)


if __name__ == "__main__":
    main()
