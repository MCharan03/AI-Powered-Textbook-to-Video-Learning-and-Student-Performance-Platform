# AI‑Powered Textbook‑to‑Video Learning & Student Performance Platform

---

## 📚 Project Vision
A next‑generation educational platform that **automatically converts textbook PDFs into structured, short (5‑6 min) learning videos and adaptive quizzes**.  Students learn, are assessed, and receive personalized remediation while parents, teachers, and administrators monitor progress.

## 🎯 Core Problem
Manual digitisation of textbook content, video production, and assessment creation is time‑consuming and error‑prone. Learners also lack data‑driven, adaptive learning pathways that address their individual knowledge gaps.

## 💡 Proposed Solution
A **dual‑application architecture**:
- **Admin portal** (`admin.example.com`) – upload textbooks, trigger AI pipelines, review/approve generated videos & quizzes, manage users, configure thresholds.
- **Learning portal** (`learn.example.com`) – used by students, parents, and teachers to consume content, take quizzes, view analytics, and track mastery.

The AI pipeline performs:
1. PDF ingestion & OCR
2. Hierarchical extraction (chapters → topics → subtopics)
3. Intelligent content segmentation targeting ~5‑6 min video units
4. Script generation → video synthesis
5. Quiz generation aligned to learning objectives
6. Adaptive quiz regeneration based on student performance

## 🛠️ Key Features (MVP)
- PDF upload & AI‑driven content extraction
- Automated 5‑6 min video generation (pre‑rendered)
- Auto‑generated quizzes per topic
- Admin review workflow before publishing
- Student portal with video playback, progress tracking, and quiz attempts
- Basic adaptive quiz (new questions for weak concepts)
- Read‑only parent & teacher dashboards
- Configurable mastery thresholds and adaptive settings

## 📂 Repository Structure (initial)
```
README.md                ← Project overview (this file)
src/                     ← Source code (to be added)
docs/                    ← Design docs, PRDs, diagrams
.gitignore               ← Git ignore patterns
```

## 🚀 Quick‑Start (local development)
1. **Clone the repository**
   ```bash
   git clone https://github.com/MCharan03/AI-Powered-Textbook-to-Video-Learning-and-Student-Performance-Platform.git
   cd AI-Powered-Textbook-to-Video-Learning-and-Student-Performance-Platform
   ```
2. **Set up the Python environment** (example using `uv` or `pip`)
   ```bash
   # Using uv (recommended)
   uv venv
   uv pip install -r requirements.txt
   ```
3. **Run the backend** (placeholder command)
   ```bash
   python -m src.main  # adjust as implementation evolves
   ```
4. **Open the frontend**
   - Admin UI: `https://admin.example.com`
   - Learning UI: `https://learn.example.com`

## 📦 Technologies (to be finalised)
- Backend: **Python** (FastAPI) / **Node.js** (Express) – decision pending
- Frontend: **React** (TypeScript) with component libraries
- AI services: OCR (Tesseract / Azure Form Recognizer), LLMs (OpenAI / Anthropic), Text‑to‑Video (Runway, Pictory, or custom pipeline)
- Storage: Cloud object store (AWS S3 / Azure Blob) for PDFs, videos, and assets
- Database: PostgreSQL (relational) + optional vector store for semantic retrieval

## 📈 Roadmap (high‑level)
- **Phase 1** – MVP implementation (core pipeline, admin review, student portal)
- **Phase 2** – Adaptive quiz engine, teacher & parent analytics
- **Phase 3** – Advanced AI refinements, video streaming CDN, multi‑language support
- **Phase 4** – Scaling, CI/CD, monitoring, security hardening

---

*For detailed design documents, see the `docs/` folder (to be added).*
