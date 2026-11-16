"""Optional S3-compatible distribution or TestFlight upload, after artifact verification."""
import base64
import os
from pathlib import Path
import re
import subprocess

from client_release import storage_args
from verify_distribution import verify


def distribute(env):
    metadata, package = verify(env)
    destination = env["DESTINATION"]
    if destination == "s3":
        endpoint, root = storage_args(env)
        path = f'{root}/{metadata["platform"]}/{metadata["target"]}/{metadata["version"]}/{metadata["runAttempt"]}'
        subprocess.run(["aws", *endpoint, "s3", "cp", str(package), f"{path}/{package.name}", "--cache-control", "public,max-age=31536000,immutable"], check=True)
        subprocess.run(["aws", *endpoint, "s3", "cp", "release/metadata.json", f"{path}/metadata.json", "--cache-control", "no-cache"], check=True)
        # No mutable latest pointer: distributing an older verified run cannot silently downgrade users.
    elif destination == "testflight":
        if metadata["platform"] != "ios":
            raise ValueError("TestFlight requires an iOS artifact")
        keyid = env.get("ASC_KEY_ID", "")
        issuer = env.get("ASC_ISSUER_ID", "")
        if not re.fullmatch(r"[A-Z0-9]{8,20}", keyid) or not re.fullmatch(r"[a-fA-F0-9-]{36}", issuer):
            raise ValueError("Invalid App Store Connect key id or issuer")
        path = Path.home() / ".appstoreconnect/private_keys" / f"AuthKey_{keyid}.p8"
        path.parent.mkdir(parents=True, exist_ok=True)
        created = False
        try:
            data = base64.b64decode(env["ASC_API_KEY_BASE64"], validate=True)
            # Never overwrite or remove a signing key preinstalled on a runner.
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            created = True
            with os.fdopen(descriptor, "wb") as key_file:
                key_file.write(data)
            subprocess.run(["xcrun", "altool", "--upload-app", "--type", "ios", "--file", str(package),
                            "--apiKey", keyid, "--apiIssuer", issuer], check=True, timeout=900)
        finally:
            if created:
                path.unlink(missing_ok=True)
    else:
        raise ValueError("Unsupported distribution destination")


if __name__ == "__main__":
    distribute(os.environ)
