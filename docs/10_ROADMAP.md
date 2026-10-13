# 10 — Project Roadmap

**Project:** AI-Powered Textbook-to-Video Learning & Student Performance Platform  
**Version:** 1.0  
**Status:** Proposed Roadmap — Pending Review

## 1. Purpose
This roadmap organizes implementation into practical phases. It is a plan, not evidence that features have been implemented, tested, or deployed. Approved specifications remain authoritative.

## 2. Principles
- Preserve approved requirements, architecture, database, API, UI/UX, security, and testing specifications.
- Prioritize a secure, runnable MVP.
- Deliver small, testable increments.
- Keep unresolved technology choices explicit.
- Require administrator approval before publishing generated content.
- Use pre-rendered videos; do not generate or modify videos during student playback.
- Limit parent/teacher dashboards to authorized, read-only progress and mastery summaries.

## 3. Phase overview

| Phase | Focus | Intended outcome | Status |
|---|---|---|---|
| 0 | Repository assessment | Understand existing code, docs, dependencies, and gaps | Pending |
| 1 | Application foundation | Runnable frontend/backend, configuration, persistence, health checks, tests | Planned |
| 2 | Identity and access | Authentication and server-enforced role permissions | Planned |
| 3 | Portal foundations | Separate responsive admin and student experiences | Planned |
| 4 | Initial content pipeline | PDF upload, extraction, segmentation, script/video assets, quizzes (Stages 1–5) | Planned |
| 5 | Review and publication | Review queue, approval gate, publication-state enforcement | Planned |
| 6 | Student learning and adaptation | Pre-rendered playback, progress, quiz attempts, Stage 6 adaptation | Planned |
| 7 | Dashboards and settings | Read-only parent/teacher summaries and adaptive settings | Planned |
| 8 | Verification and deployment readiness | Tests, security checks, operational and recovery plans | Planned |

Inspect the repository to determine the actual starting point. Reuse working components.

## 4. MVP scope
1. PDF upload and AI-assisted extraction.
2. Structured chapters, topics, subtopics, and learning units.
3. Pre-rendered short educational videos.
4. Topic-aligned quizzes.
5. Mandatory administrator review and approval before publication.
6. Student playback, progress tracking, and quiz attempts.
7. Basic adaptive questions targeting weak concepts.
8. Read-only parent/teacher progress and mastery dashboards.
9. Configurable mastery thresholds and adaptive settings.

These are intended capabilities, not a claim of implementation.

## 5. Later phases
- Phase 2: advanced adaptive quiz engine and advanced teacher/parent analytics.
- Phase 3: advanced AI refinements, video-streaming CDN, multilingual support.
- Phase 4: scaling, CI/CD, monitoring, and security hardening.

Reconcile these labels with actual implementation status after repository inspection. Do not delay MVP delivery for later-phase features.

## 6. Milestones and exit criteria
- **M1 — Repository understood:** available docs/code inspected; gaps recorded; locked files unchanged.
- **M2 — Runnable foundation:** local startup works; health checks and basic tests work.
- **M3 — Secure access:** authentication and backend authorization align with the security specification; unauthorized-access tests pass.
- **M4 — Approval lifecycle:** Stages 1–5 prepare content; pending-review content is inaccessible to students; publication follows successful approval.
- **M5 — Student learning:** authorized students access published pre-rendered videos; progress and quiz attempts persist; adaptation uses performance records without changing videos.
- **M6 — MVP verification:** relevant tests are mapped and run; failures, skips, blockers, and limitations are recorded.

## 7. Dependencies and risks
OCR, LLM, video synthesis, storage, and hosting may require credentials, network access, quotas, or paid plans. Provider choices remain unresolved unless an approved decision record says otherwise. Long-running generation should run as background processing, not inside playback requests. PDF processing must validate inputs. Adaptive behavior depends on reliable quiz-attempt records.

## 8. Change control
Update this roadmap when implementation evidence or approved decisions change priorities. Record material scope changes. Do not modify locked specifications without explicit authorization.

## 9. Revision history
| Version | Status | Notes |
|---|---|---|
| 1.0 | Proposed Roadmap — Pending Review | Initial roadmap based on the documented MVP and later-phase direction. |
