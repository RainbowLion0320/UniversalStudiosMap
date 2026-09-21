#!/usr/bin/env python3
"""Fetch a dated local research snapshot using only the Python standard library."""
import json
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
PARK_ID = "68e1d8f0-ed42-4351-af25-160421e37ce0"
BASE = f"https://api.themeparks.wiki/v1/entity/{PARK_ID}"


def main():
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    output = ROOT / "data" / "local" / stamp
    output.mkdir(parents=True)
    query = (ROOT / "data" / "beijing.overpassql").read_text()
    sources = {
        "entity": BASE,
        "children": BASE + "/children",
        "live": BASE + "/live",
        "schedule": BASE + "/schedule",
        "queue-times": "https://queue-times.com/parks/328/queue_times.json",
        "osm": "https://overpass-api.de/api/interpreter?" + urlencode({"data": query}),
    }
    manifest = {"startedAt": stamp, "sources": {}, "errors": {}}
    payloads = {}
    for name, url in sources.items():
        try:
            request = Request(url, headers={"User-Agent": "UniversalStudiosMap-Research/0.1"})
            with urlopen(request, timeout=40) as response:
                payload = json.load(response)
            if not isinstance(payload, dict):
                raise ValueError("Expected a JSON object")
            if payload.get("remark") or payload.get("error"):
                raise ValueError(str(payload.get("remark") or payload.get("error")))
            required = {"entity": "id", "children": "children", "live": "liveData",
                        "schedule": "schedule", "queue-times": "lands", "osm": "elements"}
            if required[name] not in payload:
                raise ValueError("Expected response field missing: " + required[name])
            (output / f"{name}.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
            payloads[name] = payload
            manifest["sources"][name] = {"url": url, "fetchedAt": datetime.now(timezone.utc).isoformat()}
            print(f"OK {name}", flush=True)
        except Exception as exc:
            manifest["errors"][name] = str(exc)
            print(f"FAILED {name}: {exc}", file=sys.stderr, flush=True)
    children = payloads.get("children", {}).get("children", [])
    live = payloads.get("live", {}).get("liveData", [])
    ways = [x for x in payloads.get("osm", {}).get("elements", []) if x.get("type") == "way" and "highway" in x.get("tags", {})]
    summary = {
        "children": len(children),
        "types": dict(Counter(x.get("entityType") for x in children)),
        "withLocation": sum(bool(x.get("location")) for x in children),
        "liveRecords": len(live),
        "standbyQueueRecords": sum("STANDBY" in x.get("queue", {}) for x in live),
        "showtimeRecords": sum(bool(x.get("showtimes")) for x in live),
        "scheduleDays": len(payloads.get("schedule", {}).get("schedule", [])),
        "bboxWalkingWays": len(ways) if "osm" in payloads else None,
        "walkingWayTags": dict(Counter(x["tags"]["highway"] for x in ways)),
        "note": "Bounding-box ways include surrounding areas; connectivity and public access are not validated. Coordinates retain source values; CRS and entrances need verification.",
    }
    manifest["summary"] = summary
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    print(f"Local snapshot: {output}")
    return 1 if manifest["errors"] else 0


if __name__ == "__main__":
    sys.exit(main())
