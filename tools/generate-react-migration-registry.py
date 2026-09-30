import json
import os
import subprocess
from collections import Counter
from pathlib import Path

target = Path("/Users/natchanonsripleng/Desktop/Sites/food-order-app")
source = Path("/Users/natchanonsripleng/Desktop/Sites/food-order-app-php80")
routes = {}

def add(route, **meta):
    route = "/" if route in ("", "/", "/index.html", "index.html") else route.rstrip("/")
    row = routes.setdefault(route, {
        "route": route,
        "group": (route.strip("/").split("/")[0] if route != "/" else "home"),
        "firebaseHtml": None,
        "laravelView": None,
        "status": "pending",
        "target": "react",
    })
    for key, value in meta.items():
        if value is not None:
            row[key] = value

for html in (target / "public").rglob("index.html"):
    rel = html.relative_to(target / "public")
    if rel.parts and rel.parts[0] == "react":
        continue
    route = "/" if str(rel) == "index.html" else "/" + str(rel.parent).replace(os.sep, "/")
    add(route, firebaseHtml=str(rel))

php = subprocess.check_output([
    "php",
    "-r",
    '$x=require $argv[1]; echo json_encode($x,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);',
    str(source / "config/migrated-pages.php"),
], text=True)

for route, view in json.loads(php).items():
    add(route, laravelView=view)

for route in ["/waiting-queue", "/waiting-queue/display", "/waiting-queue/customer", "/cashier/waiting-queue"]:
    add(route)

aliases = [
    {"routePattern": "/s/:tenant/delivery", "canonical": "/delivery"},
    {"routePattern": "/s/:tenant/delivery/success", "canonical": "/delivery/success"},
    {"routePattern": "/s/:tenant/takeaway", "canonical": "/takeaway"},
    {"routePattern": "/s/:tenant/order", "canonical": "/order"},
]

data = {
    "source": {
        "firebaseRepo": "food-order-app",
        "laravelRepo": "food-order-app-php80",
        "laravelBaseline": "29e3ad71",
    },
    "policy": {
        "uiParity": "1:1",
        "redesignAllowed": False,
        "replaceLegacyHtmlJs": True,
        "firebaseHostingRequired": True,
        "preserveExistingUrls": True,
    },
    "routes": sorted(routes.values(), key=lambda item: item["route"]),
    "aliases": aliases,
}

out = target / "react-app/migration/master-registry.json"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")

print("registry routes:", len(data["routes"]))
print("groups:", dict(sorted(Counter(item["group"] for item in data["routes"]).items())))
