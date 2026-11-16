"""Validate public legal documents before releasing any client platform."""
import ipaddress
import os
import re
from urllib.parse import urlsplit


def public_https_url(value, name):
    if not value or re.search(r'[\s<>"\'\\]', value):
        raise ValueError(f"{name} must be a public HTTPS URL")
    try:
        parsed = urlsplit(value)
        host = (parsed.hostname or "").lower()
        port = parsed.port
    except ValueError:
        raise ValueError(f"Invalid {name}") from None
    if not value.startswith("https://") or parsed.scheme != "https" or not host or parsed.username is not None or parsed.password is not None or port == 0:
        raise ValueError(f"{name} must be a public HTTPS URL without credentials")
    reserved = ("localhost", "local", "internal", "test", "invalid", "example", "example.com", "example.net", "example.org")
    if any(host == suffix or host.endswith("." + suffix) for suffix in reserved):
        raise ValueError(f"{name} cannot use a local or example domain")
    try:
        ipaddress.ip_address(host)
    except ValueError:
        # Require a fully-qualified domain; reject shorthand/numeric loopback forms.
        if len(host) > 253 or not re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", host):
            raise ValueError(f"{name} must use a public domain") from None
    else:
        # Legal pages and API endpoints use public DNS names, matching the client validator.
        raise ValueError(f"{name} must use a public domain, not an IP literal")
    return value


def legal_configuration(env):
    config = {key: public_https_url(env.get(key, ""), key) for key in ("VITE_PRIVACY_URL", "VITE_AGREEMENT_URL")}
    version = env.get("VITE_LEGAL_VERSION", "")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", version):
        raise ValueError("VITE_LEGAL_VERSION must be an explicit release version")
    config["VITE_LEGAL_VERSION"] = version
    return config


if __name__ == "__main__":
    if os.environ.get("VITE_DEPLOY_ENV") != "production":
        raise ValueError("Published clients must set VITE_DEPLOY_ENV=production")
    legal_configuration(os.environ)
    public_https_url(os.environ.get("VITE_SERVER_URL", ""), "VITE_SERVER_URL")
    print("Public legal URLs and consent version verified.")
