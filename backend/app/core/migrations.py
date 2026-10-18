"""
Incremental schema synchronization for SQLite development databases.
Ensures newly added canonical columns from Builds 01-04 exist without dropping existing data.
"""
from sqlalchemy import text
from .database import Base


def sync_sqlite_schema(engine):
    # Ensure all tables (including newly defined tables like video_script_versions) are created
    try:
        Base.metadata.create_all(bind=engine)
    except Exception:
        pass

    if not str(engine.url).startswith("sqlite"):
        return

    migrations = [
        ("chapters", "source_start_page", "INTEGER"),
        ("chapters", "source_end_page", "INTEGER"),
        ("chapters", "status", "VARCHAR(50) DEFAULT 'APPROVED'"),
        ("chapters", "confidence_score", "FLOAT DEFAULT 1.0"),
        ("topics", "source_start_page", "INTEGER"),
        ("topics", "source_end_page", "INTEGER"),
        ("topics", "status", "VARCHAR(50) DEFAULT 'APPROVED'"),
        ("topics", "confidence_score", "FLOAT DEFAULT 1.0"),
        ("subtopics", "source_start_page", "INTEGER"),
        ("subtopics", "source_end_page", "INTEGER"),
        ("subtopics", "status", "VARCHAR(50) DEFAULT 'APPROVED'"),
        ("subtopics", "confidence_score", "FLOAT DEFAULT 1.0"),
        ("videos", "estimated_duration_seconds", "INTEGER"),
        ("videos", "source_start_page", "INTEGER"),
        ("videos", "source_end_page", "INTEGER"),
        ("videos", "learning_objective", "TEXT"),
        ("videos", "content_outline", "JSON"),
        ("videos", "script_status", "VARCHAR(50)"),
        ("videos", "script_data", "JSON"),
        ("videos", "audio_storage_key", "VARCHAR(1000)"),
        ("videos", "video_storage_key", "VARCHAR(1000)"),
        ("videos", "thumbnail_storage_key", "VARCHAR(1000)"),
        ("videos", "captions_storage_key", "VARCHAR(1000)"),
        ("videos", "render_status", "VARCHAR(50) DEFAULT 'NOT_STARTED'"),
        ("videos", "render_engine", "VARCHAR(100) DEFAULT 'ffmpeg'"),
        ("videos", "tts_engine", "VARCHAR(100) DEFAULT 'deterministic'"),
        ("videos", "voice", "VARCHAR(100)"),
        ("videos", "actual_duration_seconds", "FLOAT"),
        ("videos", "render_error", "TEXT"),
        ("videos", "rendered_at", "DATETIME"),
        ("videos", "scenes_data", "JSON"),
        ("processing_jobs", "chapter_id", "INTEGER"),
        ("processing_jobs", "topic_id", "INTEGER"),
        ("processing_jobs", "video_id", "INTEGER"),
        ("quizzes", "subtopic_id", "INTEGER"),
        ("quizzes", "generation_engine", "VARCHAR(100) DEFAULT 'deterministic'"),
        ("quizzes", "question_count", "INTEGER DEFAULT 10"),
        ("questions", "bloom_level", "VARCHAR(50) DEFAULT 'UNDERSTAND'"),
        ("questions", "source_reference", "VARCHAR(500)"),
        ("questions", "source_pages", "JSON"),
        ("questions", "order_index", "INTEGER DEFAULT 0"),
        ("quiz_attempts", "question_results", "JSON"),
        # BUILD 09: Assignments Engine
        ("assignments", "total_points", "FLOAT DEFAULT 100.0"),
        ("assignments", "attachment_url", "VARCHAR(1000)"),
        ("assignments", "status", "VARCHAR(50) DEFAULT 'PUBLISHED'"),
        ("student_assignments", "submission_text", "TEXT"),
        ("student_assignments", "feedback", "TEXT"),
        ("student_assignments", "graded_at", "DATETIME"),
    ]

    with engine.connect() as conn:
        for table, column, col_type in migrations:
            try:
                res = conn.exec_driver_sql(f"PRAGMA table_info({table});")
                existing_cols = [row[1] for row in res.fetchall()]
                if existing_cols and column not in existing_cols:
                    conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {col_type};")
                    conn.commit()
            except Exception:
                pass
