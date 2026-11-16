"""Read the compiled APK manifest with Android SDK tools before publication."""
import subprocess
import zipfile


def validate_apk(path, bundle_id, version, version_code):
    with zipfile.ZipFile(path) as archive:
        if archive.testzip():
            raise ValueError("Corrupt APK archive")
        names = set(archive.namelist())
        if "AndroidManifest.xml" not in names or "classes.dex" not in names:
            raise ValueError("APK must contain AndroidManifest.xml and classes.dex")
        if not archive.read("AndroidManifest.xml") or not archive.read("classes.dex"):
            raise ValueError("APK payload is empty")
    expected = {"application-id": bundle_id, "version-name": version, "version-code": version_code}
    for field, value in expected.items():
        if value is None or not str(value).strip():
            raise ValueError(f"Missing expected APK {field}")
        try:
            result = subprocess.run(
                ["apkanalyzer", "manifest", field, str(path)],
                check=True, capture_output=True, text=True, timeout=30,
            )
        except (OSError, subprocess.SubprocessError):
            # Missing tools, invalid binary XML and hung parsers must all fail closed.
            raise ValueError(f"Cannot inspect APK {field}; Android SDK apkanalyzer is required") from None
        if result.stdout.strip() != str(value):
            raise ValueError(f"APK {field} does not match expected release")
