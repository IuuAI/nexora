import sqlite3
import os
import json

DB_PATH = os.environ.get('NEXORA_DB', '/tmp/nexora.db')

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS bookmarks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            url TEXT NOT NULL,
            desc TEXT DEFAULT '',
            category TEXT DEFAULT 'work',
            subcategory TEXT DEFAULT '',
            is_private INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT DEFAULT ''
        )
    ''')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_category ON bookmarks(category)')
    conn.execute('CREATE INDEX IF NOT EXISTS idx_private ON bookmarks(is_private)')
    conn.commit()
    conn.close()
    print(f"Database initialized at {DB_PATH}")

if __name__ == '__main__':
    os.makedirs(os.path.dirname(DB_PATH) or '.', exist_ok=True)
    init_db()
