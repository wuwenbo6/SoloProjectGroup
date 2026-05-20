#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine, Base
from app.models import Song, Fingerprint
from sqlalchemy import text


def init_database():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")

    print("\nCreating indexes...")
    with engine.connect() as conn:
        indexes = [
            "CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON fingerprints (hash);",
            "CREATE INDEX IF NOT EXISTS idx_fingerprints_hash_song ON fingerprints (hash, song_id);",
            "CREATE INDEX IF NOT EXISTS idx_fingerprints_song_id ON fingerprints (song_id);",
            "CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);",
            "CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs (artist);",
        ]

        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
            except Exception as e:
                print(f"Index note: {e}")

        try:
            vector_index_sql = """
            CREATE INDEX IF NOT EXISTS idx_fingerprints_vector ON fingerprints
            USING hnsw (vector vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            """
            conn.execute(text(vector_index_sql))
            print("Vector index created successfully")
        except Exception as e:
            print(f"Vector index skipped (HNSW not supported?): {e}")
            try:
                ivfflat_sql = """
                CREATE INDEX IF NOT EXISTS idx_fingerprints_vector ON fingerprints
                USING ivfflat (vector vector_cosine_ops)
                WITH (lists = 100);
                """
                conn.execute(text(ivfflat_sql))
                print("IVFFLAT vector index created")
            except Exception as e2:
                print(f"IVFFLAT index also skipped: {e2}")

        conn.commit()

    print("\nDatabase initialization completed!")


if __name__ == "__main__":
    init_database()
