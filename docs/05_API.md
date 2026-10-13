# 05 — API Conceptual Specification

## 1. Document Information
- **Document Title:** API Conceptual Specification
- **Document Version:** 1.0 (Draft / Proposed)
- **Status:** Proposed API Specification — Pending Review
- **Author:** API Architect
- **Source Baselines:** `README.md`, locked `docs/01_PRD.md` (v1.0), locked `docs/02_REQUIREMENTS.md` (v1.2), locked `docs/03_SYSTEM_ARCHITECTURE.md` (v1.0), and approved `docs/04_DATABASE.md` (v1.0).

## 2. Purpose and Scope
The purpose of this specification is to define the logical Application Programming Interface (API) surface for the AI-Powered Textbook-to-Video Learning & Student Performance Platform. It translates product, software, architectural, and database requirements into structured conceptual endpoint definitions.

### 2.1 Scope Boundaries
- **MVP (Phase 1) In-Scope Capabilities**:
  - Textbook PDF upload and pipeline ingestion triggering
  - Hierarchical content extraction viewing (chapters → topics → subtopics)
  - Pre-rendered learning video unit playback metadata and generated scripts (~5–6 min units)
  - Topic-aligned auto-generated quiz retrieval and submission
  - Admin inspection, review, approval, and publishing gate workflow
  - Admin user management and configurable mastery threshold settings
  - Student video playback progress recording and quiz attempts
  - Basic adaptive quiz question retrieval for weak concepts
  - Read-only dashboard summary retrieval for parents and teachers
- **Deferred / Post-MVP Capabilities**:
  - Advanced adaptive quiz engine APIs (deferred to Phase 2)
  - Advanced parent/teacher analytics APIs (deferred to Phase 2)
  - Dedicated video streaming CDN APIs (deferred to Phase 3)
  - Multi-language API localization (deferred to Phase 3)
  - Automated CI/CD, system monitoring, and scaling infrastructure APIs (deferred to Phase 4)

## 3. API Design Principles
1. **Dual Portal Separation**: Endpoints are logically partitioned between `admin.example.com` (Admin Portal) and `learn.example.com` (Learning Portal).
2. **Publishing Governance Gate**: Learning Portal endpoints return only pre-rendered videos and quizzes that have explicitly passed administrator review and approval.
3. **Role-Based Scope Alignment**: Administrative endpoints are restricted to Administrators; learning/playback/quiz endpoints serve Students; progress and mastery summaries are served read-only to Parents and Teachers.
4. **Conceptual Abstraction**: Endpoint paths, request parameters, and response structures represent logical design contracts. Physical implementation details (e.g., FastAPI vs Express frameworks, database query implementation, JSON schema validation libraries) are deferred until technology selections are finalized.

## 4. API Versioning and Base URL (`[NEEDS DECISION]`)

The exact network topology, base URLs, and protocol versioning strategies remain open decisions pending framework selection:

| Property | Stated Source / Proposed Baseline | Status |
|---|---|---|
| Admin API Base URL | `https://admin.example.com/api/v1` | Proposed Base URL — `[NEEDS DECISION]` |
| Learning API Base URL | `https://learn.example.com/api/v1` | Proposed Base URL — `[NEEDS DECISION]` |
| API Versioning Strategy | URL Path Versioning (e.g., `/api/v1/...`) | Candidate Strategy — `[NEEDS DECISION]` |
| Transport Protocol | HTTPS Protocol Selection | Candidate Baseline — `[NEEDS DECISION]` |

## 5. Authentication and Authorization (`[NEEDS DECISION]`)

The platform requirements establish four distinct user roles (Administrators, Students, Parents, Teachers), but specific identity provider implementations and token standards remain unresolved:

- **Confirmed Role Scope Definitions**:
  - **Administrator**: Documented administrative capabilities on `admin.example.com` (textbook PDF uploading, AI pipeline execution triggering, review and approval of generated videos and quizzes, user management, and configuration of mastery thresholds and adaptive assessment parameters).
  - **Student**: Access to published video playback, quiz attempts, personal progress tracking, and basic adaptive quizzes on `learn.example.com`.
  - **Parent**: Access to read-only student progress and mastery dashboards on `learn.example.com`.
  - **Teacher**: Access to read-only student progress and mastery dashboards on `learn.example.com`.

- **Unresolved Technology Decisions (`[NEEDS DECISION]`)**:
  - Identity & Authentication Standard (OAuth 2.0 / OIDC / JWT / Session Cookies): `[NEEDS DECISION]`.
  - Token Header Format (e.g., `Authorization: Bearer <token>`): `[NEEDS DECISION]`.
  - Granular RBAC Role-Permission Scopes & Row-Level Security Rules: `[NEEDS DECISION]`.

## 6. API Endpoint Inventory

The following table summarizes the conceptual endpoint inventory across administrative and learning portals:

| Logical Endpoint Path | Method | Domain / Portal | Primary Actor | Purpose | Classification |
|---|---|---|---|---|---|
| `/admin/textbooks` | POST | `admin.example.com` | Administrator | Upload textbook PDF file | Proposed (Confirmed Requirement) |
| `/admin/textbooks/{id}/pipeline` | POST | `admin.example.com` | Administrator | Trigger 6-stage AI processing pipeline | Proposed (Confirmed Requirement) |
| `/admin/textbooks/{id}/status` | GET | `admin.example.com` | Administrator | Retrieve AI pipeline execution status | Proposed (Confirmed Requirement) |
| `/admin/textbooks/{id}/hierarchy` | GET | `admin.example.com` | Administrator | Retrieve extracted chapter/topic hierarchy | Proposed (Confirmed Requirement) |
| `/admin/review/items` | GET | `admin.example.com` | Administrator | List generated videos/quizzes pending review | Proposed (Confirmed Requirement) |
| `/admin/review/items/{id}` | GET | `admin.example.com` | Administrator | Inspect generated script & video/quiz metadata before approval | Proposed (Confirmed Requirement) |
| `/admin/review/items/{id}/approval` | POST | `admin.example.com` | Administrator | Approve generated video or quiz for publishing | Proposed (Confirmed Requirement) |
| `/admin/users` | GET / POST | `admin.example.com` | Administrator | List and manage platform user accounts | Proposed (Confirmed Requirement) |
| `/admin/settings/thresholds` | GET / PUT | `admin.example.com` | Administrator | Retrieve/configure mastery thresholds & settings | Proposed (Confirmed Requirement) |
| `/learn/videos/{id}` | GET | `learn.example.com` | Student | Play pre-rendered 5–6 min learning video unit | Proposed (Confirmed Requirement) |
| `/learn/videos/{id}/progress` | POST | `learn.example.com` | Student | Record student video playback progress | Proposed (Proposed Concept) |
| `/learn/topics/{topicId}/quiz` | GET | `learn.example.com` | Student | Retrieve published topic quiz & questions | Proposed (Confirmed Requirement) |
| `/learn/quizzes/{id}/attempts` | POST | `learn.example.com` | Student | Submit quiz attempt responses and record score | Proposed (Confirmed Requirement) |
| `/learn/quizzes/adaptive` | GET | `learn.example.com` | Student | Retrieve basic adaptive quiz for weak concepts | Proposed (Confirmed Requirement) |
| `/learn/dashboards/progress` | GET | `learn.example.com` | Parent / Teacher | Retrieve read-only progress & mastery summary | Proposed (Confirmed Requirement) |

## 7. Request and Response Conventions

All API endpoints follow standardized JSON messaging conventions at a conceptual level:

### 7.1 Illustrative Success Response Format (Conceptual Example)
```json
{
  "status": "success",
  "data": {},
  "metadata": {
    "timestamp": "2026-10-10T14:48:00Z"
  }
}
```

### 7.2 Conceptual Status Codes (Illustrative)
- `200 OK`: Illustrative status for successful retrieval or synchronous processing.
- `201 Created`: Illustrative status for resource creation (e.g., PDF upload, quiz attempt submission).
- `202 Accepted`: Illustrative status for asynchronous task initiation (e.g., AI pipeline execution).
- `400 Bad Request`: Illustrative status for client parameter errors.
- `401 Unauthorized` / `403 Forbidden`: Illustrative status for unauthorized access attempts.
- `404 Not Found`: Illustrative status for unlocated resources.
- `500 Internal Server Error`: Illustrative status for server processing failures.

*(Note: Specific HTTP status code mapping and JSON schema definitions are illustrative and remain `[NEEDS DECISION]` until backend technology selection).*

## 8. Error Handling

When an error occurs, the API returns an illustrative conceptual error payload:

```json
{
  "status": "error",
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested published video unit was not found.",
    "details": []
  },
  "metadata": {
    "timestamp": "2026-10-10T14:48:00Z"
  }
}
```

Error classifications and error message translations remain `[NEEDS DECISION]`.

## 9. Pagination, Filtering, and Sorting (`[NEEDS DECISION]`)

For list-retrieval endpoints (e.g., admin user lists, review item queues), pagination and filtering conventions are established conceptually:
- **Pagination Strategy**: Query parameters `page` and `limit` (e.g., `?page=1&limit=20`) vs cursor-based pagination remains `[NEEDS DECISION]`.
- **Filtering Parameters**: Category/status filtering (e.g., `?status=pending_review`).
- **Sorting Parameters**: Sort field and direction (e.g., `?sort=-created_at`).

## 10. File Upload and Content Delivery

### 10.1 Inbound Textbook PDF Upload
- **Method & Path**: `POST /admin/textbooks`
- **Domain**: `admin.example.com`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-001`, `SRS REQ-FR-001`, `CDR-002`
- **Conceptual Request**: Multipart form upload containing PDF binary file and document title metadata.
- **Conceptual Response**: Textbook ID, file size, ingestion timestamp, and status (`uploaded`).
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 10.2 Pre-Rendered Video Delivery
- **Method & Path**: `GET /learn/videos/{id}`
- **Domain**: `learn.example.com`
- **Actor**: Student
- **Requirement Source**: `PRD FR-004, FR-005, FR-010`, `SRS REQ-FR-005, REQ-FR-011`, `REQ-NFR-001, REQ-NFR-002`, `CDR-004`
- **Conceptual Request**: Video unit ID parameter.
- **Conceptual Response**: Pre-rendered video streaming URL / asset reference, video duration (5–6 min target), topic title, and script text.
- **Classification**: Proposed Endpoint (Confirmed Requirement).
- **Streaming Technology Decision**: Direct object storage URL vs streaming CDN is deferred to Phase 3 (`[NEEDS DECISION]`).

## 11. Admin Review and Publishing Workflow

The administrator workflow endpoints enforce the source-backed publishing gate prior to content availability on `learn.example.com`:

### 11.1 Trigger AI Processing Pipeline
- **Method & Path**: `POST /admin/textbooks/{id}/pipeline`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-002 to FR-006`, `SRS REQ-FR-002 to REQ-FR-006`, `Arch Sec 3`
- **Conceptual Request**: Textbook ID and processing pipeline options.
- **Conceptual Response**: Pipeline task execution ID, status (`processing`), and timestamp.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.2 Retrieve Pipeline Processing Status
- **Method & Path**: `GET /admin/textbooks/{id}/status`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-002`, `SRS REQ-FR-002`, `Arch Sec 3`
- **Conceptual Request**: Textbook ID.
- **Conceptual Response**: Current pipeline execution status across the six processing stages defined in source documents (Stage 1–6 status). Additional response parameters (e.g. percentage progress, completion timestamps) are illustrative proposed representations (`[NEEDS CONFIRMATION]`).
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.3 Retrieve Extracted Hierarchy
- **Method & Path**: `GET /admin/textbooks/{id}/hierarchy`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-003`, `SRS REQ-FR-003`, `CDR-003`
- **Conceptual Request**: Textbook ID.
- **Conceptual Response**: Nested list of Chapters, Topics, and Subtopics extracted from the textbook.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.4 List Generated Items Awaiting Review
- **Method & Path**: `GET /admin/review/items`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-007`, `SRS REQ-FR-008`, `CDR-006`, `Arch Sec 4`
- **Conceptual Request**: Filter parameters (e.g., `?status=pending_review`).
- **Conceptual Response**: List of generated video learning units and topic quizzes awaiting admin approval.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.5 Inspect Generated Content Item
- **Method & Path**: `GET /admin/review/items/{id}`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-007`, `SRS REQ-FR-008`, `CDR-004, CDR-005, CDR-006`, `Arch Sec 4`
- **Conceptual Request**: Generated item ID (video learning unit ID or topic quiz ID).
- **Conceptual Response**: Generated script text, video asset metadata, quiz questions/options, and current review status (unpublished/awaiting review).
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.6 Approve Generated Video or Quiz
- **Method & Path**: `POST /admin/review/items/{id}/approval`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-007`, `SRS REQ-FR-008`, `CDR-006`, `Arch Sec 4`
- **Conceptual Request**: Approval decision payload (e.g. approval intent; rejection handling, retry behavior, and unestablished transitions remain `[NEEDS CONFIRMATION]`), review notes, and admin identifier.
- **Conceptual Response**: Item ID, conceptual resulting status (`published` upon successful approval; the endpoint does not imply every request automatically publishes without successful approval validation), and approval timestamp.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.7 User Management Endpoints
- **Method & Path**: `GET /admin/users`, `POST /admin/users`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-008`, `SRS REQ-FR-009`, `CDR-001`
- **Conceptual Request**: User profile attributes (name, email, role assignment).
- **Conceptual Response**: Created/listed user account details and role assignment.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 11.8 Mastery Thresholds & Adaptive Settings
- **Method & Path**: `GET /admin/settings/thresholds`, `PUT /admin/settings/thresholds`
- **Actor**: Administrator
- **Requirement Source**: `PRD FR-009`, `SRS REQ-FR-010`, `CDR-009`
- **Conceptual Request**: Mastery threshold parameters and adaptive quiz configuration settings.
- **Conceptual Response**: Updated configuration settings object.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

## 12. Student Learning, Progress, and Quiz Workflow

The student endpoints support content playback, quiz submission, progress tracking, and basic adaptive remediation on `learn.example.com`:

### 12.1 Play Published Video Unit
- **Method & Path**: `GET /learn/videos/{id}`
- **Actor**: Student
- **Requirement Source**: `PRD FR-010`, `SRS REQ-FR-011`, `CDR-004`
- **Conceptual Request**: Video unit ID.
- **Conceptual Response**: Pre-rendered 5–6 min video URL, script text, and topic metadata (published content only).
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 12.2 Record Video Playback Progress
- **Method & Path**: `POST /learn/videos/{id}/progress`
- **Actor**: Student
- **Requirement Source**: `PRD FR-010`, `SRS REQ-FR-011`, `CDR-007`, `DB E-VIDEO-PROGRESS`
- **Conceptual Request**: Video ID, current playback progress payload.
- **Conceptual Response**: Updated video progress status.
- **Classification**: Proposed Endpoint (Proposed Concept — Progress granularity remains `[NEEDS CONFIRMATION]`).

### 12.3 Retrieve Published Topic Quiz
- **Method & Path**: `GET /learn/topics/{topicId}/quiz`
- **Actor**: Student
- **Requirement Source**: `PRD FR-006, FR-010`, `SRS REQ-FR-006, REQ-FR-011`, `CDR-005`
- **Conceptual Request**: Topic ID.
- **Conceptual Response**: Quiz ID, topic title, question list, and options (published content only).
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 12.4 Submit Quiz Attempt
- **Method & Path**: `POST /learn/quizzes/{id}/attempts`
- **Actor**: Student
- **Requirement Source**: `PRD FR-010`, `SRS REQ-FR-011`, `CDR-007`, `DB E-QUIZ-ATTEMPT`
- **Conceptual Request**: Quiz ID, selected question answers, submission timestamp.
- **Conceptual Response**: Attempt ID, calculated score, concept mastery result, and identified weak concepts.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

### 12.5 Retrieve Basic Adaptive Quiz Questions
- **Method & Path**: `GET /learn/quizzes/adaptive`
- **Actor**: Student
- **Requirement Source**: `PRD FR-011`, `SRS REQ-FR-007`, `CDR-008`, `DB E-ADAPTIVE-ITEM`
- **Conceptual Request**: Student context parameter (passing student_id explicitly vs extracting from session/token is an unconfirmed design choice — `[NEEDS CONFIRMATION]`), topic/concept context.
- **Conceptual Response**: Illustrative list of generated basic adaptive quiz questions targeting identified weak concepts.
- **Classification**: Proposed Endpoint (Confirmed Requirement).

## 13. Parent/Teacher Read-Only Dashboard Access

Parent and Teacher endpoints provide read-only access to student progress and concept mastery summaries on `learn.example.com`:

### 13.1 Retrieve Read-Only Dashboard Progress & Mastery Summary
- **Method & Path**: `GET /learn/dashboards/progress`
- **Actor**: Parent / Teacher
- **Requirement Source**: `PRD FR-012`, `SRS REQ-FR-012`, `CDR-010`, `DB E-MASTERY`
- **Conceptual Request**: Student ID query parameter (e.g., `?student_id=123`; passing an explicit `student_id` is a proposed, unconfirmed design choice — `[NEEDS CONFIRMATION]`).
- **Conceptual Response**: Read-only progress summary, completed topics list, concept mastery scores, and weak concept flags.
- **Classification**: Proposed Endpoint (Confirmed Requirement).
- **Access Boundary Enforcement**: Parents and teachers are restricted to read-only dashboard summary views. The authorization mechanism for validating parent/teacher-to-student associations remains `[NEEDS CONFIRMATION]`. Direct endpoints to raw video progress, quiz attempt logs, or textbook assets remain marked `[NEEDS CONFIRMATION]`.

## 14. API Security Considerations (`[NEEDS DECISION]`)

- **Transport Security**: Transport Layer Security (TLS) protocol configuration and HTTP encryption parameters (`[NEEDS DECISION]`).
- **Cross-Origin Resource Sharing (CORS)**: Domain restriction policies between `admin.example.com` and `learn.example.com` (`[NEEDS DECISION]`).
- **Rate Limiting & Throttling**: API request rate limiting and throttling policies (`[NEEDS DECISION]`).
- **Input Validation & Sanitization**: Server-side request parameters and body validation policies (`[NEEDS DECISION]`).

## 15. Logging and Audit Considerations (`[NEEDS DECISION]`)

- **Administrative Audit Logging**: Administrative action recording (e.g., tracking PDF uploads, pipeline execution triggers, video/quiz approvals, threshold changes) (`Proposed Consideration — [NEEDS DECISION]` on storage format, policies, and retention).
- **Operational Logging**: Request error logging and system operational logging policies (`Proposed Consideration — [NEEDS DECISION]`).

## 16. Open Questions and Decisions

1. **Backend Framework Selection**: FastAPI (Python) vs. Express (Node.js) (`[NEEDS DECISION]`).
2. **API Base URL & Gateway Topology**: Network routing and gateway architecture (`[NEEDS DECISION]`).
3. **Authentication & Token Standard**: OAuth 2.0 / OIDC vs JWT vs Session Cookies (`[NEEDS DECISION]`).
4. **Video Streaming Delivery Strategy**: Direct cloud object store signed URLs vs CDN streaming delivery (`[NEEDS DECISION]`).
5. **Video Playback Progress Granularity**: Timestamp offsets vs percentage milestones vs completion flags (`[NEEDS CONFIRMATION]`).
6. **Parent/Teacher Student Association Linkage**: Schema mechanism linking parent and teacher accounts to student records (`[NEEDS CONFIRMATION]`).
7. **Parent/Teacher Direct Resource Access**: Should parents or teachers have direct endpoint access to underlying video or quiz records beyond summary dashboards? (`[NEEDS CONFIRMATION]`).

## 17. Requirements Traceability Matrix

| Endpoint Path | PRD Source (`01_PRD.md`) | SRS Source (`02_REQUIREMENTS.md`) | Architecture Source (`03_SYSTEM_ARCHITECTURE.md`) | Database Source (`04_DATABASE.md`) | README Source |
|---|---|---|---|---|---|
| `POST /admin/textbooks` | FR-001, Sec 7 (Stage 1) | REQ-FR-001, Sec 3.1 | Sec 3 (Stage 1), Sec 5.1 | CDR-002, `E-TEXTBOOK` | Line 25 |
| `POST /admin/textbooks/{id}/pipeline` | FR-002 to FR-006 | REQ-FR-002 to REQ-FR-006 | Sec 3 (Stages 1–6), Sec 5.1 | CDR-002 to CDR-005 | Line 13 |
| `GET /admin/textbooks/{id}/status` | FR-002, Sec 7 (Stage 1) | REQ-FR-002, Sec 3.1 | Sec 3 (Stage 1) | CDR-002 | Line 13 |
| `GET /admin/textbooks/{id}/hierarchy` | FR-003, Sec 7 (Stage 2) | REQ-FR-003, Sec 3.1 | Sec 3 (Stage 2) | CDR-003, `E-HIERARCHY` | Line 18 |
| `GET /admin/review/items` | FR-007, Sec 8 | REQ-FR-008, CON-002 | Sec 4, Sec 5.1 | CDR-006, `E-REVIEW-STATUS` | Line 28 |
| `GET /admin/review/items/{id}` | FR-007, Sec 8 | REQ-FR-008, CON-002 | Sec 4, Sec 5.1 | CDR-004, CDR-005, CDR-006 | Line 28 |
| `POST /admin/review/items/{id}/approval` | FR-007, Sec 8 | REQ-FR-008, CON-002 | Sec 4, Sec 5.1 | CDR-006, `E-REVIEW-STATUS` | Line 28 |
| `GET / POST /admin/users` | FR-008, Sec 6 | REQ-FR-009, Sec 2.1 | Sec 5.1 | CDR-001, `E-USER` | Line 13 |
| `GET / PUT /admin/settings/thresholds` | FR-009, Sec 8 | REQ-FR-010, Sec 3.4 | Sec 5.1 | CDR-009, `E-SYSTEM-SETTINGS` | Line 32 |
| `GET /learn/videos/{id}` | FR-004, FR-005, FR-010 | REQ-FR-005, REQ-FR-011 | Sec 3 (Stage 4), Sec 5.2 | CDR-004, `E-VIDEO` | Lines 26, 29 |
| `POST /learn/videos/{id}/progress` | FR-010, Sec 8 | REQ-FR-011, Sec 3.5 | Sec 5.2 | CDR-007, `E-VIDEO-PROGRESS` | Lines 14, 29 |
| `GET /learn/topics/{topicId}/quiz` | FR-006, FR-010 | REQ-FR-006, REQ-FR-011 | Sec 3 (Stage 5), Sec 5.2 | CDR-005, `E-QUIZ` | Lines 27, 29 |
| `POST /learn/quizzes/{id}/attempts` | FR-010, Sec 8 | REQ-FR-011, Sec 3.5 | Sec 5.2 | CDR-007, `E-QUIZ-ATTEMPT` | Line 29 |
| `GET /learn/quizzes/adaptive` | FR-011, Sec 7 (Stage 6) | REQ-FR-007, Sec 3.3 | Sec 3 (Stage 6), Sec 5.2 | CDR-008, `E-ADAPTIVE-ITEM` | Line 30 |
| `GET /learn/dashboards/progress` | FR-012, Sec 8 | REQ-FR-012, Sec 3.5 | Sec 5.2 | CDR-010, `E-MASTERY` | Line 31 |

## 18. API Verification Checklist

- [x] Grounded strictly in locked sources (`README.md`, `01_PRD.md` v1.0, `02_REQUIREMENTS.md` v1.2, `03_SYSTEM_ARCHITECTURE.md` v1.0, `04_DATABASE.md` v1.0)
- [x] All 8 MVP features represented with proposed conceptual endpoints
- [x] Preserved dual portals (`admin.example.com` and `learn.example.com`)
- [x] Preserved pre-rendered video constraint (~5–6 minutes)
- [x] Preserved admin review and approval gate before publishing content
- [x] Explicitly added `GET /admin/review/items/{id}` for admin inspection of generated content prior to approval
- [x] Maintained read-only access boundary for parent and teacher dashboard endpoints
- [x] Clarified status response in Section 11.6 as resulting `published` status upon successful approval without implying automatic approval
- [x] Marked parent/teacher `student_id` query parameter and association validation mechanism as `[NEEDS CONFIRMATION]`
- [x] Kept all unresolved technology choices (FastAPI vs Express, auth protocol, gateway, storage URLs) marked `[NEEDS DECISION]`
- [x] Kept unconfirmed design choices marked `[NEEDS CONFIRMATION]`
- [x] All PRD, SRS, Architecture, Database, and README traceability citations verified against actual source files
- [x] Document status set to `Proposed API Specification — Pending Review` (v1.0)
