"""Remove signing values and signed URL query strings from public diagnostics."""
import json
import os
from pathlib import Path
import re


def sensitive_values(config=None, env=None):
    values = []
    for key, value in (env or os.environ).items():
        if re.search(r"password|secret|token|private|base64|username|alias", key, re.I) and value:
            values.append(value)
    if config and Path(config).is_file():
        def walk(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if re.search(r"password|secret|alias", key, re.I) and isinstance(item, str):
                        values.append(item)
                    else:
                        walk(item)
        walk(json.loads(Path(config).read_text()))
    return values


def public_log(text, values=()):
    for value in sorted(values, key=len, reverse=True):
        if value:
            text = text.replace(value, "[REDACTED]")
            text = text.replace(json.dumps(value)[1:-1], "[REDACTED]")
    return re.sub(r"(https?://[^\s?]+)\?[^\s]+", r"\1?[REDACTED]", text)


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file")
    parser.add_argument("--config")
    args = parser.parse_args()
    print(public_log(Path(args.file).read_text(errors="replace"), sensitive_values(args.config)), end="")
