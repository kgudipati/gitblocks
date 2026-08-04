# Capability taxonomy 1.0.0

This directory contains the reviewed source and generated product authority for
the five private-alpha capability families. It controls vocabulary only; it
does not classify catalog candidates, parse user queries, retrieve candidates,
or rank results.

- `source.json` is the human-reviewed semantic source.
- `manifest.json` is the canonically ordered generated authority consumed by
  product contracts.
- `pnpm taxonomy:validate` regenerates the expected authority in memory,
  validates its closed structure and semantic invariants, and compares exact
  bytes without writing.
- `pnpm taxonomy:generate` is the explicit maintainer command that writes only
  `manifest.json` from `source.json`.

The generated authority contains 85 concepts, 135 resolved aliases, 8
intentional ambiguity records, and 25 adjacent or excluded term records. Two
resolved aliases are deprecated. The semantic digest is
`0339c200098cfecebc493e4216df00ef55730f22a87e77a039530a0571006b5d`.

Canonical concept IDs and lookup keys use only lowercase ASCII letters,
digits, and hyphens and are at most 64 characters. Display labels are bounded
presentation data. Lookup is exact: this authority performs no case folding,
stemming, fuzzy matching, transliteration, Unicode normalization, or
confusable merging. An ambiguity record is valid controlled authority rather
than an alias collision; it never resolves to a concept and a later query
boundary must request clarification.

The parent relation is a bounded forest used only for genuine hierarchy.
Cross-family applicability is represented by one shared concept with multiple
family IDs. The reviewed limits are 256 concepts, 512 resolved aliases, 64
ambiguities, 128 exclusions, and eight hierarchy levels. Validation rejects
cycles, missing parents, incompatible family membership, duplicate semantics,
term-class overlap, invalid deprecation chains, and noncanonical generated
ordering.

`releaseMetadata` is copied into the generated file but is the sole approved
non-semantic payload excluded from the digest. The digest otherwise covers the
contract version, taxonomy version, concepts, aliases, ambiguities, and
exclusions. No clock, locale, filesystem enumeration order, environment value,
provider, model, database, repository artifact, or candidate text participates
in generation.
