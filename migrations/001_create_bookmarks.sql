-- Nexora D1 Schema
-- Run with: wrangler d1 execute nexora --file=migrations/001_create_bookmarks.sql

CREATE TABLE IF NOT EXISTS bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    desc TEXT DEFAULT '',
    category TEXT DEFAULT 'work',
    subcategory TEXT DEFAULT '',
    is_private INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bookmarks_category ON bookmarks(category);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_private ON bookmarks(is_private);
