#!/usr/bin/env python3
"""Read-only source inventory for source-first Firebase presentation rebase.
Does not copy source, mutate either Git checkout or mark visual acceptance.
"""
from pathlib import Path
import hashlib
import re
import subprocess
import sys

target = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]).expanduser().resolve() if len(sys.argv)>1 else target.parent/"lukkhaja"
src = source/"resources/js/react-port"
dst = target/"react-app/src"
assert (src/"pages").is_dir(), "Source checkout missing"
def git(cwd,*args):
    return subprocess.check_output(["git","-C",str(cwd),*args],text=True).strip()
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:12]
def stat(srcfile, candidates):
    for c in candidates:
        if c.is_file() and digest(c)==digest(srcfile):return "Exact",str(c.relative_to(target))
    for c in candidates:
        if c.is_file():return "Different",str(c.relative_to(target))
    return "Not copied","—"

lines=["# Source-first UI rebase inventory","",
       f"Source branch: `{git(source,'branch','--show-current')}`",
       f"Source commit: `{git(source,'rev-parse','HEAD')}`",
       "", "This is a dependency and byte-identity inventory, **not visual acceptance**. "
       "A different JSX file may be necessary for Firebase transport. Source-only extracts must be checked against actual Router use. "
       "Never use a target file as the presentation template for the rebase.","",
       "## Global Source entry stylesheet order","",
       "| # | Source stylesheet | SHA-256 prefix | Direct match in target |","|---:|---|---|---|"]
entry=(source/"resources/js/react-port-auth.jsx").read_text()
global_css=re.findall(r'^import\s+["\']([^"\']+\.css)["\'];',entry,re.M)
for i,rel in enumerate(global_css,1):
    f=(source/"resources/js"/rel).resolve()
    if not f.is_file():continue
    status,where=stat(f,[dst/"ui"/f.name,target/"react-app/public/parity/css"/f.name])
    lines.append(f"| {i} | `{f.name}` | `{digest(f)}` | {status}: {where} |")
lines+=["","An import-only Source wrapper can map to already present base CSS without being byte-identical; its full import chain and cascade order still require comparison.",
        "","## Source JSX pages","",
        "| Source page | SHA-256 prefix | Target file | Source page CSS imports |","|---|---|---|---|"]
pages=sorted((src/"pages").glob("*.jsx"))
present=0
for f in pages:
    t=dst/"pages"/f.name
    present+=t.is_file()
    status,_=stat(f,[t])
    css=re.findall(r'import\s+["\']([^"\']+\.css)["\'];',f.read_text(),re.M)
    lines.append(f"| `{f.name}` | `{digest(f)}` | {status} | "+(", ".join(Path(x).name for x in css) or "Entry/shared CSS")+" |")
lines+=["",f"Source pages: {len(pages)}; matching target filenames: {present}; source-only filenames: {len(pages)-present}.",
        "","## Rebase acceptance criteria","",
        "- Start from the complete Source presentation tree and ordered CSS dependencies; adapt Firebase data providers/commands, never invent replacement views.",
        "- Record deviations explicitly: branding, actual Firebase data/authorization, missing provider or billing capability. Do not present unavailable data as confirmed.",
        "- Check actual browser layout at desktop and mobile, empty/loading/error/filled states, dialog and responsive behavior; do not equate a build or file match with visual acceptance.",
        "- Deploy Hosting only after scoped verification. Backend schema, permissions and live payment changes are separate acceptance work.",""]
print("\n".join(lines))
