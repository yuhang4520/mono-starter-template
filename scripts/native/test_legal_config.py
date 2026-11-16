import unittest

from legal_config import legal_configuration, public_https_url


class LegalConfigurationTests(unittest.TestCase):
    def test_rejects_default_local_private_and_non_https_urls(self):
        invalid = ["", "http://legal.acme.app/privacy", "https://admin.example.com/privacy",
                   "https://EXAMPLE.NET./privacy", "https://localhost/privacy", "https://foo.localhost/privacy",
                   "https://127.0.0.1/privacy", "https://[::1]/privacy", "https://10.0.0.8/privacy",
                   "https://192.168.1.1/privacy", "https://2130706433/privacy", "https://127.1/privacy",
                   "https://foo.test/privacy", "https://legal.acme.app./privacy", "https://" + "a" * 64 + ".app/privacy", "https://user:pass@legal.acme.app/privacy",
                   "https://legal.acme.app/\nprivacy", "https://legal.acme.app/\"bad", "https://legal.acme.app:bad/privacy"]
        for value in invalid:
            with self.subTest(value=value), self.assertRaises(ValueError):
                public_https_url(value, "PRIVACY_URL")

    def test_published_clients_require_both_urls_and_explicit_version(self):
        env = dict(VITE_PRIVACY_URL="https://legal.acme.app/privacy", VITE_AGREEMENT_URL="https://legal.acme.app/user", VITE_LEGAL_VERSION="2026.11")
        self.assertEqual(legal_configuration(env), env)
        for key in env:
            with self.subTest(key=key), self.assertRaises(ValueError):
                legal_configuration({**env, key: ""})
        for version in [" ", "1\n", "1/2", "a" * 65]:
            with self.subTest(version=version), self.assertRaises(ValueError):
                legal_configuration({**env, "VITE_LEGAL_VERSION": version})
