# 01 — Product Requirements Document

## 1. Document Information
- **Document Title:** Product Requirements Document (PRD) — AI-Powered Textbook-to-Video Learning & Student Performance Platform
- **Document Version:** 1.0
- **Status:** Baseline / Initial Draft
- **Author:** PRD Architect
- **Source of Truth:** `README.md`

## 2. Product Overview
The AI-Powered Textbook-to-Video Learning & Student Performance Platform is an educational platform operating on a dual-application architecture:
- **Admin Portal** (`admin.example.com`): Enables administrators to upload textbooks, trigger AI processing pipelines, review and approve generated videos and quizzes, manage users, and configure operational thresholds.
- **Learning Portal** (`learn.example.com`): Serves students, parents, and teachers by providing video content playback, quiz execution, analytics viewing, and mastery tracking.

## 3. Vision
A next-generation educational platform that automatically converts textbook PDFs into structured, short (5–6 min) learning videos and adaptive quizzes. Students learn, are assessed, and receive personalized remediation while parents, teachers, and administrators monitor progress.

## 4. Problem Statement
Manual digitisation of textbook content, video production, and assessment creation is time-consuming and error-prone. Learners also lack data-driven, adaptive learning pathways that address their individual knowledge gaps.

## 5. Proposed Solution
A dual-application architecture comprising an Admin portal (`admin.example.com`) and a Learning portal (`learn.example.com`), powered by an automated AI pipeline that processes textbook PDFs, generates structured video units and quizzes, supports admin approval, and delivers content with adaptive assessment and multi-role progress tracking.

## 6. Target Users
- **Students**: Primary content consumers who watch learning videos, take quizzes, view analytics, and undergo adaptive remediation.
- **Parents**: Viewers of read-only dashboards to monitor student progress and track mastery.
- **Teachers**: Viewers of read-only dashboards to monitor student progress and track mastery.
- **Administrators**: Managers who upload textbooks, trigger AI pipelines, review/approve generated videos and quizzes, manage users, and configure thresholds.

## 7. Core Product Workflow
The core product workflow follows the 6-stage AI pipeline defined in the README:

1. **PDF Ingestion & OCR**
2. **Hierarchical Extraction** (chapters → topics → subtopics)
3. **Intelligent Content Segmentation** (targeting ~5–6 min video units)
4. **Script Generation → Video Synthesis**
5. **Quiz Generation** (aligned to learning objectives)
6. **Adaptive Quiz Regeneration** (based on student performance)

## 8. User Journeys

### Administrator Journey
1. Log in to Admin portal (`admin.example.com`).
2. Upload textbook PDF.
3. Trigger AI processing pipeline (PDF ingestion, hierarchical extraction, content segmentation, script generation, video synthesis, quiz generation).
4. Review and approve generated videos and quizzes.
5. Manage platform users.
6. Configure mastery thresholds and adaptive settings.

### Student Journey
1. Log in to Learning portal (`learn.example.com`).
2. Consume pre-rendered short (5–6 min) video units.
3. Complete topic-aligned auto-generated quizzes and submit attempts.
4. Receive basic adaptive quiz recommendations (new questions for weak concepts based on performance).
5. View personal learning analytics and track topic mastery.

### Parent & Teacher Journey
1. Log in to Learning portal (`learn.example.com`).
2. Access read-only dashboards.
3. View student progress, performance analytics, and mastery tracking.

## 9. Core Features

| Feature | Description | Status |
|---|---|---|
| PDF Upload & Content Extraction | Ability to upload textbook PDFs and extract content using AI-driven ingestion and OCR. | MVP |
| Automated Video Generation | Generation of pre-rendered 5–6 min video units from extracted content. | MVP |
| Auto-Generated Quizzes | Generation of topic-aligned quizzes based on learning objectives. | MVP |
| Admin Review Workflow | Admin portal workflow to review and approve generated videos and quizzes before publishing. | MVP |
| Student Portal | Learning portal features for video playback, progress tracking, and recording quiz attempts. | MVP |
| Basic Adaptive Quiz | Generation of new quiz questions for weak concepts based on student performance. | MVP |
| Read-Only Parent & Teacher Dashboards | Dashboards providing read-only progress and mastery monitoring for parents and teachers. | MVP |
| Configurable Mastery Thresholds & Adaptive Settings | Admin capability to configure mastery thresholds and adaptive assessment parameters. | MVP |

## 10. MVP Scope
The MVP scope consists strictly of the following 8 core capabilities:
- PDF upload & AI-driven content extraction
- Automated 5–6 min video generation (pre-rendered)
- Auto-generated quizzes per topic
- Admin review workflow before publishing
- Student portal with video playback, progress tracking, and quiz attempts
- Basic adaptive quiz (new questions for weak concepts)
- Read-only parent & teacher dashboards
- Configurable mastery thresholds and adaptive settings

## 11. Post-MVP / Roadmap

### Phase 1 — MVP
- Core pipeline implementation
- Admin review workflow
- Student portal

### Phase 2
- Adaptive quiz engine
- Teacher & parent analytics

### Phase 3
- Advanced AI refinements
- Video streaming CDN
- Multi-language support

### Phase 4
- Scaling
- CI/CD
- Monitoring
- Security hardening

## 12. Functional Requirements

- **FR-001:** The system shall allow administrators to upload textbook PDFs via the Admin portal (`admin.example.com`).
- **FR-002:** The system shall perform OCR and AI-driven content extraction on ingested PDFs.
- **FR-003:** The system shall hierarchically extract textbook content into chapters, topics, and subtopics.
- **FR-004:** The system shall segment content into units targeting ~5–6 minutes of video duration.
- **FR-005:** The system shall automatically generate video scripts and synthesize pre-rendered 5–6 minute videos from segmented content.
- **FR-006:** The system shall automatically generate quizzes aligned to topic learning objectives.
- **FR-007:** The system shall provide an Admin review workflow allowing administrators to review and approve generated videos and quizzes prior to publication.
- **FR-008:** The system shall enable administrators to manage users within the Admin portal.
- **FR-009:** The system shall allow administrators to configure mastery thresholds and adaptive assessment settings.
- **FR-010:** The system shall provide a Learning portal (`learn.example.com`) for students to play pre-rendered videos, submit quiz attempts, and track progress.
- **FR-011:** The system shall support basic adaptive quizzes by generating new questions targeting weak concepts identified through student performance.
- **FR-012:** The system shall provide read-only dashboards on the Learning portal for parents and teachers to monitor student progress and mastery.

## 13. Non-Functional Requirements

- **NFR-001 (Video Duration Constraint):** Video units generated by the AI pipeline must target a duration of 5–6 minutes.
- **NFR-002 (Video Delivery Model):** Generated learning videos must be pre-rendered prior to publishing.
- **NFR-003 (Backend Architecture Candidate):** `[NEEDS DECISION]` Backend technology selection between Python (FastAPI) and Node.js (Express).
- **NFR-004 (Frontend Framework):** Frontend client applications built with React (TypeScript) and component libraries.
- **NFR-005 (OCR Technology Candidate):** `[NEEDS DECISION]` OCR service selection between Tesseract and Azure Form Recognizer.
- **NFR-006 (LLM Service Candidate):** `[NEEDS DECISION]` LLM provider selection between OpenAI and Anthropic.
- **NFR-007 (Video Synthesis Candidate):** `[NEEDS DECISION]` Text-to-Video engine selection between Runway, Pictory, or custom pipeline.
- **NFR-008 (Cloud Storage Candidate):** `[NEEDS DECISION]` Object storage selection between AWS S3 and Azure Blob for storing PDFs, videos, and assets.
- **NFR-009 (Database Technology Candidate):** Primary relational database using PostgreSQL, with an optional vector store candidate `[NEEDS DECISION]` for semantic retrieval.

## 14. Constraints
- **C-001:** Input source for content extraction is constrained to PDF textbook files.
- **C-002:** Generated video content must be pre-rendered before publishing via the Admin review workflow.
- **C-003:** Architecture is constrained to a dual-application structure (`admin.example.com` and `learn.example.com`).

## 15. Assumptions
No explicit assumptions are defined in the source README.

## 16. Out of Scope
The following items are explicitly deferred to post-MVP phases or excluded from Phase 1:
- Advanced adaptive quiz engine features (deferred to Phase 2)
- Advanced teacher & parent analytics (deferred to Phase 2)
- Advanced AI refinements (deferred to Phase 3)
- Dedicated video streaming CDN (deferred to Phase 3)
- Multi-language support (deferred to Phase 3)
- Platform scaling, automated CI/CD pipelines, system monitoring, and security hardening (deferred to Phase 4)

## 17. Success Criteria
Quantitative success metrics are `[NEEDS DECISION]`.

## 18. Open Decisions

| Decision Area | Candidates / Options Stated in README | Current Status |
|---|---|---|
| Backend Framework | Python (FastAPI) vs Node.js (Express) | `[NEEDS DECISION]` (Decision pending) |
| OCR Engine | Tesseract vs Azure Form Recognizer | `[NEEDS DECISION]` (To be finalised) |
| LLM Provider | OpenAI vs Anthropic | `[NEEDS DECISION]` (To be finalised) |
| Text-to-Video Engine | Runway vs Pictory vs Custom pipeline | `[NEEDS DECISION]` (To be finalised) |
| Cloud Object Storage | AWS S3 vs Azure Blob | `[NEEDS DECISION]` (To be finalised) |
| Vector Storage | Optional vector store alongside PostgreSQL | `[NEEDS DECISION]` (To be finalised) |

## 19. Traceability

| PRD Item | README Source |
|---|---|
| Section 2 (Product Overview) | Section: `## 💡 Proposed Solution` (lines 12–15) |
| Section 3 (Vision) | Section: `## 📚 Project Vision` (lines 5–6) |
| Section 4 (Problem Statement) | Section: `## 🎯 Core Problem` (lines 8–9) |
| Section 5 (Proposed Solution) | Section: `## 💡 Proposed Solution` (lines 11–23) |
| Section 6 (Target Users) | Section: `## 📚 Project Vision` & `## 💡 Proposed Solution` (lines 6, 14) |
| Section 7 (Core Product Workflow) | Section: `## 💡 Proposed Solution` (lines 16–23) |
| Section 8 (User Journeys) | Section: `## 💡 Proposed Solution` & `## 🛠️ Key Features (MVP)` (lines 13–15, 25–33) |
| Section 9 (Core Features) | Section: `## 🛠️ Key Features (MVP)` (lines 24–33) |
| Section 10 (MVP Scope) | Section: `## 🛠️ Key Features (MVP)` (lines 24–33) |
| Section 11 (Post-MVP / Roadmap) | Section: `## 📈 Roadmap (high‑level)` (lines 69–74) |
| Section 12 (FR-001 to FR-012) | Section: `## 💡 Proposed Solution` & `## 🛠️ Key Features (MVP)` (lines 12–33) |
| Section 13 (NFR-001 to NFR-009) | Section: `## 📚 Project Vision`, `## 🛠️ Key Features (MVP)`, `## 📦 Technologies` (lines 6, 19, 26, 62–67) |
| Section 14 (Constraints) | Section: `## 📚 Project Vision`, `## 💡 Proposed Solution`, `## 🛠️ Key Features (MVP)` (lines 6, 12-15, 26) |
| Section 15 (Assumptions) | Explicitly absent in `README.md` |
| Section 16 (Out of Scope) | Section: `## 📈 Roadmap (high‑level)` (lines 69–74) |
| Section 17 (Success Criteria) | Explicitly absent in `README.md` |
| Section 18 (Open Decisions) | Section: `## 📦 Technologies (to be finalised)` (lines 62–67) |

## 20. PRD Validation

- [x] Every major feature exists in README
- [x] Every user role exists in README
- [x] MVP matches README
- [x] Roadmap matches README
- [x] Technology candidates remain undecided
- [x] No unsupported requirements were introduced
- [x] No invented metrics were introduced
- [x] No invented security/compliance requirements were introduced
- [x] No invented workflows were introduced
- [x] No candidate technology was presented as finalized
- [x] No roadmap item was expanded beyond the README
