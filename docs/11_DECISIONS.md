# 11 — Architecture and Implementation Decision Register

**Project:** AI-Powered Textbook-to-Video Learning & Student Performance Platform  
**Version:** 1.0  
**Status:** Proposed Decision Register — Pending Review

## 1. Purpose
Record material decisions and unresolved choices so provisional implementation details are not mistaken for approved requirements. Approved project documents remain authoritative.

## 2. Status definitions
- **Confirmed baseline:** Explicitly established by approved documentation.
- **Needs decision:** Choice remains open.
- **Proposed for implementation:** Reversible engineering choice suggested to make progress; not an approved product decision until accepted and recorded.
- **Deferred:** Not needed for the current MVP increment.

## 3. Confirmed constraints

| ID | Constraint | Status | Notes |
|---|---|---|---|
| DEC-001 | Admin portal domain `admin.example.com` | Confirmed baseline | Use local development URLs until deployment is configured. |
| DEC-002 | Student portal domain `learn.example.com` | Confirmed baseline | Use local development URLs until deployment is configured. |
| DEC-003 | Initial content pipeline has Stages 1–5 | Confirmed baseline | PDF ingestion/OCR, hierarchy extraction, segmentation, script/video generation, quiz generation. |
| DEC-004 | Stage 6 adaptation occurs after publication | Confirmed baseline | Uses recorded student performance to target weak concepts. |
| DEC-005 | Administrator review/approval is mandatory before publication | Confirmed baseline | Pending-review content must not be available to students. |
| DEC-006 | Videos are pre-rendered | Confirmed baseline | Playback must not initiate video generation or alter the published video. |
| DEC-007 | Parent/teacher dashboards are read-only summaries | Confirmed baseline | Limit access to authorized progress and mastery summaries. |
| DEC-008 | Listed technology choices are unresolved unless another approved document explicitly settles them | Confirmed baseline | Separate implementation proposals from requirements. |

## 4. Open technology decisions

| ID | Decision | Status | Considerations |
|---|---|---|---|
| DEC-010 | FastAPI vs Express | Needs decision | Existing repository, team skills, API design, testing, operations. |
| DEC-011 | Tesseract vs Azure Form Recognizer | Needs decision | PDF quality, scanned pages, language support, accuracy, privacy, cost. |
| DEC-012 | OpenAI vs Anthropic | Needs decision | Quality, structured outputs, privacy, cost, latency, rate limits. |
| DEC-013 | Runway, Pictory, or custom video synthesis | Needs decision | Output needs, API availability, licensing, render time, cost, asset ownership. |
| DEC-014 | AWS S3 vs Azure Blob Storage | Needs decision | Hosting fit, access control, lifecycle policies, cost. |
| DEC-015 | PostgreSQL and optional vector store | Needs decision | PostgreSQL is a candidate, not a confirmed selection; justify any vector store use. |
| DEC-016 | Hosting provider and deployment topology | Needs decision | Cost, region, networking, workers, storage, database, operations. |
| DEC-017 | CI/CD and infrastructure-as-code tooling | Needs decision | Repository host, workflow, target platform, secrets, maintainability. |
| DEC-018 | Authentication, recovery, and verification details | Needs decision where unspecified | Must follow the approved security specification. |
| DEC-019 | Scope of adaptive/mastery settings | Needs decision | Do not assume global, per-course, or per-user scope unless specified. |
| DEC-020 | Parent/teacher association validation and direct access to underlying records | Needs confirmation where unspecified | Preserve read-only dashboard scope; do not infer broad access. |

## 5. Decision procedure
1. Confirm the choice is not already settled in approved documents or existing code.
2. Determine whether it blocks all work or only one integration.
3. Prefer reversible choices that support local testing and avoid unnecessary costs.
4. Use provider adapters where they meaningfully reduce lock-in.
5. Record the choice, alternatives, rationale, security/privacy/cost implications, and migration considerations.
6. Mark it **Proposed for implementation** until explicitly approved.
7. Continue independent work when possible.

Do not put credentials or secrets in this document.

## 6. Decision record template
- ID and title
- Status
- Context/problem
- Options considered
- Selected option, if any
- Rationale
- Security, privacy, and cost implications
- Consequences and migration path
- Date and approver, when applicable

## 7. Initial records

### DR-001 — Repository-first implementation
- **Status:** Proposed process
- **Decision:** Inspect and reuse the current repository before selecting or replacing the stack.
- **Rationale:** Avoid unnecessary rewrites and reveal existing constraints.

### DR-002 — No production deployment without authorization
- **Status:** Required execution constraint
- **Decision:** Local development/testing may proceed; production deployment, paid-resource creation, and destructive operations require appropriate authorization.

### DR-003 — Separate pipeline processing from student playback
- **Status:** Confirmed baseline constraint
- **Decision:** Video generation and long-running pipeline stages must not be triggered by ordinary playback requests.

## 8. Revision history
| Version | Status | Notes |
|---|---|---|
| 1.0 | Proposed Decision Register — Pending Review | Initial register of confirmed constraints and unresolved choices. |
