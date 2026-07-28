# Internet content-source audit

Audited 2026-07-28. "Free to access" is not treated as permission to copy, scrape, bundle, or redistribute.

| Source | Scale / claim | Reuse finding | Decision |
|---|---:|---|---|
| College Board Student Question Bank and released tests | Thousands / official | Personal access only; official test pages prohibit unauthorized copying or reuse. | External or user-authorized local import only. |
| PrepArc | 2,381 original questions | Terms reserve ownership, prohibit bulk scraping, and grant only a personal, revocable use license. | Do not scrape or bundle. |
| OnePrep | 4,000+ questions | Terms prohibit scraping, downloading, copying, and derivative use without written permission. | Do not scrape or bundle. |
| Easy1600 | 98 questions | Free access is stated, but no transferable content license was located. | Do not scrape or bundle. |
| OpenSAT / PineSAT | Public JSON database | Its license claims broad database use, but its showcased record is word-for-word from College Board Practice Test 10, so clean upstream rights are not established. Independent reporting also identifies a high error rate. | Do not bundle; native local conversion is supported with validation and known-record rejection. |
| Other free commercial practice sites | Varies | "Free" describes price, not reuse rights. | Use only through their services unless written permission is obtained. |
| Wikimedia Commons SAT-like grid-in example | One asset | CC BY-SA 4.0 with attribution and share-alike obligations. | Eligible as a supplemental attributed example, not a scalable bank. |
| Open educational resources such as OpenStax | Large general math libraries | Explicit Creative Commons terms can permit adaptation with attribution, but the material is not Digital-SAT calibrated. | Suitable as input to reviewed original generators, not as an SAT item bank. |

## Release rule

A third-party item can enter the bundled bank only when all of the following are documented per item or collection:

1. The rights holder grants copying and redistribution, not merely access.
2. The source has a traceable original author and does not mirror College Board or another publisher.
3. Required attribution and share-alike terms are satisfied.
4. The item passes correctness, ambiguity, distractor, and SAT-style review.
5. Its license remains compatible with public GitHub distribution.

Until then, the app uses original procedural templates or the local-only authorized importer.
