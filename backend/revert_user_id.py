#!/usr/bin/env python3
"""
Revert migration script to make user_id NOT NULL in videos table
"""

import sqlite3
import os

def revert_migration():
    """Make user_id column NOT NULL in videos table"""
    
    # Get database path
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'videoplatform.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if there are any videos with NULL user_id
        cursor.execute("SELECT COUNT(*) FROM videos WHERE user_id IS NULL")
        null_count = cursor.fetchone()[0]
        
        if null_count > 0:
            print(f"Warning: Found {null_count} videos with NULL user_id")
            print("These videos will be deleted during the revert process")
            
            # Delete videos with NULL user_id
            cursor.execute("DELETE FROM videos WHERE user_id IS NULL")
            print(f"Deleted {null_count} anonymous videos")
        
        # Create a new table with NOT NULL user_id
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
                user_id INTEGER NOT NULL,
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
            WHERE user_id IS NOT NULL
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
        
        print("Revert migration completed successfully!")
        print("user_id column is now NOT NULL in videos table")
        return True
        
    except Exception as e:
        print(f"Revert migration failed: {e}")
        return False

if __name__ == "__main__":
    revert_migration()
