import os
import json
import sqlite3
import shutil
import gc
from typing import List, Dict, Optional, Any
from datetime import datetime
from pathlib import Path
import warnings
warnings.filterwarnings('ignore')


class LibraryManager:
    def __init__(self, db_path: str = None):
        self.db_path = db_path
        self._conn = None
        self._init_successful = False
        
        try:
            if db_path is None:
                home_dir = str(Path.home())
                db_dir = os.path.join(home_dir, '.vinyl_processor')
                os.makedirs(db_dir, exist_ok=True)
                db_path = os.path.join(db_dir, 'library.db')
            
            self.db_path = db_path
            self._init_database()
            self._init_successful = True
        except Exception as e:
            print(f"数据库初始化失败: {e}")
            print("尝试使用临时数据库...")
            try:
                import tempfile
                temp_dir = tempfile.gettempdir()
                self.db_path = os.path.join(temp_dir, 'vinyl_library_temp.db')
                if os.path.exists(self.db_path):
                    os.remove(self.db_path)
                self._init_database()
                self._init_successful = True
                print(f"已切换到临时数据库: {self.db_path}")
            except Exception as e2:
                print(f"临时数据库也初始化失败: {e2}")
                raise RuntimeError("无法初始化数据库")

    def _init_database(self):
        try:
            self._check_and_repair_database()
            
            conn = sqlite3.connect(self.db_path, timeout=10.0)
            cursor = conn.cursor()
            
            cursor.execute('PRAGMA journal_mode = WAL')
            cursor.execute('PRAGMA synchronous = NORMAL')
            cursor.execute('PRAGMA foreign_keys = ON')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS albums (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    artist TEXT,
                    year INTEGER,
                    genre TEXT,
                    cover_image TEXT,
                    notes TEXT,
                    created_at TEXT,
                    updated_at TEXT
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    album_id INTEGER,
                    title TEXT NOT NULL,
                    track_number INTEGER,
                    duration REAL,
                    file_path TEXT,
                    file_format TEXT,
                    bit_depth INTEGER,
                    sample_rate INTEGER,
                    peak_level REAL,
                    rms_level REAL,
                    date_recorded TEXT,
                    notes TEXT,
                    created_at TEXT,
                    updated_at TEXT,
                    FOREIGN KEY (album_id) REFERENCES albums (id)
                )
            ''')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS processing_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id INTEGER,
                    process_type TEXT,
                    parameters TEXT,
                    timestamp TEXT,
                    FOREIGN KEY (track_id) REFERENCES tracks (id)
                )
            ''')
            
            conn.commit()
            conn.close()
        except sqlite3.DatabaseError as e:
            if 'database disk image is malformed' in str(e) or 'corrupt' in str(e).lower():
                print(f"数据库损坏，尝试恢复: {e}")
                self._recover_database()
            else:
                raise
    
    def _check_and_repair_database(self):
        if not os.path.exists(self.db_path):
            return
        
        try:
            conn = sqlite3.connect(self.db_path, timeout=5.0)
            cursor = conn.cursor()
            cursor.execute('PRAGMA integrity_check')
            result = cursor.fetchone()
            conn.close()
            
            if result[0] != 'ok':
                print(f"数据库完整性检查失败: {result[0]}")
                self._backup_and_recreate()
        except Exception as e:
            print(f"数据库检查失败: {e}")
            self._backup_and_recreate()
    
    def _backup_and_recreate(self):
        if os.path.exists(self.db_path):
            backup_path = f"{self.db_path}.backup.{datetime.now().strftime('%Y%m%d%H%M%S')}"
            shutil.copy2(self.db_path, backup_path)
            print(f"已备份损坏的数据库到: {backup_path}")
            
            os.remove(self.db_path)
            print("已创建新的数据库文件")
    
    def _recover_database(self):
        backup_path = f"{self.db_path}.bad.{datetime.now().strftime('%Y%m%d%H%M%S')}"
        if os.path.exists(self.db_path):
            shutil.move(self.db_path, backup_path)
            print(f"已将损坏的数据库移至: {backup_path}")
        gc.collect()

    def _safe_execute(self, query: str, params: tuple = None, fetch: bool = False):
        if not self._init_successful:
            raise RuntimeError("数据库未成功初始化")
        
        params = params or ()
        max_retries = 3
        
        for attempt in range(max_retries):
            conn = None
            try:
                conn = sqlite3.connect(self.db_path, timeout=10.0)
                conn.row_factory = sqlite3.Row
                cursor = conn.cursor()
                
                cursor.execute(query, params)
                
                if fetch:
                    result = cursor.fetchall()
                    conn.commit()
                    conn.close()
                    return [dict(row) for row in result] if result else []
                else:
                    lastrowid = cursor.lastrowid
                    rowcount = cursor.rowcount
                    conn.commit()
                    conn.close()
                    return lastrowid, rowcount
                    
            except sqlite3.OperationalError as e:
                if conn:
                    conn.close()
                if 'database is locked' in str(e) and attempt < max_retries - 1:
                    import time
                    time.sleep(0.1 * (attempt + 1))
                    continue
                raise
            except Exception as e:
                if conn:
                    conn.close()
                raise
    
    def add_album(self, title: str, artist: str = None, year: int = None,
                  genre: str = None, cover_image: str = None, 
                  notes: str = None) -> int:
        try:
            if not title:
                title = "Unknown Album"
            
            year = int(year) if year is not None else None
            
            now = datetime.now().isoformat()
            
            album_id, _ = self._safe_execute('''
                INSERT INTO albums (title, artist, year, genre, cover_image, notes, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (title, artist, year, genre, cover_image, notes, now, now))
            
            print(f"已添加专辑: {title} (ID: {album_id})")
            return album_id
        except Exception as e:
            print(f"添加专辑失败: {e}")
            return -1

    def get_album(self, album_id: int) -> Optional[Dict]:
        try:
            result = self._safe_execute(
                'SELECT * FROM albums WHERE id = ?',
                (album_id,),
                fetch=True
            )
            return result[0] if result else None
        except Exception as e:
            print(f"获取专辑失败: {e}")
            return None

    def update_album(self, album_id: int, **kwargs) -> bool:
        try:
            allowed_fields = ['title', 'artist', 'year', 'genre', 'cover_image', 'notes']
            update_fields = []
            values = []
            
            for field, value in kwargs.items():
                if field in allowed_fields:
                    update_fields.append(f"{field} = ?")
                    values.append(value)
            
            if not update_fields:
                return False
            
            if 'year' in kwargs and kwargs['year'] is not None:
                year_index = allowed_fields.index('year')
                values[year_index] = int(values[year_index])
            
            update_fields.append("updated_at = ?")
            values.append(datetime.now().isoformat())
            values.append(album_id)
            
            query = f"UPDATE albums SET {', '.join(update_fields)} WHERE id = ?"
            _, affected = self._safe_execute(query, tuple(values))
            
            return affected > 0
        except Exception as e:
            print(f"更新专辑失败: {e}")
            return False

    def delete_album(self, album_id: int, delete_files: bool = False) -> bool:
        try:
            if delete_files:
                tracks = self.get_album_tracks(album_id)
                for track in tracks:
                    file_path = track.get('file_path')
                    if file_path and os.path.exists(file_path):
                        try:
                            os.remove(file_path)
                        except Exception as e:
                            print(f"删除文件失败 {file_path}: {e}")
            
            self._safe_execute('DELETE FROM processing_history WHERE track_id IN (SELECT id FROM tracks WHERE album_id = ?)', (album_id,))
            self._safe_execute('DELETE FROM tracks WHERE album_id = ?', (album_id,))
            _, affected = self._safe_execute('DELETE FROM albums WHERE id = ?', (album_id,))
            
            return affected > 0
        except Exception as e:
            print(f"删除专辑失败: {e}")
            return False

    def list_albums(self, limit: int = None) -> List[Dict]:
        try:
            query = 'SELECT * FROM albums ORDER BY created_at DESC'
            params = ()
            if limit:
                limit = int(limit)
                query += ' LIMIT ?'
                params = (limit,)
            
            return self._safe_execute(query, params, fetch=True)
        except Exception as e:
            print(f"列出专辑失败: {e}")
            return []

    def add_track(self, album_id: int, title: str, file_path: str = None,
                  track_number: int = None, duration: float = None,
                  file_format: str = None, bit_depth: int = None,
                  sample_rate: int = None, peak_level: float = None,
                  rms_level: float = None, date_recorded: str = None,
                  notes: str = None) -> int:
        try:
            if not title:
                title = "Unknown Track"
            
            if album_id is None or album_id < 0:
                album_id = self.add_album("Unknown Album")
            
            for param_name, param_val in [('track_number', track_number), 
                                          ('duration', duration),
                                          ('bit_depth', bit_depth), 
                                          ('sample_rate', sample_rate),
                                          ('peak_level', peak_level), 
                                          ('rms_level', rms_level)]:
                if param_val is not None:
                    try:
                        locals()[param_name] = float(param_val) if param_name in ['duration', 'peak_level', 'rms_level'] else int(param_val)
                    except:
                        locals()[param_name] = None
            
            now = datetime.now().isoformat()
            
            track_id, _ = self._safe_execute('''
                INSERT INTO tracks (
                    album_id, title, track_number, duration, file_path,
                    file_format, bit_depth, sample_rate, peak_level,
                    rms_level, date_recorded, notes, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                album_id, title, track_number, duration, file_path,
                file_format, bit_depth, sample_rate, peak_level,
                rms_level, date_recorded, notes, now, now
            ))
            
            print(f"已添加曲目: {title} (ID: {track_id})")
            return track_id
        except Exception as e:
            print(f"添加曲目失败: {e}")
            return -1

    def get_track(self, track_id: int) -> Optional[Dict]:
        try:
            result = self._safe_execute(
                'SELECT * FROM tracks WHERE id = ?',
                (track_id,),
                fetch=True
            )
            return result[0] if result else None
        except Exception as e:
            print(f"获取曲目失败: {e}")
            return None

    def update_track(self, track_id: int, **kwargs) -> bool:
        try:
            allowed_fields = [
                'album_id', 'title', 'track_number', 'duration', 
                'file_path', 'file_format', 'bit_depth', 'sample_rate',
                'peak_level', 'rms_level', 'date_recorded', 'notes'
            ]
            update_fields = []
            values = []
            
            for field, value in kwargs.items():
                if field in allowed_fields:
                    update_fields.append(f"{field} = ?")
                    values.append(value)
            
            if not update_fields:
                return False
            
            update_fields.append("updated_at = ?")
            values.append(datetime.now().isoformat())
            values.append(track_id)
            
            query = f"UPDATE tracks SET {', '.join(update_fields)} WHERE id = ?"
            _, affected = self._safe_execute(query, tuple(values))
            
            return affected > 0
        except Exception as e:
            print(f"更新曲目失败: {e}")
            return False

    def delete_track(self, track_id: int, delete_file: bool = False) -> bool:
        try:
            if delete_file:
                track = self.get_track(track_id)
                if track and track.get('file_path') and os.path.exists(track['file_path']):
                    try:
                        os.remove(track['file_path'])
                    except Exception as e:
                        print(f"删除文件失败 {track['file_path']}: {e}")
            
            self._safe_execute('DELETE FROM processing_history WHERE track_id = ?', (track_id,))
            _, affected = self._safe_execute('DELETE FROM tracks WHERE id = ?', (track_id,))
            
            return affected > 0
        except Exception as e:
            print(f"删除曲目失败: {e}")
            return False

    def get_album_tracks(self, album_id: int) -> List[Dict]:
        try:
            return self._safe_execute('''
                SELECT * FROM tracks 
                WHERE album_id = ? 
                ORDER BY track_number, created_at
            ''', (album_id,), fetch=True)
        except Exception as e:
            print(f"获取专辑曲目失败: {e}")
            return []

    def search_tracks(self, query: str) -> List[Dict]:
        try:
            if not query:
                return []
            
            search_pattern = f'%{query}%'
            return self._safe_execute('''
                SELECT t.*, a.title as album_title, a.artist
                FROM tracks t
                LEFT JOIN albums a ON t.album_id = a.id
                WHERE t.title LIKE ? 
                   OR a.title LIKE ? 
                   OR a.artist LIKE ?
                ORDER BY t.created_at DESC
            ''', (search_pattern, search_pattern, search_pattern), fetch=True)
        except Exception as e:
            print(f"搜索曲目失败: {e}")
            return []

    def add_processing_history(self, track_id: int, process_type: str,
                               parameters: Dict = None) -> int:
        try:
            now = datetime.now().isoformat()
            params_json = json.dumps(parameters, ensure_ascii=False) if parameters else None
            
            history_id, _ = self._safe_execute('''
                INSERT INTO processing_history (track_id, process_type, parameters, timestamp)
                VALUES (?, ?, ?, ?)
            ''', (track_id, process_type, params_json, now))
            
            return history_id
        except Exception as e:
            print(f"添加处理历史失败: {e}")
            return -1

    def get_track_history(self, track_id: int) -> List[Dict]:
        try:
            rows = self._safe_execute('''
                SELECT * FROM processing_history 
                WHERE track_id = ? 
                ORDER BY timestamp DESC
            ''', (track_id,), fetch=True)
            
            history = []
            for row_dict in rows:
                if row_dict.get('parameters'):
                    try:
                        row_dict['parameters'] = json.loads(row_dict['parameters'])
                    except:
                        row_dict['parameters'] = None
                history.append(row_dict)
            
            return history
        except Exception as e:
            print(f"获取处理历史失败: {e}")
            return []

    def get_statistics(self) -> Dict:
        try:
            albums = self._safe_execute('SELECT COUNT(*) as count FROM albums', fetch=True)
            album_count = albums[0]['count'] if albums else 0
            
            tracks = self._safe_execute('SELECT COUNT(*) as count FROM tracks', fetch=True)
            track_count = tracks[0]['count'] if tracks else 0
            
            duration_result = self._safe_execute('SELECT SUM(duration) as total FROM tracks', fetch=True)
            total_duration = duration_result[0]['total'] or 0 if duration_result else 0
            
            files = self._safe_execute('SELECT COUNT(DISTINCT file_path) as count FROM tracks WHERE file_path IS NOT NULL', fetch=True)
            file_count = files[0]['count'] if files else 0
            
            return {
                'album_count': album_count,
                'track_count': track_count,
                'total_duration_seconds': total_duration,
                'total_duration_minutes': total_duration / 60 if total_duration else 0,
                'file_count': file_count
            }
        except Exception as e:
            print(f"获取统计信息失败: {e}")
            return {
                'album_count': 0,
                'track_count': 0,
                'total_duration_seconds': 0,
                'total_duration_minutes': 0,
                'file_count': 0
            }

    def export_library(self, file_path: str, batch_size: int = 100) -> bool:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(file_path)), exist_ok=True)
            
            albums = self.list_albums()
            
            for i, album in enumerate(albums):
                album['tracks'] = self.get_album_tracks(album['id'])
                for track in album['tracks']:
                    track['history'] = self.get_track_history(track['id'])
                
                if (i + 1) % batch_size == 0:
                    gc.collect()
            
            library_data = {
                'export_time': datetime.now().isoformat(),
                'statistics': self.get_statistics(),
                'albums': albums
            }
            
            temp_path = f"{file_path}.tmp"
            with open(temp_path, 'w', encoding='utf-8') as f:
                json.dump(library_data, f, indent=2, ensure_ascii=False)
            
            os.replace(temp_path, file_path)
            
            print(f"曲库已导出到: {file_path}")
            return True
        except Exception as e:
            print(f"导出曲库失败: {e}")
            if 'temp_path' in locals() and os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except:
                    pass
            return False

    def import_library(self, file_path: str, merge: bool = True, validate: bool = True) -> bool:
        try:
            if not os.path.exists(file_path):
                print(f"导入文件不存在: {file_path}")
                return False
            
            if validate:
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        test_data = json.load(f)
                    if 'albums' not in test_data:
                        print("导入文件格式无效: 缺少 'albums' 字段")
                        return False
                except json.JSONDecodeError as e:
                    print(f"JSON 解析失败: {e}")
                    return False
            
            with open(file_path, 'r', encoding='utf-8') as f:
                library_data = json.load(f)
            
            if not merge:
                self._safe_execute('DELETE FROM processing_history')
                self._safe_execute('DELETE FROM tracks')
                self._safe_execute('DELETE FROM albums')
            
            albums = library_data.get('albums', [])
            if not albums:
                print("警告: 没有找到专辑数据")
                return True
            
            success_count = 0
            for album in albums:
                try:
                    album_title = album.get('title', 'Unknown Album')
                    album_id = self.add_album(
                        title=album_title,
                        artist=album.get('artist'),
                        year=album.get('year'),
                        genre=album.get('genre'),
                        cover_image=album.get('cover_image'),
                        notes=album.get('notes')
                    )
                    
                    if album_id < 0:
                        continue
                    
                    for track in album.get('tracks', []):
                        try:
                            self.add_track(
                                album_id=album_id,
                                title=track.get('title', 'Unknown Track'),
                                file_path=track.get('file_path'),
                                track_number=track.get('track_number'),
                                duration=track.get('duration'),
                                file_format=track.get('file_format'),
                                bit_depth=track.get('bit_depth'),
                                sample_rate=track.get('sample_rate'),
                                peak_level=track.get('peak_level'),
                                rms_level=track.get('rms_level'),
                                date_recorded=track.get('date_recorded'),
                                notes=track.get('notes')
                            )
                        except Exception as track_e:
                            print(f"跳过曲目 {track.get('title')}: {track_e}")
                            continue
                    
                    success_count += 1
                    
                    if success_count % 10 == 0:
                        gc.collect()
                        
                except Exception as album_e:
                    print(f"跳过专辑 {album.get('title')}: {album_e}")
                    continue
            
            print(f"曲库已从 {file_path} 导入 (成功 {success_count}/{len(albums)} 专辑)")
            return True
        except Exception as e:
            print(f"导入曲库失败: {e}")
            return False

    def get_database_path(self) -> str:
        return self.db_path

    def is_healthy(self) -> bool:
        try:
            stats = self.get_statistics()
            return stats['album_count'] >= 0 or stats['track_count'] >= 0
        except:
            return False
