"""Validate an IPA before publishing it as a build artifact or uploading it."""
import argparse
import plistlib
import re
import zipfile


def validate_ipa(path, expected_bundle=None, expected_version=None, expected_build=None):
    with zipfile.ZipFile(path) as archive:
        bad_entry = archive.testzip()
        if bad_entry:
            raise ValueError(f"Corrupt IPA entry: {bad_entry}")
        app_plists = [name for name in archive.namelist()
                      if re.fullmatch(r"Payload/[^/]+\.app/Info\.plist", name)]
        if len(app_plists) != 1:
            raise ValueError("IPA must contain exactly one Payload/*.app/Info.plist")
        info = plistlib.loads(archive.read(app_plists[0]))
        if not isinstance(info, dict) or not info.get("CFBundleIdentifier"):
            raise ValueError("IPA app Info.plist has no bundle identifier")
        for field, expected in (("CFBundleIdentifier", expected_bundle), ("CFBundleShortVersionString", expected_version), ("CFBundleVersion", expected_build)):
            if expected is not None and str(info.get(field)) != str(expected):
                raise ValueError(f"IPA {field} does not match the requested build")
        executable = info.get("CFBundleExecutable")
        app_directory = app_plists[0].rsplit("/", 1)[0]
        if not executable or f"{app_directory}/{executable}" not in archive.namelist():
            raise ValueError("IPA app executable is missing")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path")
    args = parser.parse_args()
    try:
        validate_ipa(args.path)
    except (OSError, ValueError, zipfile.BadZipFile, RuntimeError) as error:
        parser.exit(1, f"Invalid IPA: {error}\n")
    print("IPA archive and app payload validated")
