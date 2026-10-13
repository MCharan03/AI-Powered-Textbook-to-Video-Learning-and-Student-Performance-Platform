# 08 — Testing Specification

## 1. Document Information

| Field            | Value                                                                                  |
| ---------------- | -------------------------------------------------------------------------------------- |
| **Document**     | 08_TESTING.md                                                                          |
| **Project**      | AI-Powered Textbook-to-Video Learning & Student Performance Platform                   |
| **Version**      | 1.0                                                                                    |
| **Status**       | Proposed Testing Specification — Pending Review                                        |
| **Sequence**     | Document 8 of the project documentation series                                         |
| **Predecessors** | 01_PRD v1.0, 02_REQUIREMENTS v1.2, 03_SYSTEM_ARCHITECTURE v1.0, 04_DATABASE v1.0, 05_API v1.0, 06_UI_UX v1.0, 07_SECURITY v1.0 |

> [!IMPORTANT]
> This document is a **proposed** testing specification. No tests have been executed, no results are recorded, and no coverage percentages are claimed. All test cases are **planned** unless explicitly stated otherwise.

---

## 2. Purpose and Scope

### 2.1 Purpose

This document defines the test strategy, test levels, functional and non-functional test cases, test-data approach, entry/exit criteria, and traceability for the AI-Powered Textbook-to-Video Learning & Student Performance Platform. It provides a structured framework that the implementation team will use to verify that the delivered system satisfies the approved requirements.

### 2.2 Scope

Testing coverage spans:

- The six-stage content-processing pipeline (FR-001 – FR-006, FR-011).
- Admin-portal functions: user management, content review and approval, mastery-threshold configuration (FR-007 – FR-009).
- Student learning portal: video playback, quizzes, adaptive quiz flow, progress tracking (FR-010 – FR-011).
- Parent/teacher read-only dashboards (FR-012).
- Non-functional constraints: video duration targeting and pre-rendered playback (NFR-001, NFR-002).
- Security controls defined in 07_SECURITY.md (SEC-AUTH through SEC-IR).
- Database integrity per the conceptual design in 04_DATABASE.md (CDR-001 – CDR-010).
- API contract verification per 05_API.md (17 endpoints).
- UI/UX behaviour and accessibility targets per 06_UI_UX.md.

### 2.3 Out of Scope

- Performance benchmarks, SLAs, and load-test thresholds — deferred per Architecture Sec 10.2.
- Security hardening, penetration testing, and audit-log verification beyond the controls defined in 07_SECURITY.md — deferred to Phase 4 per PRD Sec 16 and SRS Sec 8.
- Tests for technologies not yet selected (specific OCR engine, LLM provider, video-synthesis service, cloud storage provider, vector store).
- Regulatory-compliance audits (FERPA, COPPA, GDPR) — deferred per SEC-PRIV-004 and SEC-PRIV-005.

---

## 3. Testing Principles

1. **Requirements-driven** — Every test case traces to at least one requirement, constraint, security control, or design specification from the locked source documents.
2. **Honesty over coverage** — Test results and coverage percentages are reported only after execution. This document contains planned test cases only.
3. **Technology-neutral** — Test cases describe expected behaviour without selecting unresolved technologies. Where a technology decision affects test design, the dependency is marked `[NEEDS DECISION]`.
4. **Separation of concerns** — Unit, integration, system, security, and usability tests are defined at distinct levels with clear boundaries.
5. **Reproducibility** — Each test case specifies preconditions, inputs, expected results, and postconditions sufficient for independent execution.
6. **Fail-safe defaults** — Test cases for access control and security verify denial by default; access is granted only when explicitly authorized.

---

## 4. Test Strategy and Levels

### 4.1 Unit Testing

| Attribute        | Detail                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Scope**        | Individual functions, methods, and components in isolation              |
| **Responsibility** | Developers                                                           |
| **Approach**     | Automated; run on every code commit                                    |
| **Framework**    | `[NEEDS DECISION]` — dependent on backend framework (NFR-003) and frontend (React/TypeScript confirmed, NFR-004) |
| **Coverage target** | `[NEEDS DECISION]` — to be defined after implementation planning    |

### 4.2 Integration Testing

| Attribute        | Detail                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Scope**        | Interactions between components: API ↔ database, API ↔ AI services, pipeline stage transitions |
| **Responsibility** | Developers and QA                                                    |
| **Approach**     | Automated where possible; uses test database `[NEEDS DECISION]` and mocked external services |
| **Key areas**    | Pipeline stage handoffs, API-to-database CRUD, authentication flow, file-upload-to-storage |

### 4.3 System / End-to-End Testing

| Attribute        | Detail                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Scope**        | Complete user workflows across both portals                             |
| **Responsibility** | QA team                                                               |
| **Approach**     | Automated UI tests and manual exploratory testing                      |
| **Key workflows** | PDF upload → initial pipeline (Stages 1–5) → review → approval → student video playback & quizzes → adaptive regeneration (Stage 6) → progress dashboard |

### 4.4 Security Testing

| Attribute        | Detail                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Scope**        | Verification of security controls from 07_SECURITY.md                  |
| **Responsibility** | QA and security reviewers                                             |
| **Approach**     | Automated scans, manual penetration testing (Phase 4 scope), and targeted test cases in this document |
| **Note**         | Comprehensive penetration testing and security hardening are deferred to Phase 4 per PRD Sec 16 |

### 4.5 Usability and Accessibility Testing

| Attribute        | Detail                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Scope**        | UI/UX behaviour, responsive layouts, WCAG 2.1 AA design targets        |
| **Responsibility** | QA and UX reviewers                                                   |
| **Approach**     | Manual inspection, automated accessibility scans, screen-reader testing |
| **Audit tooling** | `[NEEDS DECISION]` — per 06_UI_UX.md Sec 13.5                        |

### 4.6 Performance Testing

| Attribute        | Detail                                                                 |
| ---------------- | ---------------------------------------------------------------------- |
| **Scope**        | Response times, throughput, resource utilisation                         |
| **Status**       | **Deferred** — performance benchmarks and SLAs are not yet defined (Architecture Sec 10.2) |
| **Planned scope** | API response-time baselines, pipeline processing duration, concurrent user load |
| **Note**         | Test cases will be added when performance targets are established       |

---

## 5. Functional Test Cases — Content-Processing Pipeline

These test cases verify the six-stage pipeline defined in Architecture Sec 3. Initial content preparation spans Stages 1–5 (Stage 1: PDF Ingestion & OCR, Stage 2: Hierarchical Extraction, Stage 3: Content Segmentation, Stage 4: Script Generation & Pre-Rendered Video Synthesis, Stage 5: Quiz Generation), producing learning assets and quizzes that proceed to mandatory administrator review and approval. Following approval, publication, and student interaction, Stage 6 (Adaptive Quiz Regeneration) operates dynamically to regenerate quiz items based on recorded student performance.

### 5.1 Stage 1 — PDF Ingestion and OCR Text Extraction

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-001 | Successful PDF upload                   | Admin authenticated            | Upload a valid PDF file via `POST /admin/textbooks`  | Success response (201 illustrative `[NEEDS DECISION]`); textbook record created (`E-TEXTBOOK`); file stored in cloud storage `[NEEDS DECISION]` | FR-001, REQ-FR-001, CON-001, CDR-002     |
| TC-PIPE-002 | Reject non-PDF file                     | Admin authenticated            | Upload a .docx file                                  | Validation error response (400/415 illustrative `[NEEDS DECISION]`); file not stored; no textbook record created | CON-001, SEC-FILE-001                    |
| TC-PIPE-003 | Reject oversized file                   | Admin authenticated            | Upload a PDF exceeding the maximum size limit        | Validation error response (400/413 illustrative `[NEEDS DECISION]`); file not stored | SEC-FILE-002 `[NEEDS DECISION]`          |
| TC-PIPE-004 | PDF stored securely                     | TC-PIPE-001 completed          | Attempt to access the stored PDF via a guessed URL   | Access denied response; file not publicly accessible                            | SEC-FILE-003, SEC-FILE-007               |
| TC-PIPE-005 | PDF inspected for risky content          | Admin uploads a PDF            | Upload a PDF containing JavaScript actions            | System inspects and handles risky features per SEC-FILE-004                      | SEC-FILE-004                             |
| TC-PIPE-006 | Upload not accessible to non-admin       | Student authenticated          | Attempt `POST /admin/textbooks`                      | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002                            |
| TC-PIPE-010 | OCR text extraction execution           | Pipeline triggered for a valid textbook | `POST /admin/textbooks/{id}/pipeline` | OCR text extraction triggered for ingested PDF; text content extracted and stored | FR-002, REQ-FR-002                       |
| TC-PIPE-011 | OCR handles scanned-image PDF           | Textbook is a scanned image PDF | Trigger pipeline Stage 1                             | OCR extracts text from image-based pages                                         | FR-002, REQ-FR-002                       |
| TC-PIPE-012 | OCR processes in isolated context       | Pipeline Stage 1 in progress   | Observe processing context                           | OCR runs in isolated context per SEC-FILE-005, limiting malformed-input impact   | SEC-FILE-005                             |

### 5.2 Stage 2 — Hierarchical Content Extraction

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-020 | Hierarchy extracted correctly            | Stage 1 complete              | Pipeline progresses to Stage 2                       | Chapters, topics, and subtopics identified; hierarchy records created (`E-HIERARCHY`) | FR-003, REQ-FR-003, CDR-003             |
| TC-PIPE-021 | Hierarchy retrievable via API            | Stage 2 complete              | `GET /admin/textbooks/{id}/hierarchy`                | Success response (200 illustrative `[NEEDS DECISION]`) with hierarchical structure | FR-003, REQ-FR-003                       |
| TC-PIPE-022 | Hierarchy reflects parent-child structure | Stage 2 complete             | Inspect hierarchy response                           | Nodes correctly nested: textbook → chapters → topics → subtopics                 | CDR-003                                  |

### 5.3 Stage 3 — Content Segmentation

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-030 | Content segmented into learning units   | Stage 2 complete              | Pipeline progresses to Stage 3                       | Content divided into discrete units targeting ~5–6 min video lessons            | FR-004, REQ-FR-004, NFR-001, REQ-NFR-001 |
| TC-PIPE-031 | Segments linked to hierarchy nodes       | Stage 3 complete              | Inspect data relationships                           | Each segment associated with a topic node in the hierarchy                      | CDR-003                                  |

### 5.4 Stage 4 — Script Generation and Pre-Rendered Video Synthesis

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-040 | Scripts generated from segments         | Stage 3 complete              | Pipeline progresses to Stage 4                       | Narration scripts generated and stored (`E-VIDEO`)                              | FR-005, REQ-FR-005, CDR-004             |
| TC-PIPE-041 | Videos pre-rendered                     | Scripts generated              | Video synthesis runs                                 | Pre-rendered video files stored in cloud storage `[NEEDS DECISION]`; not generated at playback time | FR-005, REQ-FR-005, NFR-002, REQ-NFR-002 |
| TC-PIPE-042 | Video duration targets met              | Stage 4 complete              | Inspect generated video durations                    | Videos target approximately 5–6 minutes per segment                              | NFR-001, REQ-NFR-001                     |
| TC-PIPE-043 | Textbook text separated from system prompts | Stage 4 in progress        | Inspect LLM API call structure                       | Extracted text kept separate from system instructions via structured boundaries  | SEC-AI-001                               |
| TC-PIPE-044 | LLM output validated before storage     | Scripts generated              | Inspect stored script content                        | Generated output sanitized/validated before persistence                           | SEC-AI-002                               |
| TC-PIPE-045 | AI token/length limits enforced         | Stage 4 in progress           | Observe text sent to external AI service              | Text length or token limits enforced per SEC-AI-004                              | SEC-AI-004                               |

### 5.5 Stage 5 — Quiz Generation

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-050 | Quizzes generated for each topic        | Stage 4 complete              | Pipeline progresses to Stage 5                       | Quiz records (`E-QUIZ`) and question records (`E-QUESTION`) created per topic aligned to learning objectives | FR-006, REQ-FR-006, CDR-005             |
| TC-PIPE-051 | Questions linked to correct answers     | Stage 5 complete              | Inspect quiz data                                    | Each question has answer options and a correct-answer reference                   | CDR-005                                  |
| TC-PIPE-052 | Generated quiz content validated         | Stage 5 complete              | Inspect stored quiz content                          | LLM-generated quiz output validated against strict schema before storage        | SEC-AI-002, SEC-AI-004                   |

### 5.6 Stage 6 — Adaptive Quiz Regeneration (Post-Publication Lifecycle)

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-060 | Adaptive quiz regeneration triggered    | Initial content (Stages 1–5) approved and published; student performance records exist | Student completes quiz attempts resulting in weak concept performance | Adaptive quiz regeneration produces new question items targeting identified weak concepts | FR-011, REQ-FR-007, CDR-008              |
| TC-PIPE-061 | Adaptive questions target weak concepts without live video rendering | Published content accessed by student; student requests adaptive assessment | System generates adaptive quiz items | Questions target weak concepts without altering pre-rendered video assets or triggering real-time video generation | FR-011, REQ-FR-007, NFR-002, REQ-NFR-002 |
| TC-PIPE-062 | Adaptive quiz state persisted           | Adaptive quiz generated post-publication and completed by student | Inspect database records | Adaptive item selections and concept difficulty tracking persisted in `E-ADAPTIVE-ITEM` | CDR-008                                  |

### 5.7 Pipeline-Wide Tests

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-PIPE-070 | Pipeline status tracking                | Pipeline triggered             | `GET /admin/textbooks/{id}/status`                   | Success response (200 illustrative `[NEEDS DECISION]`) showing stage progress   | FR-002–FR-006, REQ-FR-002–REQ-FR-006    |
| TC-PIPE-071 | Initial pipeline execution (Stages 1–5) | Pipeline triggered for uploaded textbook | Monitor status through initial processing completion | Stages 1–5 complete successfully; generated scripts, videos, and quizzes enter `pending_review` state ready for admin review (Stage 6 executes post-publication) | FR-002–FR-006, REQ-FR-002–REQ-FR-006, ARCH-V-003 |
| TC-PIPE-072 | Pipeline failure captured               | A stage encounters an error    | Check pipeline status                                | Status reflects failure state; partial results do not publish to students         | CON-002, SEC-AI-005                      |
| TC-PIPE-073 | Temporary files cleaned up              | Pipeline completes or fails    | Check for temporary processing files                 | Temporary files removed after stage completion or failure                         | SEC-FILE-008                             |
| TC-PIPE-074 | Content not visible to students before approval | Initial pipeline execution (Stages 1–5) complete | Student queries topic browser | Generated content not available until administrator approval succeeds | FR-007, REQ-FR-008, CON-002, SEC-AI-005, ARCH-V-004 |
| TC-PIPE-075 | Pipeline trigger restricted to admins   | Student authenticated          | Attempt `POST /admin/textbooks/{id}/pipeline`        | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002                            |

---

## 6. Admin Portal Test Cases

### 6.1 Content Review and Approval

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-ADMIN-001 | List items pending review              | Initial pipeline execution (Stages 1–5) complete; items in `pending_review` state | `GET /admin/review/items` | Success response (200 illustrative `[NEEDS DECISION]`) with list of review items | FR-007, REQ-FR-008                       |
| TC-ADMIN-002 | Retrieve single review item            | Items pending review           | `GET /admin/review/items/{id}`                       | Success response (200 illustrative `[NEEDS DECISION]`) with item details         | FR-007, REQ-FR-008                       |
| TC-ADMIN-003 | Approve content item                   | Item in review                 | `POST /admin/review/items/{id}/approval` with approval decision | Item status transitions to published; content visible to students   | FR-007, REQ-FR-008, CON-002, CDR-006    |
| TC-ADMIN-004 | Content published only on approval success | Item in review             | Submit approval                                      | `published` status is the result only when the approval operation succeeds       | FR-007, REQ-FR-008, CON-002, ARCH-V-004 |
| TC-ADMIN-005 | Review restricted to admins            | Student authenticated          | Attempt `GET /admin/review/items`                    | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002                            |
| TC-ADMIN-006 | Rejection workflow                     | Item in review                 | Submit rejection decision `[NEEDS CONFIRMATION]`     | Rejection handling, retry, and follow-up actions are unconfirmed                 | FR-007, REQ-FR-008 `[NEEDS CONFIRMATION]` |

### 6.2 User Management

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-ADMIN-010 | List user accounts                     | Admin authenticated            | `GET /admin/users`                                   | Success response (200 illustrative `[NEEDS DECISION]`) with user list            | FR-008, REQ-FR-009                       |
| TC-ADMIN-011 | Create user account                    | Admin authenticated            | `POST /admin/users` with valid user data             | Success response (201 illustrative `[NEEDS DECISION]`); user record created (`E-USER`) | FR-008, REQ-FR-009, CDR-001             |
| TC-ADMIN-012 | Create user with invalid data          | Admin authenticated            | `POST /admin/users` with missing required fields     | Validation error response (400 illustrative `[NEEDS DECISION]`); no user created | SEC-API-001                              |
| TC-ADMIN-013 | User management restricted to admins   | Student authenticated          | Attempt `GET /admin/users`                           | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002                            |
| TC-ADMIN-014 | Edit user role                         | Admin authenticated            | Attempt to change a user's role `[NEEDS CONFIRMATION]` | Role-edit operation is unconfirmed by API specification                        | FR-008, REQ-FR-009 `[NEEDS CONFIRMATION]` |

### 6.3 Mastery Threshold Configuration

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-ADMIN-020 | Retrieve current thresholds            | Admin authenticated            | `GET /admin/settings/thresholds`                     | Success response (200 illustrative `[NEEDS DECISION]`) with current thresholds   | FR-009, REQ-FR-010, CDR-009             |
| TC-ADMIN-021 | Update mastery thresholds              | Admin authenticated            | `PUT /admin/settings/thresholds` with valid values   | Success response (200 illustrative `[NEEDS DECISION]`); thresholds updated in `E-SYSTEM-SETTINGS` | FR-009, REQ-FR-010, CDR-009             |
| TC-ADMIN-022 | Reject invalid threshold values        | Admin authenticated            | `PUT /admin/settings/thresholds` with out-of-range values | Validation error response (400 illustrative `[NEEDS DECISION]`); thresholds unchanged | SEC-API-001                              |
| TC-ADMIN-023 | Threshold settings restricted to admins | Student authenticated         | Attempt `PUT /admin/settings/thresholds`             | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002                            |

---

## 7. Student Learning Portal Test Cases

### 7.1 Video Playback

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-LEARN-001 | Retrieve video lesson metadata         | Content approved and published | `GET /learn/videos/{id}`                             | Success response (200 illustrative `[NEEDS DECISION]`) with video metadata       | FR-010, REQ-FR-011                       |
| TC-LEARN-002 | Video is pre-rendered                  | Content published              | Play video                                           | Video plays from pre-rendered file; no real-time video generation                | NFR-002, REQ-NFR-002, ARCH-V-005        |
| TC-LEARN-003 | Video duration within target range     | Content published              | Observe video duration                               | Duration targets approximately 5–6 minutes                                       | NFR-001, REQ-NFR-001                     |
| TC-LEARN-004 | Record video-watch progress            | Student watching video         | `POST /learn/videos/{id}/progress` with progress data | Success response (200/201 illustrative `[NEEDS DECISION]`); progress recorded (`E-VIDEO-PROGRESS`) | FR-010, REQ-FR-011, CDR-007             |
| TC-LEARN-005 | Unpublished video not accessible       | Content not yet approved       | `GET /learn/videos/{id}`                             | Resource unavailable response (404 illustrative `[NEEDS DECISION]`)             | CON-002, ARCH-V-004                      |
| TC-LEARN-006 | Video access requires authentication   | Unauthenticated request        | `GET /learn/videos/{id}`                             | Authentication required response (401 illustrative `[NEEDS DECISION]`)          | SEC-AUTH-001                             |

### 7.2 Quizzes

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-LEARN-010 | Retrieve quiz for a topic              | Content published              | `GET /learn/topics/{topicId}/quiz`                   | Success response (200 illustrative `[NEEDS DECISION]`) with quiz questions       | FR-006, REQ-FR-006                       |
| TC-LEARN-011 | Submit quiz attempt                    | Quiz displayed to student      | `POST /learn/quizzes/{id}/attempts` with answers     | Success response (200/201 illustrative `[NEEDS DECISION]`); attempt recorded (`E-QUIZ-ATTEMPT`) | FR-006, REQ-FR-006, CDR-007             |
| TC-LEARN-012 | Quiz attempt with incomplete submission | Quiz displayed               | Submit with missing answers                          | Validation error response per SEC-API-001                                        | SEC-API-001                              |
| TC-LEARN-013 | Quiz not available before approval     | Content not yet approved       | `GET /learn/topics/{topicId}/quiz`                   | Resource unavailable response (404 illustrative `[NEEDS DECISION]`)             | CON-002, ARCH-V-004                      |

### 7.3 Adaptive Quiz

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-LEARN-020 | Request adaptive quiz session          | Student authenticated; prior quiz attempts exist | `GET /learn/quizzes/adaptive`             | Success response (200 illustrative `[NEEDS DECISION]`) with adaptive questions  | FR-011, REQ-FR-007, CDR-008             |
| TC-LEARN-021 | Adaptive selection uses performance    | Student has varied quiz history | Request adaptive quiz                               | Questions selected or adjusted based on recorded student performance              | FR-011, REQ-FR-007                       |
| TC-LEARN-022 | Adaptive state tracked                 | Adaptive quiz completed        | Inspect adaptive item records                        | `E-ADAPTIVE-ITEM` records updated with selection history                         | CDR-008                                  |

### 7.4 Progress Dashboard

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-LEARN-030 | Student retrieves own progress         | Student authenticated; has activity | `GET /learn/dashboards/progress`                | Success response (200 illustrative `[NEEDS DECISION]`) with mastery summary      | FR-010, REQ-FR-011, CDR-007             |
| TC-LEARN-031 | Dashboard reflects quiz and video progress | Student has completed quizzes and videos | Check dashboard data                       | Summary includes mastery per topic from quiz scores and video completion          | FR-010, REQ-FR-011, CDR-007, CDR-010    |

### 7.5 Topic Browsing

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-LEARN-040 | Browse topics by hierarchy             | Content published              | Navigate topic browser (uses hierarchy data)         | Topics displayed in textbook hierarchy: chapters → topics → subtopics           | FR-010, REQ-FR-011, CDR-003             |
| TC-LEARN-041 | Only approved content appears          | Mix of approved and unapproved content | Browse topics                                 | Only admin-approved content visible in topic browser                             | CON-002, ARCH-V-004                      |

---

## 8. Parent / Teacher Dashboard Test Cases

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-DASH-001 | Parent/teacher retrieves student progress | Parent/teacher authenticated with confirmed association | `GET /learn/dashboards/progress` | Success response (200 illustrative `[NEEDS DECISION]`) with read-only summary   | FR-012, REQ-FR-012, CDR-010             |
| TC-DASH-002 | Dashboard is read-only                 | Parent/teacher authenticated   | Attempt to modify student data via dashboard endpoint | No write operations exposed; read-only summaries only                           | FR-012, REQ-FR-012, ARCH-V-006          |
| TC-DASH-003 | Raw data not exposed                   | Parent/teacher authenticated   | Inspect dashboard response                           | No raw video-progress records, individual quiz attempts, or textbook assets returned | FR-012, REQ-FR-012, SEC-AUTHZ-004, ARCH-V-006 |
| TC-DASH-004 | Student-ID query parameter             | Parent/teacher authenticated   | Use `student_id` parameter `[NEEDS CONFIRMATION]`    | Parameter design and validation mechanism unconfirmed                             | FR-012, REQ-FR-012 `[NEEDS CONFIRMATION]` |
| TC-DASH-005 | Association validation                 | Parent/teacher requests progress for an unlinked student | `GET /learn/dashboards/progress` with unlinked student_id `[NEEDS CONFIRMATION]` | Access denied response `[NEEDS CONFIRMATION]`; association mechanism unconfirmed | SEC-AUTHZ-003, SEC-PRIV-001 `[NEEDS CONFIRMATION]` |
| TC-DASH-006 | Unauthenticated dashboard access       | Unauthenticated request        | `GET /learn/dashboards/progress`                     | Authentication required response (401 illustrative `[NEEDS DECISION]`)          | SEC-AUTH-001                             |

---

## 9. Authentication and Authorization Test Cases

### 9.1 Authentication

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-AUTH-001 | Unauthenticated request rejected       | No session/token               | Call any non-public endpoint                         | Authentication required response (401 illustrative `[NEEDS DECISION]`)          | SEC-AUTH-001, VER-001                    |
| TC-AUTH-002 | Successful authentication              | Valid credentials               | Authenticate                                         | Session established; subsequent requests authorized                              | SEC-AUTH-001                             |
| TC-AUTH-003 | Invalid credentials rejected           | Invalid credentials            | Attempt authentication                               | Authentication fails; no session created                                         | SEC-AUTH-001                             |
| TC-AUTH-004 | Session expiration enforced            | Session created; maximum lifetime exceeded | Attempt request after expiry                | Request rejected; re-authentication required                                     | SEC-AUTH-002                             |
| TC-AUTH-005 | Logout invalidates session             | Session active                 | Invoke logout mechanism                              | Session invalidated; subsequent requests with that session rejected               | SEC-AUTH-003                             |
| TC-AUTH-006 | Authentication events logged           | Authentication attempt         | Check server logs                                    | Login, logout, and failed-attempt events recorded                                | SEC-LOG-001                              |
| TC-AUTH-007 | Logs do not contain credentials        | Authentication events logged   | Inspect log entries                                  | No plaintext passwords, tokens, or unmasked PII in logs                          | SEC-LOG-003                              |

### 9.2 Authorization (Role-Based Access Control)

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-AUTHZ-001 | Admin accesses admin endpoints         | Admin authenticated            | Call admin-portal endpoints                          | Success response (200 illustrative `[NEEDS DECISION]`)                          | SEC-AUTHZ-001, SEC-AUTHZ-002            |
| TC-AUTHZ-002 | Student cannot access admin endpoints  | Student authenticated          | Call any `/admin/*` endpoint                         | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002, VER-002                   |
| TC-AUTHZ-003 | Parent cannot access admin endpoints   | Parent authenticated           | Call any `/admin/*` endpoint                         | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002, VER-002                   |
| TC-AUTHZ-004 | Teacher cannot access admin endpoints  | Teacher authenticated          | Call any `/admin/*` endpoint                         | Access denied response (403 illustrative `[NEEDS DECISION]`)                    | SEC-AUTHZ-002, VER-002                   |
| TC-AUTHZ-005 | Student accesses learning endpoints    | Student authenticated          | Call learning-portal endpoints                       | Success response (200 illustrative `[NEEDS DECISION]`)                          | SEC-AUTHZ-003                            |
| TC-AUTHZ-006 | Admin cannot access student learning data via learning endpoints | Admin authenticated | Call `/learn/*` endpoints | Behaviour `[NEEDS DECISION]` — admin access to learning portal not specified   | SEC-AUTHZ-001                            |
| TC-AUTHZ-007 | Authorization failure logged           | Student attempts admin endpoint | Check server logs                                   | Access-denied event recorded                                                     | SEC-LOG-002                              |
| TC-AUTHZ-008 | Student data accessible only to authorized parties | Student has progress data | Other student attempts to view the data          | Access denied; student data visible only to student, linked parent/teacher, admins | SEC-PRIV-001                             |

---

## 10. Security Test Cases

These test cases verify specific security controls from 07_SECURITY.md. Additional security test cases are embedded in the pipeline (Sec 5) and authentication (Sec 9) sections above.

### 10.1 File-Upload Security

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-SEC-001 | PDF format validation                  | Admin authenticated            | Upload a file with .pdf extension but non-PDF content | Validation error response; system validates actual file content                 | SEC-FILE-001, VER-005                    |
| TC-SEC-002 | File-size limit enforcement            | Admin authenticated            | Upload a PDF exceeding the size limit                | Validation error response (400/413 illustrative `[NEEDS DECISION]`)             | SEC-FILE-002 `[NEEDS DECISION]`, VER-005 |
| TC-SEC-003 | PDF risky-content inspection           | Admin authenticated            | Upload a PDF with JavaScript, launch actions, embedded files, or URI refs | System inspects and handles risky features per SEC-FILE-004                  | SEC-FILE-004, VER-005                    |
| TC-SEC-004 | Stored files not publicly accessible   | File uploaded                  | Attempt direct URL access without authentication     | Access denied response                                                          | SEC-FILE-003, SEC-FILE-007, TR-011       |
| TC-SEC-005 | PDF not rendered in browser            | File uploaded                  | Check that system does not serve PDFs for browser rendering | PDFs not executed or rendered in user's browser                         | SEC-FILE-006                             |
| TC-SEC-006 | Temporary files removed                | Pipeline completes or fails    | Check for residual temporary files                   | No temporary files remain after processing                                       | SEC-FILE-008                             |

### 10.2 AI/ML Security

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-SEC-010 | Prompt-injection resistance            | Textbook contains adversarial text | Process through pipeline                          | Extracted text separated from system instructions via structured boundaries     | SEC-AI-001, VER-006, TR-005              |
| TC-SEC-011 | LLM output validation                  | Script/quiz generated          | Inspect stored content                               | Output sanitized/validated before storage and presentation                        | SEC-AI-002, VER-006                      |
| TC-SEC-012 | AI credentials not in client code      | Application deployed           | Inspect client-side bundles and source repository    | No AI service API keys or credentials present                                    | SEC-AI-003, VER-010                      |
| TC-SEC-013 | Content requires approval before student access | Initial pipeline execution (Stages 1–5) complete | Check student portal for unapproved content | AI-generated content not accessible to students without admin approval | SEC-AI-005, VER-007 |

### 10.3 API Security

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-SEC-020 | Input validation on all endpoints      | Any authenticated user         | Send requests with malformed parameters or invalid values | Validation error response with generic error message                            | SEC-API-001, SEC-API-002, VER-008        |
| TC-SEC-021 | Error responses hide internal details  | Any request                    | Trigger a server error                               | Generic error message returned; no stack traces or internal paths exposed       | SEC-API-002, SEC-PRIV-003, VER-008, TR-009 |
| TC-SEC-022 | CORS restricts origins                 | Request from unauthorized origin | Send cross-origin request                           | CORS policy blocks request; only admin and learning portal origins allowed      | SEC-API-004, VER-009                     |
| TC-SEC-023 | Unsupported content type rejected      | Any request                    | Send request with unexpected content type             | Validation error response (400/415 illustrative `[NEEDS DECISION]`)             | SEC-API-006                              |
| TC-SEC-024 | Rate limiting active                   | Multiple rapid requests         | Send requests exceeding rate threshold `[NEEDS DECISION]` | Rate-limit error response (429 illustrative `[NEEDS DECISION]`)                 | SEC-API-003 `[NEEDS DECISION]`, TR-008   |

### 10.4 Encryption and Secrets

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-SEC-030 | Data encrypted in transit              | Client-server communication    | Inspect transport layer                              | Data encrypted in transit `[NEEDS DECISION]` — specific standard not selected   | SEC-ENC-001                              |
| TC-SEC-031 | Passwords stored as adaptive hashes    | User created                   | Inspect database                                     | Passwords stored as one-way adaptive hashes; no plaintext found                  | SEC-PRIV-002, VER-004                    |
| TC-SEC-032 | Secrets absent from source code        | Codebase available             | Scan source code and version control                 | No database credentials, API keys, or signing keys in source                     | SEC-SEC-001, VER-010                     |
| TC-SEC-033 | Secrets absent from client bundles     | Application deployed           | Inspect client-side JavaScript bundles               | No secrets present in frontend builds                                            | SEC-SEC-001, SEC-AI-003, VER-010         |

### 10.5 Infrastructure and Logging

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-SEC-040 | Least-privilege service accounts       | Production deployment          | Inspect service-account permissions                  | Service accounts have only the minimum required permissions                       | SEC-INFRA-001                            |
| TC-SEC-041 | Authentication events in logs          | User logs in, logs out, fails auth | Inspect server logs                              | All authentication events recorded                                               | SEC-LOG-001                              |
| TC-SEC-042 | Authorization failures in logs         | User denied access             | Inspect server logs                                  | Access-denied events recorded                                                    | SEC-LOG-002                              |
| TC-SEC-043 | No sensitive data in logs              | Various operations             | Inspect log output                                   | No plaintext credentials, session tokens, or unmasked PII in log entries          | SEC-LOG-003, VER-004, VER-010            |

---

## 11. Database and API Integration Test Cases

### 11.1 Database Integration

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-DB-001  | User record CRUD                       | Test database initialized `[NEEDS DECISION]` | Create, read, update user via API   | `E-USER` records created, retrieved, and modified correctly                      | CDR-001                                  |
| TC-DB-002  | Textbook metadata persistence          | PDF uploaded                   | Create textbook record via upload                    | `E-TEXTBOOK` record persisted with file reference, timestamp, and status         | CDR-002                                  |
| TC-DB-003  | Hierarchy relationships maintained     | Pipeline Stage 2 complete      | Retrieve hierarchy                                   | `E-HIERARCHY` records correctly reflect parent-child relationships               | CDR-003                                  |
| TC-DB-004  | Video metadata and storage reference   | Pipeline Stage 4 complete      | Retrieve video record                                | `E-VIDEO` record contains metadata and storage reference                         | CDR-004                                  |
| TC-DB-005  | Quiz and question integrity            | Pipeline Stage 5 complete      | Retrieve quiz data                                   | `E-QUIZ` linked to `E-QUESTION` records with correct answer references           | CDR-005                                  |
| TC-DB-006  | Review status lifecycle                | Content reviewed               | Track review status transitions                      | `E-REVIEW-STATUS` record tracks review state and reviewer identity               | CDR-006                                  |
| TC-DB-007  | Quiz attempt recording                 | Student submits quiz           | Verify attempt record                                | `E-QUIZ-ATTEMPT` persisted with score and timestamp                              | CDR-007                                  |
| TC-DB-008  | Video progress recording               | Student watches video          | Verify progress record                               | `E-VIDEO-PROGRESS` persisted with watch data                                    | CDR-007                                  |
| TC-DB-009  | Mastery level computation              | Student has quiz and video data | Check mastery records                                | `E-MASTERY` records reflect per-topic mastery levels                             | CDR-007                                  |
| TC-DB-010  | Adaptive quiz state persistence        | Adaptive quiz completed        | Verify adaptive state                                | `E-ADAPTIVE-ITEM` records track difficulty and selection history                 | CDR-008                                  |
| TC-DB-011  | System settings persistence            | Admin updates thresholds       | Retrieve settings                                    | `E-SYSTEM-SETTINGS` record reflects updated thresholds                           | CDR-009                                  |
| TC-DB-012  | Dashboard views return summaries only  | Student has activity data      | Query dashboard endpoint                             | Aggregated mastery summaries returned; no raw attempt data exposed                | CDR-010, ARCH-V-006                      |

### 11.2 API Contract Integration

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-API-001 | POST /admin/textbooks contract         | Admin authenticated            | Upload PDF per API spec                              | Response matches documented structure (Sec 11.1 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-001, REQ-FR-001                       |
| TC-API-002 | POST /admin/textbooks/{id}/pipeline    | Textbook uploaded              | Trigger pipeline per API spec                        | Response matches documented structure (Sec 11.2 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-002–FR-006, REQ-FR-002–REQ-FR-006    |
| TC-API-003 | GET /admin/textbooks/{id}/status       | Pipeline triggered             | Query status per API spec                            | Response matches documented structure (Sec 11.2 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-002–FR-006, REQ-FR-002–REQ-FR-006    |
| TC-API-004 | GET /admin/textbooks/{id}/hierarchy    | Stage 2 complete               | Retrieve hierarchy per API spec                      | Response matches documented structure (Sec 11.3 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-003, REQ-FR-003                       |
| TC-API-005 | GET /admin/review/items                | Items pending review           | List review items per API spec                       | Response matches documented structure (Sec 11.4 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-007, REQ-FR-008                       |
| TC-API-006 | GET /admin/review/items/{id}           | Items pending review           | Retrieve item per API spec                           | Response matches documented structure (Sec 11.4 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-007, REQ-FR-008                       |
| TC-API-007 | POST /admin/review/items/{id}/approval | Item in review                 | Submit approval per API spec                         | Response matches documented structure (Sec 11.5–11.6 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-007, REQ-FR-008                       |
| TC-API-008 | GET /admin/users                       | Admin authenticated            | List users per API spec                              | Response matches documented structure (Sec 11.7 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-008, REQ-FR-009                       |
| TC-API-009 | POST /admin/users                      | Admin authenticated            | Create user per API spec                             | Response matches documented structure (Sec 11.7 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-008, REQ-FR-009                       |
| TC-API-010 | GET /admin/settings/thresholds         | Admin authenticated            | Retrieve thresholds per API spec                     | Response matches documented structure (Sec 11.8 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-009, REQ-FR-010                       |
| TC-API-011 | PUT /admin/settings/thresholds         | Admin authenticated            | Update thresholds per API spec                       | Response matches documented structure (Sec 11.8 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-009, REQ-FR-010                       |
| TC-API-012 | GET /learn/videos/{id}                 | Content published              | Retrieve video per API spec                          | Response matches documented structure (Sec 12.1 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-010, REQ-FR-011                       |
| TC-API-013 | POST /learn/videos/{id}/progress       | Student watching video         | Record progress per API spec                         | Response matches documented structure (Sec 12.2 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-010, REQ-FR-011                       |
| TC-API-014 | GET /learn/topics/{topicId}/quiz       | Content published              | Retrieve quiz per API spec                           | Response matches documented structure (Sec 12.3 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-006, REQ-FR-006                       |
| TC-API-015 | POST /learn/quizzes/{id}/attempts      | Quiz displayed                 | Submit attempt per API spec                          | Response matches documented structure (Sec 12.4 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-006, REQ-FR-006                       |
| TC-API-016 | GET /learn/quizzes/adaptive            | Student authenticated          | Request adaptive quiz per API spec                   | Response matches documented structure (Sec 12.5 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-011, REQ-FR-007                       |
| TC-API-017 | GET /learn/dashboards/progress         | User authenticated             | Retrieve dashboard per API spec                      | Response matches documented structure (Sec 13.1 of 05_API.md; status codes illustrative `[NEEDS DECISION]`) | FR-010, FR-012, REQ-FR-011, REQ-FR-012   |

---

## 12. UI/UX Test Cases

### 12.1 Admin Portal UI

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-UI-001  | Admin portal uses dark theme           | Admin portal loaded            | Inspect visual theme                                 | Dark premium theme applied consistently                                          | 06_UI_UX Sec 3.1                         |
| TC-UI-002  | Fixed left sidebar on desktop          | Admin portal on desktop (≥1024px) | Inspect layout                                    | Fixed left sidebar present with navigation items                                 | 06_UI_UX Sec 4.1, 5.1                   |
| TC-UI-003  | Sidebar collapses on small screens     | Admin portal on mobile (<600px) | Inspect layout                                     | Sidebar collapsed or replaced with navigation drawer                             | 06_UI_UX Sec 4.3, 5.3                   |
| TC-UI-004  | Textbook upload screen functional      | Admin navigates to upload      | Upload a PDF via FileDropzone component              | Upload initiated; progress feedback displayed                                    | 06_UI_UX Sec 6.1                         |
| TC-UI-005  | Pipeline monitor displays stages       | Pipeline triggered             | View pipeline monitor screen                         | Six pipeline stages displayed with current status via PipelineProgress component | 06_UI_UX Sec 6.2                         |
| TC-UI-006  | Cancel task button                     | Pipeline in progress           | Click Cancel Task `[NEEDS CONFIRMATION]`             | Cancellation API endpoint not established in API spec                            | 06_UI_UX Sec 6.2 `[NEEDS CONFIRMATION]`  |
| TC-UI-007  | Review item list displayed             | Items pending review           | Navigate to content review screen                    | DataTable lists review items with status badges                                  | 06_UI_UX Sec 6.3                         |
| TC-UI-008  | Review item detail view                | Click a review item            | View item detail                                     | Video, script, and quiz details displayed for review                             | 06_UI_UX Sec 6.4                         |
| TC-UI-009  | Approval action — success              | Admin approves an item         | Click approve; operation succeeds                    | Success toast shown; item status transitions to published                        | 06_UI_UX Sec 6.5, 10.5                  |
| TC-UI-010  | Approval action — rejection            | Admin rejects an item `[NEEDS CONFIRMATION]` | Click reject                              | Rejection workflow and feedback unconfirmed                                       | 06_UI_UX Sec 6.5 `[NEEDS CONFIRMATION]`  |
| TC-UI-011  | User management screen                 | Admin navigates to user management | View user list                                    | DataTable displays user accounts                                                 | 06_UI_UX Sec 6.6                         |
| TC-UI-012  | Mastery threshold settings             | Admin navigates to settings    | Adjust thresholds via ThresholdSlider component      | Updated values saved; confirmation displayed                                     | 06_UI_UX Sec 6.7                         |

### 12.2 Student Learning Portal UI

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-UI-020  | Learning portal uses light theme       | Learning portal loaded         | Inspect visual theme                                 | Light theme applied consistently                                                 | 06_UI_UX Sec 3.2                         |
| TC-UI-021  | Topic browser displays hierarchy       | Content published              | Navigate topic browser                               | Hierarchical navigation: textbook → chapters → topics → subtopics                | 06_UI_UX Sec 7.1                         |
| TC-UI-022  | Video player renders pre-rendered video | Topic selected                 | Play video via VideoPlayer component                 | Pre-rendered video plays; progress callback fires                                | 06_UI_UX Sec 7.2                         |
| TC-UI-023  | Script-text toggle                     | Video player screen            | Toggle script text `[NEEDS CONFIRMATION]`            | Student-facing script toggle and retrieval mechanism unconfirmed by API spec      | 06_UI_UX Sec 7.2 `[NEEDS CONFIRMATION]`  |
| TC-UI-024  | Standard quiz interface                | Student takes quiz             | Answer questions via QuizCard components              | Questions displayed; answers submitted; score shown                               | 06_UI_UX Sec 7.3                         |
| TC-UI-025  | Adaptive quiz interface                | Student requests adaptive quiz | Complete adaptive quiz session                        | Adaptively selected questions presented; results recorded                         | 06_UI_UX Sec 7.4                         |
| TC-UI-026  | Student progress dashboard             | Student has activity history   | View progress dashboard                              | ScoreRing components display mastery levels; progress summary shown               | 06_UI_UX Sec 7.5                         |

### 12.3 Parent / Teacher Dashboard UI

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-UI-030  | Dashboard displays summary only        | Parent/teacher authenticated   | View dashboard                                       | Aggregated progress and mastery summaries displayed; no raw data exposed          | 06_UI_UX Sec 8.1                         |
| TC-UI-031  | Dashboard is read-only                 | Parent/teacher on dashboard    | Attempt to modify any data                           | No write controls present; view is entirely read-only                             | 06_UI_UX Sec 8.1, ARCH-V-006            |

### 12.4 Responsive Design

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-UI-040  | Tablet layout (600–1023px)             | Either portal on tablet        | Resize to tablet width                               | Sidebar collapsed; content reflows; all features accessible                      | 06_UI_UX Sec 4.2                         |
| TC-UI-041  | Mobile layout (<600px)                 | Either portal on mobile        | Resize to mobile width                               | Navigation drawer replaces sidebar; grids reflow; touch targets ≥44×44 CSS px    | 06_UI_UX Sec 4.3                         |

### 12.5 Accessibility

| ID         | Title                                    | Precondition                  | Input / Action                                      | Expected Result                                                                 | Traces To                                |
| ---------- | ---------------------------------------- | ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| TC-UI-050  | Contrast ratios meet targets           | Either portal loaded           | Measure contrast ratios                              | ≥ 4.5:1 body text; ≥ 3:1 large text and UI components                           | 06_UI_UX Sec 11                          |
| TC-UI-051  | Keyboard navigation functional         | Either portal loaded           | Navigate all interactive elements via keyboard       | All elements reachable and operable; logical focus order; visible focus indicators | 06_UI_UX Sec 11                          |
| TC-UI-052  | Screen reader compatibility            | Either portal loaded           | Navigate with screen reader                          | Semantic landmarks, headings, ARIA labels, and aria-live regions function correctly | 06_UI_UX Sec 11                         |
| TC-UI-053  | Alt text on informational images       | Either portal loaded           | Inspect images                                       | Informational images have alt text; decorative images marked role="presentation"  | 06_UI_UX Sec 11                          |
| TC-UI-054  | Reduced-motion preference respected    | prefers-reduced-motion enabled | Load portal                                          | Non-essential animations disabled                                                | 06_UI_UX Sec 11                          |
| TC-UI-055  | Form labels and error messages         | Either portal loaded           | Interact with form inputs                            | Visible labels, associated <label> elements, and descriptive error messages       | 06_UI_UX Sec 11                          |

---

## 13. Test Data Strategy

### 13.1 Principles

1. **No production data in testing** — All test data is synthetic or anonymized.
2. **Repeatable** — Test datasets are versioned and reproducible across test runs.
3. **Role coverage** — Test accounts for all four roles: administrator, student, teacher, parent.
4. **Edge cases** — Test data includes boundary conditions (empty PDFs, single-page PDFs, maximum-size PDFs, special characters in textbook content).

### 13.2 Planned Test Data Sets

| Dataset                    | Description                                                                                          | Purpose                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **TD-USERS**               | Test user accounts for each role (admin, student, teacher, parent) with valid credentials             | Authentication and authorization testing        |
| **TD-PDF-VALID**           | Sample PDF textbooks with known hierarchical structure, varying page counts, and text-based content    | Pipeline functional testing                     |
| **TD-PDF-SCANNED**         | Scanned-image PDF textbooks                                                                          | OCR extraction testing                          |
| **TD-PDF-MALICIOUS**       | PDFs containing JavaScript actions, launch actions, embedded files, external URI references           | File-upload security testing (SEC-FILE-004)     |
| **TD-PDF-OVERSIZED**       | PDF exceeding the maximum file-size limit                                                            | File-size validation testing (SEC-FILE-002)     |
| **TD-PDF-INVALID**         | Non-PDF files with .pdf extension; corrupt PDF files                                                 | Format validation testing (SEC-FILE-001)        |
| **TD-HIERARCHY-EXPECTED**  | Known chapter/topic/subtopic structure matching TD-PDF-VALID textbooks                               | Hierarchy extraction verification               |
| **TD-QUIZ-HISTORY**        | Pre-populated quiz-attempt records with varying scores                                               | Adaptive quiz and mastery testing                |
| **TD-ADVERSARIAL-TEXT**    | Textbook content containing prompt-injection attempts                                                | AI/ML security testing (SEC-AI-001)             |

### 13.3 Test Environment Data Management

- `[NEEDS DECISION]` — Database seeding and teardown strategy will depend on the selected backend framework and test tooling.
- Test environments should be isolated from production data and infrastructure.

---

## 14. Defect Severity and Prioritisation

### 14.1 Severity Levels

| Severity     | Definition                                                                                     | Examples                                                     |
| ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Critical** | System unusable; data loss or security breach; no workaround                                    | Authentication bypass, data corruption, pipeline destroys data |
| **High**     | Major feature inoperable; significant impact on core workflows; workaround exists but impractical | Pipeline stage fails silently, approval does not publish content, quiz scores not recorded |
| **Medium**   | Feature partially impaired; workaround available and practical                                   | UI layout broken on tablet, progress not updating in real time, non-critical validation missing |
| **Low**      | Cosmetic issue or minor inconvenience; does not affect functionality                             | Typo in UI label, inconsistent icon, slightly off spacing     |

### 14.2 Priority Levels

| Priority     | Definition                                                  |
| ------------ | ----------------------------------------------------------- |
| **P0**       | Fix immediately; blocks release or poses active security risk |
| **P1**       | Fix before next release milestone                            |
| **P2**       | Fix when feasible; does not block release                    |
| **P3**       | Fix at convenience; backlog item                             |

---

## 15. Entry and Exit Criteria

### 15.1 Test Entry Criteria

| Criterion                                                          | Verification                                    |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| Source documents reviewed and locked at specified versions           | Document version table in Sec 1                  |
| Test environment provisioned and accessible                         | Environment checklist sign-off                   |
| Test data sets prepared and loaded                                  | Datasets from Sec 13.2 available                 |
| Code under test deployed to test environment                        | Deployment confirmation                          |
| Unit tests passing at required threshold                            | CI/CD pipeline report                            |

### 15.2 Test Exit Criteria

| Criterion                                                          | Verification                                    |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| All Critical and High severity defects resolved or accepted         | Defect tracker report                            |
| All test cases executed and results recorded in Sec 18 template     | Completed test execution record                  |
| No unresolved security test failures for specified SEC-* controls  | Security test summary                            |
| Traceability matrix (Sec 17) confirms requirement coverage          | Matrix review sign-off                           |
| Regression test suite passes                                        | CI/CD regression report                          |

### 15.3 Regression Testing

- A regression test suite shall be maintained comprising all automated test cases from Sections 5–12.
- Regression tests shall be executed before each release candidate.
- New defect fixes shall include corresponding test cases added to the regression suite.
- `[NEEDS DECISION]` — Regression test automation framework and CI/CD integration strategy will depend on the selected backend and deployment infrastructure.

---

## 16. Test Environment and Risks

### 16.1 Test Environment

| Component               | Requirement                                                                      |
| ------------------------ | -------------------------------------------------------------------------------- |
| **Database**             | Test database instance `[NEEDS DECISION]` — PostgreSQL and the optional vector store remain candidate database technologies per NFR-009 and 04_DATABASE.md Sec 10; physical engine and schema not yet finalized |
| **Backend**              | `[NEEDS DECISION]` — dependent on backend framework selection (NFR-003)          |
| **Frontend**             | React/TypeScript application (NFR-004) deployed to test server                    |
| **External AI services** | Mocked or sandboxed; no production AI credentials in test environment             |
| **Cloud storage**        | `[NEEDS DECISION]` — dependent on cloud storage selection (NFR-008)              |
| **Browser matrix**       | `[NEEDS DECISION]` — supported browsers and versions to be defined                |

### 16.2 Test Risks

| Risk                                                              | Mitigation                                                      |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| AI service responses are non-deterministic                         | Mock AI services for repeatable integration tests; test real services in a dedicated environment |
| Unresolved technology decisions delay test-environment setup       | Begin with technology-neutral test cases; adapt when decisions are made |
| Pipeline processing time makes end-to-end tests slow               | Use pre-processed test data for stages downstream of the bottleneck |
| Security hardening deferred to Phase 4 limits testable scope       | Test currently defined SEC-* controls; document deferred tests explicitly |
| Test data for adaptive quiz requires sufficient quiz-attempt history | Prepare TD-QUIZ-HISTORY seed data with varied performance profiles |

### 16.3 Open Testing Decisions

| ID            | Decision                                                          | Dependency                                      |
| ------------- | ----------------------------------------------------------------- | ----------------------------------------------- |
| TEST-DEC-001  | Unit test framework selection                                      | Backend framework decision (NFR-003)             |
| TEST-DEC-002  | Integration test framework and database seeding strategy            | Backend framework decision (NFR-003)             |
| TEST-DEC-003  | End-to-end UI test framework (e.g., Playwright, Cypress)           | Implementation planning                          |
| TEST-DEC-004  | Performance test tooling and acceptance thresholds                  | Performance benchmarks definition (Arch Sec 10.2) |
| TEST-DEC-005  | Accessibility audit tooling                                        | 06_UI_UX Sec 13.5                                |
| TEST-DEC-006  | CI/CD pipeline integration for automated test execution             | Infrastructure decisions                          |
| TEST-DEC-007  | Browser and device test matrix                                     | Implementation planning                          |
| TEST-DEC-008  | Test coverage percentage targets                                   | Implementation planning                          |
| TEST-DEC-009  | File-size limit value for SEC-FILE-002 test validation              | SEC-FILE-002 `[NEEDS DECISION]`                  |
| TEST-DEC-010  | Rate-limiting thresholds for SEC-API-003 test validation            | SEC-API-003 `[NEEDS DECISION]`                   |

---

## 17. Traceability Matrix

This matrix maps source-document requirements to test cases defined in this document.

### 17.1 PRD Functional Requirements → SRS Requirements → Test Cases

| PRD Req | PRD Description                          | SRS Tracing | Test Cases                                                                      |
| ------- | ---------------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| FR-001  | PDF Textbook Upload                       | REQ-FR-001  | TC-PIPE-001, TC-PIPE-002, TC-PIPE-003, TC-PIPE-006, TC-API-001                  |
| FR-002  | OCR Text Extraction                       | REQ-FR-002  | TC-PIPE-010, TC-PIPE-011, TC-PIPE-012, TC-PIPE-070, TC-API-002, TC-API-003      |
| FR-003  | Hierarchical Content Extraction           | REQ-FR-003  | TC-PIPE-020, TC-PIPE-021, TC-PIPE-022, TC-API-004                               |
| FR-004  | Content Segmentation                      | REQ-FR-004  | TC-PIPE-030, TC-PIPE-031                                                        |
| FR-005  | AI Script and Video Synthesis             | REQ-FR-005  | TC-PIPE-040, TC-PIPE-041, TC-PIPE-042                                           |
| FR-006  | AI Quiz Generation                        | REQ-FR-006  | TC-PIPE-050, TC-PIPE-051, TC-PIPE-052, TC-LEARN-010, TC-LEARN-011, TC-API-014, TC-API-015 |
| FR-007  | Admin Review and Approval                 | REQ-FR-008  | TC-ADMIN-001 – TC-ADMIN-006, TC-PIPE-074, TC-API-005, TC-API-006, TC-API-007    |
| FR-008  | User Management                           | REQ-FR-009  | TC-ADMIN-010 – TC-ADMIN-014, TC-API-008, TC-API-009                             |
| FR-009  | Mastery Threshold Configuration           | REQ-FR-010  | TC-ADMIN-020 – TC-ADMIN-023, TC-API-010, TC-API-011                             |
| FR-010  | Student Learning Portal                   | REQ-FR-011  | TC-LEARN-001 – TC-LEARN-006, TC-LEARN-030, TC-LEARN-031, TC-LEARN-040, TC-LEARN-041, TC-API-012, TC-API-013, TC-API-017 |
| FR-011  | Basic Adaptive Quiz Flow                  | REQ-FR-007  | TC-PIPE-060 – TC-PIPE-062, TC-LEARN-020 – TC-LEARN-022, TC-API-016             |
| FR-012  | Read-Only Parent/Teacher Dashboards       | REQ-FR-012  | TC-DASH-001 – TC-DASH-006, TC-API-017                                           |

### 17.2 PRD Non-Functional Requirements → Test Cases

| Requirement | Description                              | Test Cases                                                |
| ----------- | ---------------------------------------- | --------------------------------------------------------- |
| NFR-001     | Video Duration (~5–6 min)                | TC-PIPE-030, TC-PIPE-042, TC-LEARN-003                     |
| NFR-002     | Pre-Rendered Video                        | TC-PIPE-041, TC-LEARN-002                                  |

### 17.3 SRS Constraints → Test Cases

| Constraint | Description                              | Test Cases                                                |
| ---------- | ---------------------------------------- | --------------------------------------------------------- |
| CON-001    | PDF-Only Input                            | TC-PIPE-001, TC-PIPE-002                                   |
| CON-002    | Pre-Rendered + Approval Gate              | TC-PIPE-074, TC-ADMIN-003, TC-ADMIN-004, TC-LEARN-005, TC-LEARN-013, TC-LEARN-041, TC-SEC-013 |
| CON-003    | Dual-Application Architecture             | TC-UI-001, TC-UI-020 (both portals tested independently)   |

### 17.4 Security Controls → Test Cases

| Control       | Description                                            | Test Cases                                      |
| ------------- | ------------------------------------------------------ | ----------------------------------------------- |
| SEC-AUTH-001  | Authentication required for non-public endpoints        | TC-AUTH-001, TC-AUTH-002, TC-AUTH-003, TC-LEARN-006, TC-DASH-006 |
| SEC-AUTH-002  | Session expiration                                      | TC-AUTH-004                                      |
| SEC-AUTH-003  | Logout invalidates session                              | TC-AUTH-005                                      |
| SEC-AUTHZ-001 | Role-based access control enforcement                  | TC-AUTHZ-001, TC-AUTHZ-006                      |
| SEC-AUTHZ-002 | Admin-only access to admin endpoints                   | TC-AUTHZ-002, TC-AUTHZ-003, TC-AUTHZ-004, TC-PIPE-006, TC-PIPE-075, TC-ADMIN-005, TC-ADMIN-013, TC-ADMIN-023 |
| SEC-AUTHZ-003 | Student-portal access control                          | TC-AUTHZ-005, TC-DASH-005                        |
| SEC-AUTHZ-004 | Parent/teacher dashboard read-only summaries only       | TC-DASH-002, TC-DASH-003                         |
| SEC-PRIV-001  | Student data access restrictions                        | TC-AUTHZ-008, TC-DASH-005                        |
| SEC-PRIV-002  | Password stored as adaptive hashes                      | TC-SEC-031                                       |
| SEC-PRIV-003  | No internal details in error responses                  | TC-SEC-021                                       |
| SEC-FILE-001  | PDF format validation                                   | TC-PIPE-002, TC-SEC-001                          |
| SEC-FILE-002  | File-size limit                                         | TC-PIPE-003, TC-SEC-002                          |
| SEC-FILE-003  | Files not publicly accessible                           | TC-PIPE-004, TC-SEC-004                          |
| SEC-FILE-004  | PDF risky-content inspection                            | TC-PIPE-005, TC-SEC-003                          |
| SEC-FILE-005  | Isolated processing context                             | TC-PIPE-012                                      |
| SEC-FILE-006  | PDF not rendered in browser                             | TC-SEC-005                                       |
| SEC-FILE-007  | Assets not guessable or enumerable                      | TC-PIPE-004, TC-SEC-004                          |
| SEC-FILE-008  | Temporary files removed                                 | TC-PIPE-073, TC-SEC-006                          |
| SEC-AI-001    | Textbook text separated from system instructions        | TC-PIPE-043, TC-SEC-010                          |
| SEC-AI-002    | LLM output validated before storage                     | TC-PIPE-044, TC-PIPE-052, TC-SEC-011             |
| SEC-AI-003    | AI credentials not in client code                       | TC-SEC-012, TC-SEC-033                           |
| SEC-AI-004    | Token/length limits on AI service input                 | TC-PIPE-045                                      |
| SEC-AI-005    | Content requires admin approval before student access   | TC-PIPE-074, TC-SEC-013                          |
| SEC-API-001   | Input validation                                        | TC-SEC-020, TC-ADMIN-012, TC-ADMIN-022, TC-LEARN-012 |
| SEC-API-002   | Generic error messages                                  | TC-SEC-021                                       |
| SEC-API-003   | Rate limiting                                           | TC-SEC-024                                       |
| SEC-API-004   | CORS restrictions                                       | TC-SEC-022                                       |
| SEC-API-006   | Unsupported content type rejected                       | TC-SEC-023                                       |
| SEC-ENC-001   | Data encrypted in transit                               | TC-SEC-030                                       |
| SEC-SEC-001   | Secrets absent from source code                         | TC-SEC-032, TC-SEC-033                           |
| SEC-INFRA-001 | Least-privilege service accounts                        | TC-SEC-040                                       |
| SEC-LOG-001   | Authentication events logged                            | TC-AUTH-006, TC-SEC-041                           |
| SEC-LOG-002   | Authorization failures logged                           | TC-AUTHZ-007, TC-SEC-042                         |
| SEC-LOG-003   | No sensitive data in logs                               | TC-AUTH-007, TC-SEC-043                           |

### 17.5 Database CDRs → Test Cases

| CDR     | Description                              | Test Cases                            |
| ------- | ---------------------------------------- | ------------------------------------- |
| CDR-001 | User and Account Data                     | TC-ADMIN-011, TC-DB-001               |
| CDR-002 | Textbook and Ingestion Metadata           | TC-PIPE-001, TC-DB-002                |
| CDR-003 | Hierarchical Content Structure            | TC-PIPE-020, TC-PIPE-022, TC-PIPE-031, TC-LEARN-040, TC-DB-003 |
| CDR-004 | Video and Script Assets                   | TC-PIPE-040, TC-DB-004                |
| CDR-005 | Quiz and Question Data                    | TC-PIPE-050, TC-PIPE-051, TC-DB-005   |
| CDR-006 | Review and Approval Status                | TC-ADMIN-003, TC-DB-006               |
| CDR-007 | Student Attempt and Progress Records      | TC-LEARN-004, TC-LEARN-011, TC-LEARN-030, TC-LEARN-031, TC-DB-007, TC-DB-008, TC-DB-009 |
| CDR-008 | Adaptive Quiz State                       | TC-PIPE-060, TC-PIPE-062, TC-LEARN-022, TC-DB-010 |
| CDR-009 | System Configuration and Settings         | TC-ADMIN-020, TC-ADMIN-021, TC-DB-011 |
| CDR-010 | Read-Only Mastery Summary Views           | TC-DASH-001, TC-LEARN-031, TC-DB-012  |

### 17.6 Architecture Verification → Test Cases

| Check     | Description                                      | Test Cases                                      |
| --------- | ------------------------------------------------ | ----------------------------------------------- |
| ARCH-V-003 | Six-stage pipeline covers full workflow          | TC-PIPE-071, TC-PIPE-060                        |
| ARCH-V-004 | Approval gate between pipeline and publication   | TC-PIPE-074, TC-ADMIN-003, TC-ADMIN-004, TC-SEC-013 |
| ARCH-V-005 | Pre-rendered video only; no real-time generation  | TC-PIPE-041, TC-LEARN-002, TC-PIPE-061          |
| ARCH-V-006 | Parent/teacher dashboards read-only summaries     | TC-DASH-002, TC-DASH-003, TC-DB-012             |

### 17.7 Security Verification Targets → Test Cases

| Target   | Description                                                    | Test Cases                                      |
| -------- | -------------------------------------------------------------- | ----------------------------------------------- |
| VER-001  | Every endpoint requires authentication                          | TC-AUTH-001, TC-LEARN-006, TC-DASH-006           |
| VER-002  | Role checks enforce access boundaries                           | TC-AUTHZ-002, TC-AUTHZ-003, TC-AUTHZ-004        |
| VER-003  | Parent/teacher dashboards return only summaries                  | TC-DASH-002, TC-DASH-003                         |
| VER-004  | Passwords as adaptive hashes; no plaintext in DB or logs         | TC-SEC-031, TC-SEC-043                           |
| VER-005  | Uploaded files validated, size-checked, inspected                | TC-SEC-001, TC-SEC-002, TC-SEC-003               |
| VER-006  | Textbook text separated from instructions; LLM output validated  | TC-SEC-010, TC-SEC-011                           |
| VER-007  | AI content reaches students only after approval                  | TC-SEC-013, TC-PIPE-074                          |
| VER-008  | API input validation; no internal details in errors              | TC-SEC-020, TC-SEC-021                           |
| VER-009  | CORS restricted to approved origins                              | TC-SEC-022                                       |
| VER-010  | Secrets absent from source, client bundles, and logs             | TC-SEC-032, TC-SEC-033, TC-SEC-043               |

---

## 18. Test Execution Record Template

> [!NOTE]
> This section is an **empty template**. It will be populated during test execution. No tests have been executed.

| Execution ID | Date | Test Case ID | Tester | Result | Defect ID | Notes |
| ------------ | ---- | ------------ | ------ | ------ | --------- | ----- |
|              |      |              |        |        |           |       |

### Result Values

- **Pass** — Test case executed and expected result observed.
- **Fail** — Test case executed and expected result not observed. Defect ID required.
- **Blocked** — Test case could not be executed due to a dependency or environment issue.
- **Skipped** — Test case intentionally not executed (reason documented in Notes).
- **Not Run** — Test case not yet attempted.

---

## 19. Verification Checklist

This checklist verifies the internal consistency and completeness of this testing specification.

| #  | Check                                                                                         | Status   |
| -- | --------------------------------------------------------------------------------------------- | -------- |
| 1  | Every PRD functional requirement (FR-001–FR-012) has at least one planned test case             | ✓ Mapped |
| 2  | Every PRD non-functional requirement (NFR-001–NFR-002) has at least one planned test case       | ✓ Mapped |
| 3  | Every SRS constraint (CON-001–CON-003) has at least one planned test case                       | ✓ Mapped |
| 4  | Every security control specified in `07_SECURITY.md` has at least one planned test case       | ✓ Mapped |
| 5  | Every security verification target (VER-001–VER-010) has at least one planned test case          | ✓ Mapped |
| 6  | Every database CDR (CDR-001–CDR-010) has at least one planned test case                          | ✓ Mapped |
| 7  | Every API endpoint (17 endpoints) has at least one planned contract test case                   | ✓ Mapped |
| 8  | Architecture verification checks (ARCH-V-003–ARCH-V-006) have corresponding planned test cases  | ✓ Mapped |
| 9  | All `[NEEDS DECISION]` and `[NEEDS CONFIRMATION]` items are explicitly marked                    | ✓ Marked |
| 10 | No test results, coverage percentages, or pass/fail claims are asserted without evidence         | ✓ Verified |
| 11 | No technologies are selected for unresolved decisions                                            | ✓ Verified |
| 12 | Test execution record (Sec 18) is empty — no tests claimed as executed                           | ✓ Verified |
| 13 | Document status is "Proposed Testing Specification — Pending Review" (v1.0 retained)            | ✓ Verified |

---

*End of document — 08_TESTING.md v1.0*
