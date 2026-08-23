#!/usr/bin/env python3
"""Nexora API Server — SQLite backend"""

import os
import json
import sqlite3
import hashlib
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder='../public')
CORS(app)

DB_PATH = os.environ.get('NEXORA_DB', '/data/nexora.db')
ADMIN_PASSWORD = os.environ.get('NEXORA_ADMIN_PASS', 'nexora2024')
TOKEN_SECRET = os.environ.get('NEXORA_TOKEN_SECRET', 'nexora-secret-key-change-in-production')

os.makedirs(os.path.dirname(DB_PATH) or '/data', exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def init_db():
    conn = get_db()
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
    conn.commit()
    conn.close()


def hash_password(pwd):
    return hashlib.sha256(pwd.encode()).hexdigest()


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/admin')
def admin():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/assets/<path:path>')
def assets(path):
    return send_from_directory('../assets', path)


# ===== API Endpoints =====

@app.route('/api/bookmarks', methods=['GET'])
def get_bookmarks():
    """Get all bookmarks (filter out private for non-authenticated)"""
    is_admin = request.headers.get('X-Admin-Token') == hash_password(ADMIN_PASSWORD)
    conn = get_db()
    
    if is_admin:
        rows = conn.execute('SELECT * FROM bookmarks ORDER BY category, subcategory, name').fetchall()
    else:
        rows = conn.execute('SELECT * FROM bookmarks WHERE is_private = 0 ORDER BY category, subcategory, name').fetchall()
    
    bookmarks = [dict(row) for row in rows]
    conn.close()
    return jsonify(bookmarks)


@app.route('/api/bookmarks', methods=['POST'])
def create_bookmark():
    """Create a new bookmark (admin only)"""
    if not request.headers.get('X-Admin-Token'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    conn = get_db()
    cursor = conn.execute(
        '''INSERT INTO bookmarks (name, url, desc, category, subcategory, is_private)
           VALUES (?, ?, ?, ?, ?, ?)''',
        (data['name'], data['url'], data.get('desc', ''), data.get('category', 'work'),
         data.get('subcategory', ''), int(data.get('isPrivate', False)))
    )
    conn.commit()
    bookmark_id = cursor.lastrowid
    conn.close()
    return jsonify({'id': bookmark_id, 'message': 'Created'}), 201


@app.route('/api/bookmarks/<int:bookmark_id>', methods=['PUT'])
def update_bookmark(bookmark_id):
    """Update a bookmark (admin only)"""
    if not request.headers.get('X-Admin-Token'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    conn = get_db()
    conn.execute(
        '''UPDATE bookmarks SET name=?, url=?, desc=?, category=?, subcategory=?, is_private=?, updated_at=CURRENT_TIMESTAMP
           WHERE id=?''',
        (data['name'], data['url'], data.get('desc', ''), data.get('category', 'work'),
         data.get('subcategory', ''), int(data.get('isPrivate', False)), bookmark_id)
    )
    conn.commit()
    conn.close()
    return jsonify({'message': 'Updated'})


@app.route('/api/bookmarks/<int:bookmark_id>', methods=['DELETE'])
def delete_bookmark(bookmark_id):
    """Delete a bookmark (admin only)"""
    if not request.headers.get('X-Admin-Token'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db()
    conn.execute('DELETE FROM bookmarks WHERE id=?', (bookmark_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Deleted'})


@app.route('/api/login', methods=['POST'])
def login():
    """Admin login"""
    data = request.json
    password = data.get('password', '')
    if hash_password(password) == hash_password(ADMIN_PASSWORD):
        return jsonify({'token': hash_password(TOKEN_SECRET), 'expires_in': 86400})
    return jsonify({'error': 'Invalid password'}), 401


@app.route('/api/reset', methods=['POST'])
def reset_data():
    """Reset all data (admin only)"""
    if not request.headers.get('X-Admin-Token'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    conn = get_db()
    conn.execute('DELETE FROM bookmarks')
    conn.execute("DELETE FROM settings")
    conn.commit()
    conn.close()
    return jsonify({'message': 'Reset complete'})


@app.route('/api/init-sample', methods=['POST'])
def init_sample():
    """Initialize sample data (admin only)"""
    if not request.headers.get('X-Admin-Token'):
        return jsonify({'error': 'Unauthorized'}), 401
    
    sample_data = [
        {"name": "GitHub", "url": "https://github.com", "desc": "代码托管平台", "category": "tech", "subcategory": "开发工具"},
        {"name": "Stack Overflow", "url": "https://stackoverflow.com", "desc": "开发者问答社区", "category": "tech", "subcategory": "学习资源"},
        {"name": "Vercel", "url": "https://vercel.com", "desc": "前端部署平台", "category": "tech", "subcategory": "开发工具"},
        {"name": "Notion", "url": "https://notion.so", "desc": "笔记与知识管理", "category": "work", "subcategory": "效率工具"},
        {"name": "Figma", "url": "https://figma.com", "desc": "协作设计工具", "category": "work", "subcategory": "设计工具"},
        {"name": "YouTube", "url": "https://youtube.com", "desc": "视频平台", "category": "media", "subcategory": "视频"},
        {"name": "Bilibili", "url": "https://bilibili.com", "desc": "视频弹幕网站", "category": "media", "subcategory": "视频"},
        {"name": "网易云音乐", "url": "https://music.163.com", "desc": "音乐流媒体", "category": "media", "subcategory": "音乐"},
        {"name": "淘宝", "url": "https://taobao.com", "desc": "购物平台", "category": "life", "subcategory": "购物"},
        {"name": "百度网盘", "url": "https://pan.baidu.com", "desc": "云存储服务", "category": "life", "subcategory": "云存储"},
        {"name": "个人密码库", "url": "https://1password.com", "desc": "密码管理工具", "category": "tools", "subcategory": "安全", "isPrivate": True},
        {"name": "服务器管理后台", "url": "https://dashboard.example.com", "desc": "内部运维系统", "category": "work", "subcategory": "运维", "isPrivate": True},
    ]
    
    conn = get_db()
    for item in sample_data:
        conn.execute(
            'INSERT INTO bookmarks (name, url, desc, category, subcategory, is_private) VALUES (?, ?, ?, ?, ?, ?)',
            (item['name'], item['url'], item.get('desc', ''), item['category'], item.get('subcategory', ''),
             int(item.get('isPrivate', False)))
        )
    conn.commit()
    conn.close()
    return jsonify({'message': f'Initialized {len(sample_data)} bookmarks'})


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8080))
    print(f"Nexora API server starting on port {port}...")
    print(f"Database: {DB_PATH}")
    app.run(host='0.0.0.0', port=port, debug=False)
