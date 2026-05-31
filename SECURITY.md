# Security Policy

## Supported Versions

| Version         | Supported |
| --------------- | --------- |
| 0.1.0-alpha.1   | Yes       |

## PCI DSS Compliance Notes

The ecollect SDK is designed to assist integrators in building PCI DSS-compliant payment flows:

- **No raw card data stored**: The SDK never logs or persists raw card numbers, CVVs, or expiry dates.
- **TLS enforced**: All API calls use HTTPS. Plaintext HTTP endpoints are rejected.
- **Tokenization**: Card data is tokenized via ecollect's secure vaulting; tokens are safe to store.
- **Sandbox isolation**: The sandbox module returns mock data only — it never reaches production servers.

Integrators are responsible for their own PCI DSS scope. Consult a Qualified Security Assessor (QSA) for certification guidance.

## Reporting a Vulnerability

If you discover a security vulnerability in this SDK, **do not open a public GitHub issue**.

Please report it via one of the following channels:

1. **Email**: security@ecollect.com  
   Include: description, affected SDK/version, reproduction steps, and potential impact.

2. **GitHub Security Advisories**: Use the "Report a vulnerability" button on the Security tab of this repository.

We aim to acknowledge reports within **48 hours** and provide a resolution timeline within **7 business days**.

## Responsible Disclosure

We follow a coordinated disclosure model:

1. You report the vulnerability privately.
2. We confirm receipt and investigate.
3. We develop and test a fix.
4. We release the fix and credit you (unless you prefer anonymity).
5. We publish a security advisory after the fix is deployed.

Thank you for helping keep ecollect SDK users safe.
