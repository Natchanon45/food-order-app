#!/usr/bin/env python3
"""Prepare a locally built Android UAT APK and its Hosting release metadata.
The filename is derived from the signed APK's own versionName/versionCode.
This script does not deploy or sign anything.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
apps = {
    "connect": ("PG Connect", "PG_Connect", "pairing_only", "com.natchanon45.penguin.lkconnect.production.debug"),
    "notify": ("PG Notify", "PG_Notify", "notification_uat", "com.natchanon45.penguin.lkshop"),
}
if len(sys.argv) != 3 or sys.argv[1] not in apps:
    raise SystemExit("Usage: publish-pg-android-apk.py connect|notify PATH_TO_BUILT_APK")
app, path = sys.argv[1:]
apk = Path(path).resolve()
label, prefix, mode, package = apps[app]
sdk = Path.home() / "Library/Android/sdk/build-tools/36.0.0"
subprocess.run([str(sdk/"apksigner"), "verify", str(apk)], check=True)
badging = subprocess.check_output([str(sdk/"aapt"), "dump", "badging", str(apk)], text=True)
actual_package = re.search(r"package: name='([^']+)'", badging)[1]
version = re.search(r"versionName='([^']+)'", badging)[1]
code = int(re.search(r"versionCode='(\d+)'", badging)[1])
assert actual_package == package, "Wrong Android app"
assert f"application-label:'{label}'" in badging, "Wrong app label"
assert re.fullmatch(r"\d+\.\d+\.\d+", version) and code > 0
name = f"{prefix}_V{version}_{code % 10000:04d}.apk"
out = ROOT / "public/downloads" / name
out.parent.mkdir(parents=True, exist_ok=True)
assert apk.stat().st_size < 95_000_000, "Use optimized universal UAT APK below repository size limit"
shutil.copyfile(apk, out)
data = dict(version=version, buildCode=code, mode=mode,
            path="/downloads/"+name, sha256=hashlib.sha256(out.read_bytes()).hexdigest(),
            sizeBytes=out.stat().st_size, signing="development")
data.update(notificationEnabled=False) if app == "connect" else data.update(pushCertified=False)
(ROOT / f"public/downloads/pg-{app}.json").write_text(json.dumps(data, indent=2)+"\n")
print(name, data["sizeBytes"], data["sha256"])
