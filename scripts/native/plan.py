"""Validate the optional Android package variants before expanding a CI matrix."""
import json
import os
import re


def plan(value):
    targets = json.loads(value)
    if not isinstance(targets, list) or not 1 <= len(targets) <= 5:
        raise ValueError("ANDROID_VARIANTS_JSON must contain 1 to 5 variants")
    names = set()
    bundles = set()
    for item in targets:
        if not isinstance(item, dict) or set(item) != {"name", "bundle"}:
            raise ValueError("Each Android variant must have name and bundle")
        if not isinstance(item["name"], str) or not re.fullmatch(r"[a-z0-9-]{1,40}", item["name"]):
            raise ValueError("Invalid variant name")
        if item["name"] in names:
            raise ValueError("Variant names must be unique")
        names.add(item["name"])
        if not isinstance(item["bundle"], str) or not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+", item["bundle"]):
            raise ValueError("Invalid Android bundle identifier")
        if item["bundle"] in bundles:
            raise ValueError("Android bundle identifiers must be unique")
        bundles.add(item["bundle"])
    return targets


if __name__ == "__main__":
    result = plan(os.environ["ANDROID_VARIANTS_JSON"])
    with open(os.environ["GITHUB_OUTPUT"], "a") as output:
        output.write("targets=" + json.dumps(result, separators=(",", ":")) + "\n")
