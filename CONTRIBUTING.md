# Contributing to ecollect SDK

Thank you for your interest in contributing to the ecollect SDK!

## Getting Started

1. Fork the repository and clone your fork.
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Install dependencies for the SDK you are working on (see below).
4. Make your changes, add tests, and ensure all tests pass.
5. Push your branch and open a Pull Request using the provided template.

## Repository Structure

```
ecollect-sdk/
  packages/
    typescript/   # Node.js / browser SDK (npm)
    php/          # PHP SDK (Composer)
    kotlin/       # Android SDK (Gradle)
    swift/        # iOS SDK (Swift Package Manager)
    python/       # Python SDK (pip)
```

## Development by SDK

### TypeScript
```bash
cd packages/typescript
npm ci
npm test
npm run build
```

### PHP
```bash
cd packages/php
composer install
./vendor/bin/phpunit
```

### Kotlin
```bash
cd packages/kotlin
./gradlew test
```

### Swift
```bash
cd packages/swift
swift test
```

### Python
```bash
cd packages/python
pip install -e ".[dev]"
pytest
```

## Code Style

- **TypeScript**: ESLint with project config (`npm run lint`)
- **PHP**: PSR-12
- **Kotlin**: Kotlin official style guide
- **Swift**: Swift API Design Guidelines

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add retry logic to payments module
fix: handle null tokenId in tokens module
docs: update README with sandbox examples
test: add edge cases for webhook validation
```

## Pull Request Process

1. Ensure all CI checks pass.
2. Add or update tests for your changes.
3. Update CHANGELOG.md under `[Unreleased]`.
4. Request a review from a maintainer.

## Reporting Issues

Please use GitHub Issues. For security vulnerabilities, see [SECURITY.md](SECURITY.md).

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
