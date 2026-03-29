#!/usr/bin/env python3
"""
Migration script to make user_id nullable in videos table
"""

import sqlite3
import os

def migrate_database():
    """Make user_id column nullable in videos table"""
    
    # Get database path
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'videoplatform.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if the column is already nullable
        cursor.execute("PRAGMA table_info(videos)")
        columns = cursor.fetchall()
        user_id_column = None
        
        for col in columns:
            if col[1] == 'user_id':
                user_id_column = col
                break
        
        if not user_id_column:
            print("user_id column not found in videos table")
            return False
        
        # Create a new table with nullable user_id
        cursor.execute("""
            CREATE TABLE videos_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                tags VARCHAR(500),
                filename VARCHAR(255) NOT NULL,
                cover_image VARCHAR(255),
                file_size BIGINT,
                duration INTEGER,
                status VARCHAR(20) DEFAULT 'pending',
                view_count INTEGER DEFAULT 0,
                user_id INTEGER,
                source_url VARCHAR(500),
                is_scraped BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        # Copy data from old table to new table
        cursor.execute("""
            INSERT INTO videos_new (
                id, title, description, tags, filename, cover_image, 
                file_size, duration, status, view_count, user_id, 
                source_url, is_scraped, created_at, updated_at
            )
            SELECT 
                id, title, description, tags, filename, cover_image, 
                file_size, duration, status, view_count, user_id, 
                source_url, is_scraped, created_at, updated_at
            FROM videos
        """)
        
        # Drop old table and rename new table
        cursor.execute("DROP TABLE videos")
        cursor.execute("ALTER TABLE videos_new RENAME TO videos")
        
        # Recreate indexes if needed
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_title ON videos(title)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at)")
        
        conn.commit()
        conn.close()
        
        print("Migration completed successfully!")
        print("user_id column is now nullable in videos table")
        return True
        
    except Exception as e:
        print(f"Migration failed: {e}")
        return False

if __name__ == "__main__":
    migrate_database()
