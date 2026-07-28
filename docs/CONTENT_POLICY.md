# Official-content policy

The repository does not scrape, bundle, or redistribute College Board question text. The official Student Question Bank, Bluebook practice tests, downloadable practice tests, explanations, and related assets remain College Board property. The repository records source metadata, while authorized material supplied by the user can remain in the on-device library unless the repository owner obtains a separate redistribution license.

The content layer distinguishes:

- **Procedural:** original templates that may ship with the application.
- **Official external:** a source link and metadata only; question content stays with College Board.
- **Authorized local:** material a user independently possesses and is authorized to use. It may be imported into local device storage but must not enter Git, exports intended for distribution, service-worker shared caches, analytics uploads, or generated public artifacts.

Every future content ingestion path must require provenance and pass the bundle-safety gate. Removing attribution or changing a license scope is a product-security violation, not a formatting change.

See `CONTENT_SOURCE_AUDIT.md` for the current broader internet source review and rejection reasons.

Official entry points:

- [Student Question Bank](https://satsuite.collegeboard.org/practice/student-question-bank)
- [Bluebook practice](https://bluebook.collegeboard.org/students/practice)
- [Official practice tests](https://satsuite.collegeboard.org/practice/practice-tests)
- [Current SAT testing rules and ownership terms](https://satsuite.collegeboard.org/sat/testing-rules)
