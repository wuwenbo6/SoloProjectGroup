#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text, create_engine
from app.core.config import get_settings

settings = get_settings()


def create_indexes():
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print("Creating database indexes...")

        indexes = [
            # 哈希索引 - 用于精确匹配
            "CREATE INDEX IF NOT EXISTS idx_fingerprints_hash ON fingerprints (hash);",

            # 复合索引 - 用于哈希+歌曲ID的快速查询
            "CREATE INDEX IF NOT EXISTS idx_fingerprints_hash_song ON fingerprints (hash, song_id);",

            # 歌曲ID索引
            "CREATE INDEX IF NOT EXISTS idx_fingerprints_song_id ON fingerprints (song_id);",

            # 歌曲标题索引
            "CREATE INDEX IF NOT EXISTS idx_songs_title ON songs (title);",

            # 艺术家索引
            "CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs (artist);",
        ]

        for idx_sql in indexes:
            try:
                conn.execute(text(idx_sql))
                print(f"Created index successfully")
            except Exception as e:
                print(f"Index already exists or error: {e}")

        try:
            print("\nCreating vector index for pgvector...")
            # 使用 HNSW 索引进行余弦相似度搜索
            vector_index_sql = """
            CREATE INDEX IF NOT EXISTS idx_fingerprints_vector ON fingerprints
            USING hnsw (vector vector_cosine_ops)
            WITH (m = 16, ef_construction = 64);
            """
            conn.execute(text(vector_index_sql))
            print("Vector index created successfully")
        except Exception as e:
            print(f"Vector index creation failed or not supported: {e}")
            print("Falling back to IVFFLAT index...")
            try:
                ivfflat_sql = """
                CREATE INDEX IF NOT EXISTS idx_fingerprints_vector ON fingerprints
                USING ivfflat (vector vector_cosine_ops)
                WITH (lists = 100);
                """
                conn.execute(text(ivfflat_sql))
                print("IVFFLAT vector index created successfully")
            except Exception as e2:
                print(f"IVFFLAT index also failed: {e2}")

        conn.commit()

        print("\nAnalyzing table sizes...")
        result = conn.execute(text("""
            SELECT
                tablename,
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename IN ('songs', 'fingerprints')
            ORDER BY tablename, indexname;
        """))

        print("\nCurrent indexes:")
        for row in result:
            print(f"  {row[0]}.{row[1]}")

        # 检查表大小
        result = conn.execute(text("""
            SELECT
                'songs' as table_name,
                COUNT(*) as count
            FROM songs
            UNION ALL
            SELECT
                'fingerprints' as table_name,
                COUNT(*) as count
            FROM fingerprints;
        """))

        print("\nTable statistics:")
        for row in result:
            print(f"  {row[0]}: {row[1]} rows")


if __name__ == "__main__":
    create_indexes()
