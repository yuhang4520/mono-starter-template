import base64
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from distribute import distribute


class SigningCleanupTests(unittest.TestCase):
    def test_testflight_does_not_overwrite_or_delete_existing_signing_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / '.appstoreconnect/private_keys/AuthKey_ABC1234567.p8'
            key.parent.mkdir(parents=True)
            key.write_bytes(b'preinstalled private key')
            env = dict(DESTINATION='testflight', ASC_KEY_ID='ABC1234567', ASC_ISSUER_ID='a' * 36, ASC_API_KEY_BASE64=base64.b64encode(b'new private key').decode())
            with patch('distribute.verify', return_value=({'platform': 'ios'}, root / 'app.ipa')), patch('distribute.Path.home', return_value=root), patch('distribute.subprocess.run') as upload:
                with self.assertRaises(FileExistsError):
                    distribute(env)
                upload.assert_not_called()
            self.assertEqual(key.read_bytes(), b'preinstalled private key')

    def test_failed_testflight_upload_removes_only_its_temporary_key(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / '.appstoreconnect/private_keys/AuthKey_ABC1234567.p8'
            env = dict(DESTINATION='testflight', ASC_KEY_ID='ABC1234567', ASC_ISSUER_ID='a' * 36, ASC_API_KEY_BASE64=base64.b64encode(b'new private key').decode())
            with patch('distribute.verify', return_value=({'platform': 'ios'}, root / 'app.ipa')), patch('distribute.Path.home', return_value=root), patch('distribute.subprocess.run', side_effect=subprocess.CalledProcessError(1, 'altool')):
                with self.assertRaises(subprocess.CalledProcessError):
                    distribute(env)
            self.assertFalse(key.exists())

    def test_native_cleanup_survives_redactor_failure_and_preserves_original_exit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            scripts = root / 'scripts/native'
            scripts.mkdir(parents=True)
            source = Path(__file__).parent
            for name in ['package.sh', 'legal_config.py']:
                shutil.copyfile(source / name, scripts / name)
            binaries = root / 'bin'
            binaries.mkdir()
            python = binaries / 'python3'
            python.write_text('#!/bin/sh\nif [ "$1" = "-c" ]; then exit 7; fi\nexec "' + sys.executable + '" "$@"\n')
            python.chmod(0o755)
            curl = binaries / 'curl'
            curl.write_text('#!/bin/sh\nmkdir -p "$SIGNING_DIR"\necho private > "$SIGNING_DIR/app.keystore"\necho raw-private-log > pack_output.log\nexit 9\n')
            curl.chmod(0o755)
            env = dict(os.environ, PATH=str(binaries) + os.pathsep + os.environ['PATH'], HX_VERSION='4.1.1', HX_SHA256='a' * 64,
                       VITE_SERVER_URL='https://api.product.cn', PRIVACY_URL='https://legal.product.cn/privacy', AGREEMENT_URL='https://legal.product.cn/user', LEGAL_VERSION='2',
                       GITHUB_WORKSPACE=str(root), RUNNER_TEMP=str(root / 'temp'), TARGET_NAME='test', GITHUB_RUN_NUMBER='23', GITHUB_RUN_ATTEMPT='2')
            result = subprocess.run(['bash', str(scripts / 'package.sh')], cwd=root, env=env, capture_output=True, text=True, timeout=5)
            self.assertEqual(result.returncode, 9, result.stdout + result.stderr)
            self.assertFalse((root / 'temp/native-signing-test').exists())
            self.assertFalse((root / 'pack_output.log').exists())
            self.assertNotIn('raw-private-log', result.stdout + result.stderr)
