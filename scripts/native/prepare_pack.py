"""Prepare cloud packaging from environment values, without printing signing material."""
import base64
import json
import os
from pathlib import Path
import re
from html import escape

from legal_config import legal_configuration


def required(env, key):
    value = env.get(key, "")
    if not value:
        raise ValueError(f"Missing {key}")
    return value


def write_private(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(descriptor, "wb") as output:
        os.fchmod(output.fileno(), 0o600)
        output.write(data)
    return str(path.resolve())


def prepare(env, root=Path(".")):
    root = Path(root).resolve()
    platform = required(env, "PACK_PLATFORM")
    if platform not in ("ios", "android"):
        raise ValueError("Invalid platform")
    bundle = required(env, "BUNDLE_ID")
    if not re.fullmatch(r"[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+", bundle):
        raise ValueError("Invalid BUNDLE_ID")
    appid = required(env, "DCLOUD_APP_ID")
    if not re.fullmatch(r"__UNI__[A-Za-z0-9]+", appid):
        raise ValueError("DCLOUD_APP_ID must be a registered __UNI__ id")
    legal = legal_configuration({f"VITE_{key}": required(env, key) for key in ("PRIVACY_URL", "AGREEMENT_URL", "LEGAL_VERSION")})
    for key, value in legal.items():
        if key in env and env[key] != value:
            raise ValueError(f"{key} does not match native legal configuration")
    project = root / "apps/app"
    manifest_path = project / "src/manifest.json"
    manifest = json.loads(manifest_path.read_text())
    version = required(env, "VERSION_NAME")
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("VERSION_NAME must contain three numeric components")
    code = int(required(env, "VERSION_CODE"))
    if not 0 < code < 2100000000:
        raise ValueError("VERSION_CODE out of Android range")
    manifest.update(appid=appid, name=required(env, "APP_NAME"), versionName=version, versionCode=code)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    privacy_path = project / "src/androidPrivacy.json"
    privacy = json.loads(privacy_path.read_text())
    privacy["version"] = legal["VITE_LEGAL_VERSION"]
    privacy["message"] = (f'请阅读<a href="{escape(legal["VITE_AGREEMENT_URL"], quote=True)}">《服务协议》</a>和'
                          f'<a href="{escape(legal["VITE_PRIVACY_URL"], quote=True)}">《隐私政策》</a>。同意后继续使用。')
    privacy_path.write_text(json.dumps(privacy, ensure_ascii=False, indent=2) + "\n")
    signing = Path(required(env, "SIGNING_DIR"))
    config = {"project": str(project), "platform": platform, "safemode": True,
              "iscustom": False, "isconfusion": False, "splashads": False,
              "rpads": False, "pushads": False, "exchange": False}
    if platform == "android":
        certificate = write_private(signing / "app.keystore", base64.b64decode(required(env, "ANDROID_KEYSTORE_BASE64"), validate=True))
        if not Path(certificate).stat().st_size:
            raise ValueError("Empty Android keystore")
        config["android"] = {"packagename": bundle, "androidpacktype": "0", "certalias": required(env, "ANDROID_KEY_ALIAS"),
                             "certfile": certificate, "certpassword": required(env, "ANDROID_KEY_PASSWORD"),
                             "storePassword": required(env, "ANDROID_KEYSTORE_PASSWORD"), "channels": ""}
    else:
        certificate = write_private(signing / "app.p12", base64.b64decode(required(env, "IOS_P12_BASE64"), validate=True))
        profile = write_private(signing / "app.mobileprovision", base64.b64decode(required(env, "IOS_PROFILE_BASE64"), validate=True))
        if not Path(certificate).stat().st_size or not Path(profile).stat().st_size:
            raise ValueError("Empty iOS signing file")
        config["ios"] = {"bundle": bundle, "supporteddevice": "iPhone,iPad", "profile": profile,
                         "certfile": certificate, "certpassword": required(env, "IOS_CERT_PASSWORD")}
    path = write_private(signing / "pack-config.json", json.dumps(config, ensure_ascii=False).encode())
    return path


if __name__ == "__main__":
    prepare(os.environ)
    print("Cloud packaging configuration prepared; signing values are not logged.")
