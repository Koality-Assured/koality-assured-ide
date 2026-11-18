# Security Policy

## Supported Versions

Only the latest release and `main` branch are supported for security updates.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |

## Telemetry & Privacy Guarantee

`koality-assured-ide` disables upstream telemetry (`enableTelemetry: false` in `product.json`) and removes Microsoft Marketplace, Application Insights, and crash-reporting endpoints. Extension queries route exclusively to the Eclipse Foundation's [Open VSX Registry](https://open-vsx.org/).

## Reporting a Vulnerability

Please report security vulnerabilities using GitHub's Private Vulnerability Reporting feature. Open the **Security** tab of this repository, select **Advisories**, and click **Report a vulnerability**. Do not open a public issue for a security vulnerability.
