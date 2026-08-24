#!/usr/bin/env python3
"""Nexora API Server — SQLite backend"""

import os
import json
import sqlite3
import hashlib
import zipfile
import tarfile
import io
import tempfile
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename

app = Flask(__name__, static_folder='../public')
CORS(app)

DB_PATH = os.environ.get('NEXORA_DB', '/data/nexora.db')
BACKUP_DIR = os.environ.get('NEXORA_BACKUP_DIR', '/data/backups')
ADMIN_PASSWORD = os.environ.get('NEXORA_ADMIN_PASS', 'nexora2024')
TOKEN_SECRET = os.environ.get('NEXORA_TOKEN_SECRET', 'nexora-secret-key-change-in-production')

os.makedirs(os.path.dirname(DB_PATH) or '/data', exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)


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


def check_admin():
    """Check if request is from admin"""
    token = request.headers.get('X-Admin-Token')
    return token == hash_password(TOKEN_SECRET)


def get_setting(key, default=''):
    """Get setting value"""
    conn = get_db()
    row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
    conn.close()
    return row['value'] if row else default


def set_setting(key, value):
    """Set setting value"""
    conn = get_db()
    conn.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', (key, value))
    conn.commit()
    conn.close()


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')


@app.route('/admin')
@app.route('/admin/')
def admin():
    return send_from_directory('../admin', 'login.html')


@app.route('/admin/<path:path>')
def admin_pages(path):
    return send_from_directory('../admin', path)


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
    if not check_admin():
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


# ===== 站点设置 =====

@app.route('/api/settings', methods=['GET'])
def get_settings():
    """Get all settings"""
    conn = get_db()
    rows = conn.execute('SELECT key, value FROM settings').fetchall()
    conn.close()
    settings = {row['key']: row['value'] for row in rows}
    return jsonify(settings)


@app.route('/api/settings/<key>', methods=['PUT'])
def update_setting(key):
    """Update a setting (admin only)"""
    if not check_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    
    value = request.json.get('value', '')
    set_setting(key, value)
    return jsonify({'message': 'Setting updated', 'key': key, 'value': value})


# ===== 导入/导出 =====

@app.route('/api/export', methods=['GET'])
def export_data():
    """Export all data as JSON"""
    conn = get_db()
    
    # 导出书签
    bookmarks_rows = conn.execute('SELECT * FROM bookmarks ORDER BY category, name').fetchall()
    bookmarks = [dict(row) for row in bookmarks_rows]
    
    # 导出设置
    settings_rows = conn.execute('SELECT * FROM settings').fetchall()
    settings = {row['key']: row['value'] for row in settings_rows}
    
    conn.close()
    
    data = {
        'version': '1.0',
        'exported_at': datetime.now().isoformat(),
        'site_name': settings.get('site_name', 'Nexora'),
        'bookmarks': bookmarks,
        'settings': settings
    }
    
    return jsonify(data)


@app.route('/api/import', methods=['POST'])
def import_data():
    """Import data from JSON (admin only)"""
    if not check_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.json
    conn = get_db()
    
    # 清空现有数据
    conn.execute('DELETE FROM bookmarks')
    conn.execute('DELETE FROM settings')
    
    # 导入设置
    settings = data.get('settings', {})
    for key, value in settings.items():
        conn.execute('INSERT INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
    
    # 导入书签
    bookmarks = data.get('bookmarks', [])
    for bm in bookmarks:
        conn.execute(
            '''INSERT INTO bookmarks (name, url, desc, category, subcategory, is_private, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (bm['name'], bm['url'], bm.get('desc', ''), bm.get('category', 'work'),
             bm.get('subcategory', ''), int(bm.get('is_private', 0)),
             bm.get('created_at', datetime.now().isoformat()),
             bm.get('updated_at', datetime.now().isoformat()))
        )
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': f'Imported {len(bookmarks)} bookmarks and {len(settings)} settings'})


@app.route('/api/import-file', methods=['POST'])
def import_file():
    """Import data from uploaded JSON file (admin only)"""
    if not check_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        data = json.loads(file.read().decode('utf-8'))
    except Exception as e:
        return jsonify({'error': f'Invalid JSON file: {str(e)}'}), 400
    
    # 调用导入逻辑
    conn = get_db()
    conn.execute('DELETE FROM bookmarks')
    conn.execute('DELETE FROM settings')
    
    settings = data.get('settings', {})
    for key, value in settings.items():
        conn.execute('INSERT INTO settings (key, value) VALUES (?, ?)', (key, str(value)))
    
    bookmarks = data.get('bookmarks', [])
    for bm in bookmarks:
        conn.execute(
            '''INSERT INTO bookmarks (name, url, desc, category, subcategory, is_private, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (bm['name'], bm['url'], bm.get('desc', ''), bm.get('category', 'work'),
             bm.get('subcategory', ''), int(bm.get('is_private', 0)),
             bm.get('created_at', datetime.now().isoformat()),
             bm.get('updated_at', datetime.now().isoformat()))
        )
    
    conn.commit()
    conn.close()
    
    return jsonify({'message': f'Imported {len(bookmarks)} bookmarks and {len(settings)} settings from file'})


# ===== WebDAV 备份 =====

@app.route('/api/backup/create', methods=['POST'])
def create_backup():
    """Create a backup file (admin only)"""
    if not check_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'nexora-backup-{timestamp}.zip'
    filepath = os.path.join(BACKUP_DIR, filename)
    
    conn = get_db()
    
    # 获取书签数据
    bookmarks_rows = conn.execute('SELECT * FROM bookmarks').fetchall()
    bookmarks = [dict(row) for row in bookmarks_rows]
    
    # 获取设置数据
    settings_rows = conn.execute('SELECT * FROM settings').fetchall()
    settings = {row['key']: row['value'] for row in settings_rows}
    
    # 读取数据库文件
    with open(DB_PATH, 'rb') as f:
        db_content = f.read()
    
    conn.close()
    
    # 创建 ZIP 文件
    with zipfile.ZipFile(filepath, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f'backup-{timestamp}.json', json.dumps({
            'version': '1.0',
            'exported_at': datetime.now().isoformat(),
            'site_name': settings.get('site_name', 'Nexora'),
            'bookmarks': bookmarks,
            'settings': settings
        }, ensure_ascii=False, indent=2))
        zf.writestr(f'nexora-{timestamp}.db', db_content)
        zf.writestr('README.txt', f'Nexora Backup {timestamp}\n\n包含:\n- nexora-{timestamp}.db (SQLite 数据库)\n- backup-{timestamp}.json (JSON 导出)\n\n恢复方法: 使用导入功能或替换数据库文件')
    
    return jsonify({
        'message': 'Backup created successfully',
        'filename': filename,
        'size': os.path.getsize(filepath),
        'download_url': f'/api/backup/download/{filename}'
    })


@app.route('/api/backup/download/<filename>', methods=['GET'])
def download_backup(filename):
    """Download a backup file"""
    safe_filename = secure_filename(filename)
    filepath = os.path.join(BACKUP_DIR, safe_filename)
    
    if not os.path.exists(filepath):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(filepath, as_attachment=True)


@app.route('/api/backup/list', methods=['GET'])
def list_backups():
    """List available backups"""
    if not check_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    
    backups = []
    if os.path.exists(BACKUP_DIR):
        for f in sorted(os.listdir(BACKUP_DIR)):
            if f.endswith('.zip'):
                filepath = os.path.join(BACKUP_DIR, f)
                backups.append({
                    'filename': f,
                    'size': os.path.getsize(filepath),
                    'created_at': datetime.fromtimestamp(os.path.getctime(filepath)).isoformat()
                })
    
    return jsonify({'backups': backups})


@app.route('/api/backup/delete/<filename>', methods=['DELETE'])
def delete_backup(filename):
    """Delete a backup file (admin only)"""
    if not check_admin():
        return jsonify({'error': 'Unauthorized'}), 401
    
    safe_filename = secure_filename(filename)
    filepath = os.path.join(BACKUP_DIR, safe_filename)
    
    if os.path.exists(filepath):
        os.remove(filepath)
        return jsonify({'message': 'Backup deleted'})
    
    return jsonify({'error': 'File not found'}), 404


if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8080))
    print(f"Nexora API server starting on port {port}...")
    print(f"Database: {DB_PATH}")
    print(f"Backups: {BACKUP_DIR}")
    app.run(host='0.0.0.0', port=port, debug=False)
