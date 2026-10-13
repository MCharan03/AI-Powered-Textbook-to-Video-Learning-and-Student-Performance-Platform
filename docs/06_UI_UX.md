# 06 — UI/UX Specification

## 1. Document Information
- **Document Title:** UI/UX Specification
- **Document Version:** 1.0 (Draft / Proposed)
- **Status:** Proposed UI/UX Specification — Pending Review
- **Author:** UI/UX Lead Architect
- **Source Baselines:** `README.md`, locked `docs/01_PRD.md` (v1.0), locked `docs/02_REQUIREMENTS.md` (v1.2), locked `docs/03_SYSTEM_ARCHITECTURE.md` (v1.0), approved `docs/04_DATABASE.md` (v1.0), and `docs/05_API.md` (v1.0).

## 2. Purpose, Scope, and Design Principles

### 2.1 Purpose & Scope
This specification defines the user experience, interface layout, visual design system, navigation model, and screen specifications for the AI-Powered Textbook-to-Video Learning & Student Performance Platform. It translates product, software, architectural, database, and API requirements into actionable design guidelines.

- **Dual-Portal Scope**:
  - **Admin Portal (`admin.example.com`)**: Administrative web interface for uploading textbook PDFs, triggering 6-stage AI pipelines, reviewing/approving generated videos and quizzes, managing users, and configuring mastery thresholds and adaptive settings.
  - **Learning Portal (`learn.example.com`)**: Student interface for consuming pre-rendered 5–6 min learning videos, attempting topic quizzes, viewing progress, and taking basic adaptive quizzes; parent/teacher interface for read-only progress and mastery monitoring.
- **MVP Scope Boundary**: Covers Phase 1 MVP capabilities. Post-MVP roadmap enhancements (Phase 2 advanced adaptive engine/analytics, Phase 3 CDN video streaming/multi-language, Phase 4 scaling/monitoring) are explicitly excluded from MVP screen designs.

### 2.2 Core Visual Design Principles
1. **Portal Theme Dualism**:
   - **Admin Portal**: Dark premium theme optimized for high-density monitoring, prolonged review sessions, and reduced visual fatigue.
   - **Learning Portal**: Light clean theme optimized for readability, educational focus, accessible contrast, and student engagement.
2. **Balanced 3D Depth & Tactility**:
   - Employs layered panels, realistic soft shadows, restrained elevation, and subtle hover effects.
   - Avoids heavy glassmorphism, distracting backdrop blurs, or excessive animations that degrade performance.
3. **Gated Pre-Rendered Content Layout**:
   - Designed around pre-rendered ~5–6 minute learning video units and topic quizzes.
   - Admin UI enforces an explicit review and approval step before content is published to the Learning Portal.
4. **Adaptive Navigation & Responsive Reflow**:
   - Fixed left sidebar navigation on desktop (≥ 1024px).
   - Collapsible navigation drawer/overlay and responsive grid reflow on tablet (768px–1023px) and mobile (< 768px).
5. **Accessibility & Motion Restraint**:
   - WCAG 2.1 AA is the design target for contrast, visible focus indicators, and minimum 44x44px touch targets; compliance must be verified through contrast checks and accessibility testing.
   - Respects user motion preferences (`prefers-reduced-motion`) by disabling non-essential transitions and transforms.

## 3. User Roles and User Journeys

### 3.1 Administrator Journey (`admin.example.com`)
1. **Login & Dashboard Access**: Admin logs into `admin.example.com` and views system overview metrics.
2. **Textbook PDF Ingestion**: Admin uploads a textbook PDF file via the ingestion interface.
3. **AI Pipeline Execution**: Admin triggers the 6-stage AI processing pipeline and monitors real-time processing status across Stages 1–6.
4. **Hierarchy & Asset Inspection**: Admin inspects extracted chapters/topics/subtopics, generated scripts, pre-rendered 5–6 min video metadata, and topic quizzes.
5. **Review & Approval Gate**: Admin reviews generated content items in the review queue and approves them for publication.
6. **Governance & Administration**: Admin manages user accounts and configures mastery thresholds and adaptive assessment parameters.

### 3.2 Student Journey (`learn.example.com`)
1. **Login & Learning Dashboard**: Student logs into `learn.example.com` and views current subject/topic progress.
2. **Video Unit Consumption**: Student opens a topic and views the pre-rendered 5–6 min video unit on a split player/playlist view (desktop) or stacked layout (mobile).
3. **Topic Quiz Assessment**: Student completes the auto-generated topic quiz and receives immediate score feedback.
4. **Adaptive Remediation**: Student receives basic adaptive quiz questions targeting identified weak concepts based on quiz performance.
5. **Mastery Tracking**: Student reviews personal topic mastery scores and progress history.

### 3.3 Parent & Teacher Journey (`learn.example.com`)
1. **Login & Dashboard View**: Parent/Teacher logs into `learn.example.com` and accesses read-only monitoring dashboards.
2. **Student Progress Summary**: Parent/Teacher selects a student summary context (`[NEEDS CONFIRMATION]`) to view topic completion progress, concept mastery scores, and weak concept flags.
3. **Read-Only Boundary Restriction**: Parent/Teacher views are restricted to aggregated dashboard summaries. Direct access to raw video playback logs, quiz attempt answer logs, or raw textbook files remains marked `[NEEDS CONFIRMATION]`.

## 4. Visual Design System

### 4.1 Theme Color Tokens

| Token Category | Admin Portal Token (Dark Premium) | Learning Portal Token (Light Clean) | Purpose |
|---|---|---|---|
| Background | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Main viewport canvas |
| Surface / Panel | `#1E293B` (Slate 800) | `#FFFFFF` (White) | Card containers, sidebar, modal background |
| Surface Raised | `#334155` (Slate 700) | `#F1F5F9` (Slate 100) | Hovered card, input background |
| Border / Divider | `#334155` (Slate 700) | `#E2E8F0` (Slate 200) | Container outlines and table row dividers |
| Primary Accent | `#6366F1` (Indigo 500) | `#2563EB` (Blue 600) | Buttons, active navigation, key focus rings |
| Primary Hover | `#4F46E5` (Indigo 600) | `#1D4ED8` (Blue 700) | Button hover & active state |
| Text Primary | `#F8FAFC` (Slate 50) | `#0F172A` (Slate 900) | Headings, main body text |
| Text Secondary | `#94A3B8` (Slate 400) | `#64748B` (Slate 500) | Subtitles, labels, metadata text |
| Success Indicator | `#10B981` (Emerald 500) | `#059669` (Emerald 600) | Approved status, high mastery score |
| Warning / Pending | `#F59E0B` (Amber 500) | `#D97706` (Amber 600) | Pending review, pipeline processing status |
| Error / Weak Concept | `#EF4444` (Red 500) | `#DC2626` (Red 600) | Failed pipeline step, weak concept flag |

### 4.2 Typography Stack & Scale
- **Font Family**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`.
- **Type Scale**:
  - **Display / H1**: 32px / Line Height 40px (Bold 700) — Page Titles
  - **Heading / H2**: 24px / Line Height 32px (SemiBold 600) — Section Headers
  - **Subheading / H3**: 18px / Line Height 26px (SemiBold 600) — Card & Panel Headers
  - **Body Primary**: 14px / Line Height 20px (Regular 400 & Medium 500) — Main content, table data
  - **Caption / Small**: 12px / Line Height 16px (Regular 400) — Metadata, timestamps, badge labels

### 4.3 Spacing Grid
Built on a strict 4px / 8px modular spacing grid:
- `space-1`: 4px (micro padding, badge spacing)
- `space-2`: 8px (inline gap, compact padding)
- `space-3`: 12px (input inner padding)
- `space-4`: 16px (standard container inner padding)
- `space-6`: 24px (card padding, grid gap)
- `space-8`: 32px (section layout spacing)
- `space-12`: 48px (page margin spacing)

### 4.4 Surfaces, Elevation, and 3D Depth Tokenization
Depth is achieved through structured panel layering and soft, realistic drop shadows rather than heavy blurs:
- **Flat Surface (Level 0)**: `border: 1px solid var(--border)`
- **Raised Panel (Level 1)**: `border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05)`
- **Card Hover Elevation (Level 1.5)**: `transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08); transition: transform 150ms ease, box-shadow 150ms ease`
- **Floating Overlay / Modal (Level 2)**: `border: 1px solid var(--border); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15)`

### 4.5 Motion Tokens & Reduced Motion
- **Duration Tokens**: Fast (100ms), Standard (150ms), Slow (250ms).
- **Easing Token**: `cubic-bezier(0.4, 0, 0.2, 1)`.
- **Reduced Motion Rule**:
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, ::before, ::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
      transform: none !important;
    }
  }
  ```

## 5. Navigation Model and Responsive Layouts

### 5.1 Desktop Layout Architecture (≥ 1024px)
- **Fixed Left Sidebar Navigation**: 256px fixed width, pinned to the left viewport boundary.
- **Top Utility Header Bar**: Height 64px, pinned top, containing breadcrumbs, active portal domain indicator, user profile menu, and status notifications.
- **Main Content Canvas**: Fluid width (`calc(100vw - 256px)`), scrollable vertically with 32px outer padding.

### 5.2 Tablet Layout Architecture (768px – 1023px)
- **Collapsible Sidebar**: Sidebar collapses to an 72px icon-only navigation rail or sliding overlay drawer triggered via top hamburger menu.
- **Content Grid Reflow**: 2-column card grid reflows automatically to fit narrowed canvas width.

### 5.3 Mobile Layout Architecture (< 768px)
- **Navigation Drawer**: Left sidebar transforms into a full-height slide-over drawer toggled via top bar hamburger icon.
- **Vertical Stack Reflow**: Multi-column grids reflow into a single-column vertical stack with 16px page margins.
- **Touch Optimizations**: Tap targets enforced at minimum 44x44px.

## 6. Admin Portal Screen Specifications (`admin.example.com`)

Theme: **Dark Premium Theme** (`#0F172A` canvas, `#1E293B` panels, `#6366F1` indigo accents).

### 6.1 Admin Dashboard & Textbook Upload Screen
- **Purpose**: Central hub for administrators to view platform overview stats and initiate textbook PDF uploads.
- **Key Visible Elements**:
  - Top summary cards: Ingested Textbooks, Active Processing Tasks, Items Pending Review, Total Registered Users.
  - Drag-and-Drop PDF Upload Container with file browser selector and supported format label (`.pdf`).
  - Recent Ingestion Activity Table (Textbook Title, Upload Date, Ingestion Status).
- **Primary Actions**: "Upload Textbook PDF" button, "Trigger Processing" action link.
- **Important States**:
  - *Default State*: Empty upload dropzone with prompt icon.
  - *Drag-Over State*: Highlighted indigo dropzone border with 2px dashed outline.
  - *Uploading State*: Progress bar with percentage upload completion and cancel button.
- **Responsive Reflow**: Summary cards stack 4-wide on desktop, 2-wide on tablet, 1-wide on mobile. Dropzone occupies full container width.

### 6.2 Six-Stage AI Processing Pipeline & Status View
- **Purpose**: Displays processing status across the 6 AI pipeline stages for an ingested textbook PDF.
- **Key Visible Elements**:
  - Stage 1: PDF Ingestion & OCR status indicator.
  - Stage 2: Hierarchical Extraction status indicator.
  - Stage 3: Intelligent Content Segmentation status indicator (~5–6 min target units).
  - Stage 4: Script Generation & Video Synthesis status indicator.
  - Stage 5: Topic Quiz Generation status indicator.
  - Stage 6: Adaptive Quiz Regeneration status indicator.
  - Processing Log Terminal View (displaying stage updates and step logs).
- **Primary Actions**: "Refresh Status" button; "Cancel Task" (`[NEEDS CONFIRMATION]` — the approved API specification does not define a pipeline cancellation endpoint or cancellation behavior).
- **Important States**:
  - *Processing State*: Active step displays pulsing amber indicator icon; completed steps display green checkmark.
  - *Stage Completion State*: All 6 steps display green checkmarks with completion timestamp.
  - *Error State*: Failed step displays red error badge with log excerpt (`[NEEDS CONFIRMATION]` error handling policy).
- **Responsive Reflow**: Horizontal pipeline stepper on desktop; vertical stepper list on tablet/mobile.

### 6.3 Extracted Chapter/Topic Hierarchy View
- **Purpose**: Allows administrators to inspect extracted textbook content structure (Chapters → Topics → Subtopics).
- **Key Visible Elements**:
  - Interactive Tree View container displaying expandable Chapter nodes.
  - Topic nodes containing subtopics and associated target video duration indicator (~5–6 min).
  - Content summary pane displaying extracted text excerpt and subtopic counts.
- **Primary Actions**: "Expand All" / "Collapse All" tree toggles, "Select Topic" action.
- **Important States**: Tree expand/collapse toggle states, selected topic active highlight state.
- **Responsive Reflow**: Side-by-side tree and detail pane on desktop; stacked tabbed view on mobile.

### 6.4 Generated Video/Script/Quiz Inspection & Review Queue
- **Purpose**: Review queue interface for administrators to inspect generated scripts, video asset metadata, and topic quizzes prior to making a publication decision.
- **Key Visible Elements**:
  - Review Queue Data Table / Grid (Item Title, Type: Video/Quiz, Topic Association, Generation Timestamp, Review Status: `pending_review`).
  - Item Detail Preview Drawer / Modal:
    - *For Video Items*: Generated script text viewer, pre-rendered video playback preview player (~5–6 min duration), video metadata.
    - *For Quiz Items*: Generated quiz question list, multiple-choice options, correct answer indicator, aligned topic learning objectives.
- **Primary Actions**: "Inspect Item" button, "Approve Item" button, "Reject Item" button (`[NEEDS CONFIRMATION]` rejection handling).
- **Important States**: Selected item highlight, preview loading spinner, approved item toast notification.
- **Responsive Reflow**: Split list-detail pane on desktop; list view navigating to full-screen modal on mobile.

### 6.5 Admin Approval and Publishing Controls
- **Purpose**: Governance controls for administrators to publish reviewed videos and quizzes to `learn.example.com`.
- **Key Visible Elements**:
  - Approval Confirmation Modal displaying item title, type, and target topic.
  - Review notes text input area (`[NEEDS CONFIRMATION]`).
  - Publishing Action Buttons ("Confirm Approval & Publish", "Cancel").
- **Primary Actions**: Click "Confirm Approval & Publish" to submit the approval operation. Show the `published` state only after the approval operation succeeds.
- **Important States**: Modal open state, publishing submission loading spinner, and success toast only after the approval operation succeeds. Rejection and retry behavior remain `[NEEDS CONFIRMATION]`.
- **Responsive Reflow**: Centered 500px modal on desktop; bottom-sheet drawer on mobile.

### 6.6 User Management Screen
- **Purpose**: Enables administrators to list and manage platform user accounts.
- **Key Visible Elements**:
  - User Accounts Data Table (User ID, Name, Email, Assigned Role: Administrator / Student / Parent / Teacher, Account Creation Date).
  - Add User Modal form inputs (Name, Email, Role selector).
- **Primary Actions**: "Add User" button; "Edit Role" action (`[NEEDS CONFIRMATION]` — role-editing behavior is not established by the approved API specification). User listing and creation remain within the documented API scope.
- **Important States**: Active user list, modal open state, form validation error state.
- **Responsive Reflow**: Full data table with column toggle on desktop; card-list layout on mobile.

### 6.7 Mastery Thresholds and Adaptive Settings Screen
- **Purpose**: Enables administrators to configure platform mastery thresholds and adaptive quiz settings.
- **Key Visible Elements**:
  - Mastery Threshold Slider / Input (e.g., 80% passing threshold for concept mastery).
  - Adaptive Quiz Question Count Input (e.g., number of basic adaptive questions generated per weak concept).
  - Save Configuration Control Panel.
- **Primary Actions**: "Save Threshold Settings" button.
- **Important States**: Modified settings dirty state (enabling Save button), save success toast.
- **Responsive Reflow**: 2-column form card layout on desktop; single-column form stack on mobile.

## 7. Student Learning Portal Screen Specifications (`learn.example.com`)

Theme: **Light Clean Theme** (`#F8FAFC` canvas, `#FFFFFF` panels, `#2563EB` blue accents).

### 7.1 Student Dashboard & Topic Navigation
- **Purpose**: Main learning portal landing view for students to select textbook topics and resume video learning.
- **Key Visible Elements**:
  - Course / Textbook Topic Navigation Grid (Topic Title, Pre-Rendered Video Indicator, Progress Bar % Complete, Mastery Badge).
  - Continue Learning Banner (displaying last played pre-rendered ~5–6 min video unit).
  - Recent Quiz Scores Summary Widget.
- **Primary Actions**: "Play Video Unit" button, "Start Topic Quiz" button.
- **Important States**: Completed topic checkmark badge, locked/pending approval topic state (hidden or greyed out).
- **Responsive Reflow**: 3-column topic card grid on desktop, 2-column on tablet, 1-column on mobile.

### 7.2 Video Lesson Player, Chapter/Topic Tree, and Lesson Playlist
- **Purpose**: Primary video learning interface for students to watch pre-rendered 5–6 min video units.
- **Layout Architecture**:
  - **Wide Screens (≥ 1024px)**:
    - **Left Column (approx 65% width)**: Pre-rendered video player container, video title, topic breadcrumb, optional script-text toggle (`[NEEDS CONFIRMATION]` — student-facing script access is not established by the approved API specification), and progress tracking status.
    - **Right Column (approx 35% width)**: Chapter/Topic Tree navigation and Lesson Playlist widget listing pre-rendered ~5–6 min video units.
  - **Narrow Screens (< 1024px)**:
    - Single vertical column reflow: Player container on top $\rightarrow$ Lesson Playlist widget $\rightarrow$ Chapter/Topic navigation tree below.
- **Key Visible Elements**:
  - Custom Video Player Wrapper (Play/Pause, Timeline Progress Bar, Volume, Fullscreen controls).
  - Video Duration Badge targeting ~5–6 minutes.
  - Optional Script Text Panel (collapsible accordion/tab displaying video script; `[NEEDS CONFIRMATION]` — the student-facing script retrieval mechanism and availability are not established by the approved API specification).
  - Lesson Playlist items with completion checkboxes.
- **Primary Actions**: Play/Pause video, select playlist item, toggle script view (`[NEEDS CONFIRMATION]`), and "Proceed to Quiz" button upon video completion.
- **Important States**: Playing state, Paused state, Completed video playback state (triggers progress update), Loading video state.
- **Responsive Reflow**: Side-by-side desktop layout; top-to-bottom vertical stack mobile layout.

### 7.3 Topic Quiz, Quiz Results, and Basic Adaptive Questions
- **Purpose**: Interface for students to attempt topic-aligned quizzes, view results, and receive basic adaptive remediation for weak concepts.
- **Key Visible Elements**:
  - **Active Quiz Interface**:
    - Progress indicator (e.g., Question 2 of 5).
    - Question stem card displaying question text.
    - Multiple-choice option cards (Radio button selectors with hover elevation).
    - Next / Submit buttons.
  - **Quiz Results View**:
    - Score summary card (e.g., 80% - Passed / Mastery Achieved).
    - Identified Weak Concepts list tags (highlighted in amber/red).
    - "Start Basic Adaptive Remediation" call-to-action button.
  - **Basic Adaptive Questions View**:
    - Targeted adaptive question cards generated specifically for weak concepts identified in the quiz attempt.
- **Primary Actions**: Select option, "Submit Quiz Attempt" button, "Start Adaptive Remediation" button.
- **Important States**: Option selected state, Quiz submitting spinner, Score summary view, Weak concept highlight.
- **Responsive Reflow**: Centered 680px quiz card container on desktop; full-bleed card container on mobile.

### 7.4 Student Progress and Mastery Views
- **Purpose**: Personal learning analytics view for students to track topic completion and concept mastery over time.
- **Key Visible Elements**:
  - Overall Concept Mastery Score Radial Meter / Progress Bar.
  - Topic Mastery Table / Breakdown Cards (Topic Name, Videos Watched, Quiz Attempt History, Mastery Level Badge).
  - Weak Concepts Remediation Tracker.
- **Primary Actions**: "Review Weak Concept Quiz" link.
- **Important States**: High mastery badge (green), In-progress badge (blue), Needs remediation badge (amber/red).
- **Responsive Reflow**: 2-column analytics grid on desktop; single-column stack on mobile.

## 8. Parent/Teacher Read-Only Dashboard Specifications (`learn.example.com`)

Theme: **Light Clean Theme** (`#F8FAFC` canvas, `#FFFFFF` panels).

### 8.1 Read-Only Progress and Mastery Dashboard Screen
- **Purpose**: Provides parents and teachers with read-only visibility into student progress and concept mastery summaries.
- **Key Visible Elements**:
  - Student Selector Dropdown / Context Bar (`[NEEDS CONFIRMATION]` account association mechanism).
  - Overall Topic Completion Progress Bar.
  - Concept Mastery Overview Cards (Mastery Percentage, Passed Topics count).
  - Weak Concepts List Widget (highlighting concepts requiring student attention).
  - Read-Only Watermark / Access Badge ("Read-Only Parent/Teacher View").
- **Access Boundary Enforcement**:
  - Parent/Teacher dashboard displays summary metrics ONLY.
  - Direct UI links to raw video playback logs, quiz attempt answer details, raw PDF files, or administrative controls are strictly omitted or marked `[NEEDS CONFIRMATION]`.
- **Primary Actions**: Student selection dropdown, "Export Summary" button (`[NEEDS CONFIRMATION]`).
- **Important States**: Student selected state, empty/no data state, loading summary state.
- **Responsive Reflow**: 3-column metric card layout on desktop; 2-column on tablet; 1-column card stack on mobile.

## 9. Reusable UI Component Inventory

| Component Name | Category | Primary Use Location | Key Props / Variants | Description |
|---|---|---|---|---|
| `HeaderBar` | Navigation | Admin & Learning Portals | `domain`, `userRole`, `breadcrumbs` | Top utility navigation bar |
| `SidebarNav` | Navigation | Admin & Learning Portals | `isCollapsed`, `activeRoute`, `theme` | Left sidebar with desktop pin / mobile drawer |
| `StatusBadge` | Feedback | Admin Review, Pipeline View | `status` (pending/approved/published/error) | Color-coded status indicator chip |
| `PipelineStepper` | Processing | Admin Pipeline Status Screen | `currentStage`, `stagesList`, `logs` | 6-stage visual progress stepper |
| `SurfacePanel` | Container | Admin & Learning Portals | `elevation` (level0/level1/level2) | Layered container card with subtle shadow |
| `VideoPlayerWrapper` | Media | Learning Video Player Screen | `videoUrl`, `duration`, `onComplete` | Player wrapper for pre-rendered 5–6 min videos |
| `LessonPlaylist` | Navigation | Learning Video Player Screen | `playlistItems`, `activeVideoId` | Video unit playlist selector |
| `QuizOptionCard` | Input / Form | Learning Topic Quiz Screen | `optionText`, `isSelected`, `isDisabled` | Multiple-choice selectable option card |
| `ScoreSummaryCard` | Feedback | Learning Quiz Results & Mastery | `scorePercentage`, `weakConcepts` | Score result display card with weak concept tags |
| `MasteryProgressBar` | Data Viz | Learning Student & Parent Dashboards | `percentage`, `colorVariant` | Smooth progress bar showing concept mastery % |
| `DataTable` | Data Display | Admin Users, Ingestion Activity | `columns`, `rows`, `pagination` | Data table with sorting and action menu |
| `FormInputSlider` | Form Input | Admin Threshold Settings | `label`, `value`, `min`, `max`, `step` | Range slider input for mastery threshold config |

## 10. Interaction, Loading, Empty, Error, Success, and Confirmation States

### 10.1 Interaction States
- **Normal**: Default component state with subtle 1px border.
- **Hover**: 2px Y-axis translate upward shift, shadow elevation Level 1.5, border accent color shift.
- **Focus**: Visible 2px focus ring (`#6366F1` Admin / `#2563EB` Learning) with 2px offset for keyboard accessibility.
- **Active / Pressed**: 1px Y-axis translate downward shift, background color darkens by 5%.
- **Disabled**: Opacity reduced to 50%, `cursor: not-allowed`, interactive events blocked.

### 10.2 Loading States
- **Skeleton Loaders**: Pulsing grey placeholder panels for dashboard cards, topic grids, and summary tables.
- **Button Loading Spinners**: Inline 16px spinner inside buttons during async submissions (e.g., PDF upload, quiz submission).
- **Pipeline Progress Stepper**: Active step displays pulsing status indicator during 6-stage AI processing.

### 10.3 Empty States
- **No Textbooks Uploaded**: Illustration icon + text "No textbooks uploaded yet" + "Upload PDF" CTA button.
- **No Items Pending Review**: Green check icon + text "Review queue is empty. All generated content has been processed."
- **No Weak Concepts Identified**: Celebration icon + text "No weak concepts identified. Excellent mastery progress!"

### 10.4 Error States
- **Inline Validation Error**: Red border outline on form input + 12px red error text below input.
- **Pipeline Failure View**: Failed stage node turns red with collapsible error log excerpt drawer.
- **Toast Error Notification**: Top-right floating toast notification displaying error message and retry button.

### 10.5 Success States
- **Approval Success Toast**: Show the green toast notification "Content item approved and published to Learning Portal." only after the approval operation succeeds. Do not show a success toast or `published` state before success; rejection and retry behavior remain `[NEEDS CONFIRMATION]`.
- **Settings Saved Toast**: Green toast notification "Mastery thresholds updated successfully."

### 10.6 Confirmation Dialog Modals
- **Publish Confirmation Modal**: Required modal dialog confirming administrator intent to publish reviewed pre-rendered videos or quizzes.

## 11. Accessibility and Responsive Behavior

### 11.1 Accessibility Target (WCAG 2.1 AA — Verification Required)
WCAG 2.1 AA is a design target, not a claim of verified compliance. Verify the implementation through contrast checks and accessibility testing before claiming conformance.
- **Contrast Ratios**: Target minimum 4.5:1 for normal text (14px/16px) and 3:1 for large headings (24px+) against background tokens in both themes; verify these ratios during testing.
- **Focus Ring Visibility**: High-contrast 2px outline focus indicators on all interactive elements.
- **Screen Reader Support**: Semantic HTML tags (`<nav>`, `<main>`, `<header>`, `<article>`, `<aside>`), ARIA labels on icon buttons, and `aria-live` announcements for async upload/quiz score results.
- **Touch Target Sizes**: All interactive buttons, option cards, and links enforce minimum 44x44px touch boundaries.

### 11.2 Responsive Breakpoint System

| Breakpoint Name | Viewport Width Range | Layout Behavior |
|---|---|---|
| Desktop Wide (`xl`) | ≥ 1280px | Fixed 256px sidebar, 3-column grid, split video player / playlist layout |
| Desktop Standard (`lg`) | 1024px – 1279px | Fixed 256px sidebar, 2-column grid, split video player / playlist layout |
| Tablet (`md`) | 768px – 1023px | Collapsible 72px icon rail / drawer, 2-column grid, video player stacks above playlist |
| Mobile (`sm`) | < 768px | Full-width vertical stack, slide-over navigation drawer, single-column card layout |

## 12. Requirements Traceability Matrix

| UI / UX Screen or Component | PRD Source (`01_PRD.md`) | SRS Source (`02_REQUIREMENTS.md`) | Architecture Source (`03_SYSTEM_ARCHITECTURE.md`) | Database Source (`04_DATABASE.md`) | API Source (`05_API.md`) |
|---|---|---|---|---|---|
| Admin Dashboard & PDF Upload (Sec 6.1) | FR-001, Sec 7 (Stage 1) | REQ-FR-001, Sec 3.1 | Sec 3 (Stage 1), Sec 5.1 | CDR-002, `E-TEXTBOOK` | `POST /admin/textbooks` |
| AI Pipeline & Status View (Sec 6.2) | FR-002 to FR-006 | REQ-FR-002 to REQ-FR-006 | Sec 3 (Stages 1–6) | CDR-002 to CDR-005 | `POST /pipeline`, `GET /status` |
| Chapter/Topic Hierarchy View (Sec 6.3) | FR-003, Sec 7 (Stage 2) | REQ-FR-003, Sec 3.1 | Sec 3 (Stage 2) | CDR-003, `E-HIERARCHY` | `GET /admin/textbooks/{id}/hierarchy` |
| Review Queue & Inspection (Sec 6.4) | FR-007, Sec 8 | REQ-FR-008, CON-002 | Sec 4, Sec 5.1 | CDR-006, `E-REVIEW-STATUS` | `GET /admin/review/items`, `GET /items/{id}` |
| Admin Approval Controls (Sec 6.5) | FR-007, Sec 8 | REQ-FR-008, CON-002 | Sec 4, Sec 5.1 | CDR-006, `E-REVIEW-STATUS` | `POST /admin/review/items/{id}/approval` |
| User Management Screen (Sec 6.6) | FR-008, Sec 6 | REQ-FR-009, Sec 2.1 | Sec 5.1 | CDR-001, `E-USER` | `GET / POST /admin/users` |
| Threshold & Adaptive Settings (Sec 6.7) | FR-009, Sec 8 | REQ-FR-010, Sec 3.4 | Sec 5.1 | CDR-009, `E-SYSTEM-SETTINGS` | `GET / PUT /settings/thresholds` |
| Student Dashboard (Sec 7.1) | FR-010, Sec 8 | REQ-FR-011, Sec 3.5 | Sec 5.2 | CDR-004, CDR-007 | `GET /learn/videos/{id}` |
| Video Player & Playlist (Sec 7.2) | FR-004, FR-005, FR-010, NFR-001 | REQ-FR-005, REQ-FR-011, REQ-NFR-001 | Sec 3 (Stage 4), Sec 5.2 | CDR-004, `E-VIDEO`, `E-VIDEO-PROGRESS` | `GET /learn/videos/{id}`, `POST /progress` |
| Topic Quiz & Adaptive Questions (Sec 7.3) | FR-006, FR-010, FR-011 | REQ-FR-006, REQ-FR-007, REQ-FR-011 | Sec 3 (Stages 5 & 6), Sec 5.2 | CDR-005, CDR-007, CDR-008, `E-QUIZ-ATTEMPT` | `GET /quiz`, `POST /attempts`, `GET /adaptive` |
| Student Progress & Mastery (Sec 7.4) | FR-010, Sec 8 | REQ-FR-011, Sec 3.5 | Sec 5.2 | CDR-007, `E-MASTERY` | `GET /learn/dashboards/progress` |
| Parent/Teacher Read-Only Dashboard (Sec 8) | FR-012, Sec 8 | REQ-FR-012, Sec 3.5 | Sec 5.2 | CDR-010, `E-MASTERY` | `GET /learn/dashboards/progress` |

## 13. Open Design Decisions and Verification Checklist

### 13.1 Open UI/UX Design Decisions (`[NEEDS DECISION]` / `[NEEDS CONFIRMATION]`)
1. **Parent/Teacher Student Selector Mechanism**: Schema and UI design for linking parent/teacher accounts to specific student progress profiles (`[NEEDS CONFIRMATION]`).
2. **Video Playback Progress UI Feedback**: Granularity of playback progress indicators (timestamp scrubber vs percentage milestones vs simple completion badge) (`[NEEDS CONFIRMATION]`).
3. **Pipeline Error Recovery UI**: Interactive UI behavior when an AI pipeline stage fails (retry stage vs re-upload PDF vs view error log) (`[NEEDS CONFIRMATION]`).
4. **Export Capabilities on Dashboards**: Whether parents or teachers have CSV/PDF export buttons on read-only summary dashboards (`[NEEDS CONFIRMATION]`).
5. **Frontend Component Library Selection**: Final selection of UI component library / design system (e.g., Tailwind CSS, Radix UI, Shadcn UI) (`[NEEDS DECISION]`).

---

### 13.2 UI/UX Verification Checklist
- [x] Grounded strictly in locked sources (`README.md`, `01_PRD.md` v1.0, `02_REQUIREMENTS.md` v1.2, `03_SYSTEM_ARCHITECTURE.md` v1.0, `04_DATABASE.md` v1.0, `05_API.md` v1.0)
- [x] Admin Portal specified with Dark Premium Theme (`#0F172A` canvas)
- [x] Learning Portal specified with Light Clean Theme (`#F8FAFC` canvas)
- [x] Preserved dual portals (`admin.example.com` and `learn.example.com`)
- [x] Fixed left sidebar navigation specified for desktop (≥ 1024px)
- [x] Collapsible drawer/navigation specified for tablet/mobile
- [x] Student video player layout specified: split player (left) and playlist (right) on wide screens; vertical reflow on narrow screens
- [x] Pre-rendered ~5–6 minute video constraint preserved
- [x] Admin review and approval gate preserved before content publication
- [x] Parent and Teacher dashboards strictly restricted to read-only progress and mastery summaries
- [x] Basic adaptive quizzes represented for Phase 1 MVP; advanced adaptive engine deferred to Phase 2
- [x] Full 13 sections completed without omitting any required topics
- [x] Document version set to 1.0; status set to `Proposed UI/UX Specification — Pending Review`
