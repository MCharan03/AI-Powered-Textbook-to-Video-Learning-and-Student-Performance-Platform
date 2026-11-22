#!/usr/bin/env python3
"""
CLI tool for VeyoraLabs Generated Educational Content Cleanup.

Usage:
  python backend/cleanup_generated_content.py --preview
  python backend/cleanup_generated_content.py --confirm [--no-backup]
"""

import sys
import argparse
import json
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.core.database import SessionLocal
from app.services.content_cleanup_service import preview_cleanup, execute_cleanup


def main():
    parser = argparse.ArgumentParser(
        description="Safely preview or execute cleanup of previously generated educational content."
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        default=True,
        help="Dry-run preview mode (default). Inspects and reports records and files to be cleaned."
    )
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="Explicit confirmation flag required to execute cleanup."
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Skip database backup creation before cleanup (not recommended)."
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output preview or results as raw JSON."
    )

    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.confirm:
            print("=" * 60)
            print("EXECUTING GENERATED CONTENT CLEANUP (CONFIRMED)")
            print("=" * 60)
            result = execute_cleanup(
                db,
                confirmed=True,
                create_backup=not args.no_backup,
                operator="cli_admin"
            )
            if args.json:
                print(json.dumps(result, indent=2))
            else:
                print(f"Status: {result['status']}")
                print(f"Backup created at: {result.get('backup_path')}")
                audit = result["audit"]
                print("Records deleted:")
                for k, v in audit["records_deleted"].items():
                    print(f"  - {k}: {v}")
                print(f"Files deleted: {audit['files_deleted']['count']} files ({audit['files_deleted']['size_mb']} MB)")
                print("Preserved records verified:")
                for k, v in audit["preserved_records"].items():
                    print(f"  - {k}: {v}")
                print("\nCleanup completed successfully and logged to uploads/cleanup_audit_log.json.")
        else:
            preview = preview_cleanup(db)
            if args.json:
                print(json.dumps(preview, indent=2))
            else:
                print("=" * 60)
                print("GENERATED CONTENT CLEANUP — DRY-RUN PREVIEW")
                print("=" * 60)
                s = preview["summary"]
                print(f"Total Video Records:          {s['total_video_records']}")
                print(f"  - Video Plans (unrendered): {s['video_plans_count']}")
                print(f"  - Rendered Videos:          {s['rendered_videos_count']}")
                print(f"  - Published Videos:         {s['published_videos_count']}")
                print(f"Video Script Versions:        {s['video_script_versions_count']}")
                print(f"Video Render Versions:        {s['video_render_versions_count']}")
                print(f"Quizzes:                      {s['quizzes_count']}")
                print(f"Quiz Questions:               {s['questions_count']}")
                print(f"Dependent Student Progress:   {s['dependent_student_video_progress_records']}")
                print(f"Dependent Quiz Attempts:      {s['dependent_quiz_attempts_records']}")
                print(f"Generated Media Files:        {s['generated_files_count']} files (~{s['generated_files_size_mb']} MB)")
                print("-" * 60)
                p = preview["preserved_core_data"]
                print("PRESERVED CORE DATA (NEVER DELETED):")
                print(f"  - Textbooks:                {p['textbooks']}")
                print(f"  - Chapters:                 {p['chapters']}")
                print(f"  - Topics:                   {p['topics']}")
                print(f"  - Subtopics:                {p['subtopics']}")
                print(f"  - Subjects:                 {p['subjects']}")
                print(f"  - User Accounts:            {p['users']}")
                print(f"  - Original Uploaded PDFs:   {p['original_uploaded_pdfs']}")
                print("=" * 60)
                print("NOTE: Dry-run only. No records or files were modified.")
                print("To execute cleanup, run with: python backend/cleanup_generated_content.py --confirm")

    finally:
        db.close()


if __name__ == "__main__":
    main()
