import sqlite3
import json
import os
from dataclasses import dataclass, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime
from pathlib import Path
import logging
from enum import Enum


class ArchiveStatus(Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    ARCHIVED = "archived"


class ProjectorModel(Enum):
    BELL_HOWELL_16MM = "BellHowell_16mm"
    KODAK_PAGEANT = "Kodak_Pageant"
    EUMIG_SUPER8 = "Eumig_Super8"
    BAUER_T1 = "Bauer_T1"
    CUSTOM = "custom"


@dataclass
class ProjectorConfig:
    config_id: str
    model_name: str
    projector_model: ProjectorModel
    serial_port: Optional[str] = None
    baud_rate: int = 9600
    connection_type: str = "serial"
    default_speed: float = 18.0
    lamp_brightness: int = 100
    color_profile: str = "default"
    scratch_sensitivity: float = 0.5
    noise_reduction_level: float = 0.7
    created_at: datetime = None
    updated_at: datetime = None
    is_active: bool = True
    notes: str = ""


@dataclass
class TranscriptionRecord:
    record_id: str
    title: str
    input_file: str
    output_file: str
    projector_config_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: ArchiveStatus = ArchiveStatus.PENDING
    duration_seconds: float = 0.0
    file_size_bytes: int = 0
    resolution: str = ""
    fps: float = 24.0
    color_correction_applied: bool = True
    scratch_removal_applied: bool = True
    noise_reduction_applied: bool = True
    quality_score: float = 0.0
    error_message: str = ""
    tags: List[str] = None
    custom_params: Dict[str, Any] = None
    created_by: str = ""
    notes: str = ""


@dataclass
class FilmInventory:
    inventory_id: str
    title: str
    film_type: str
    film_iso: int = 0
    reel_number: str = ""
    total_reels: int = 1
    runtime_minutes: int = 0
    year_produced: Optional[int] = None
    director: str = ""
    studio: str = ""
    condition: str = "good"
    storage_location: str = ""
    has_video: bool = True
    has_audio: bool = True
    color: bool = True
    silent: bool = False
    digitized: bool = False
    digitization_date: Optional[datetime] = None
    transcription_record_id: Optional[str] = None
    tags: List[str] = None
    notes: str = ""
    created_at: datetime = None
    updated_at: datetime = None


class ArchiveManager:
    def __init__(self, db_path: str = "./data/film_archive.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self.logger = logging.getLogger("ArchiveManager")
        self._init_database()

    def _init_database(self):
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projector_configs (
                config_id TEXT PRIMARY KEY,
                model_name TEXT NOT NULL,
                projector_model TEXT NOT NULL,
                serial_port TEXT,
                baud_rate INTEGER DEFAULT 9600,
                connection_type TEXT DEFAULT 'serial',
                default_speed REAL DEFAULT 18.0,
                lamp_brightness INTEGER DEFAULT 100,
                color_profile TEXT DEFAULT 'default',
                scratch_sensitivity REAL DEFAULT 0.5,
                noise_reduction_level REAL DEFAULT 0.7,
                created_at TEXT,
                updated_at TEXT,
                is_active INTEGER DEFAULT 1,
                notes TEXT
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS transcription_records (
                record_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                input_file TEXT NOT NULL,
                output_file TEXT NOT NULL,
                projector_config_id TEXT,
                start_time TEXT NOT NULL,
                end_time TEXT,
                status TEXT DEFAULT 'pending',
                duration_seconds REAL DEFAULT 0.0,
                file_size_bytes INTEGER DEFAULT 0,
                resolution TEXT,
                fps REAL DEFAULT 24.0,
                color_correction_applied INTEGER DEFAULT 1,
                scratch_removal_applied INTEGER DEFAULT 1,
                noise_reduction_applied INTEGER DEFAULT 1,
                quality_score REAL DEFAULT 0.0,
                error_message TEXT,
                tags TEXT,
                custom_params TEXT,
                created_by TEXT,
                notes TEXT,
                FOREIGN KEY (projector_config_id) REFERENCES projector_configs(config_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS film_inventory (
                inventory_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                film_type TEXT,
                film_iso INTEGER DEFAULT 0,
                reel_number TEXT,
                total_reels INTEGER DEFAULT 1,
                runtime_minutes INTEGER DEFAULT 0,
                year_produced INTEGER,
                director TEXT,
                studio TEXT,
                condition TEXT DEFAULT 'good',
                storage_location TEXT,
                has_video INTEGER DEFAULT 1,
                has_audio INTEGER DEFAULT 1,
                color INTEGER DEFAULT 1,
                silent INTEGER DEFAULT 0,
                digitized INTEGER DEFAULT 0,
                digitization_date TEXT,
                transcription_record_id TEXT,
                tags TEXT,
                notes TEXT,
                created_at TEXT,
                updated_at TEXT,
                FOREIGN KEY (transcription_record_id) REFERENCES transcription_records(record_id)
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS batch_jobs (
                job_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                total_tasks INTEGER DEFAULT 0,
                completed_tasks INTEGER DEFAULT 0,
                failed_tasks INTEGER DEFAULT 0,
                created_at TEXT,
                started_at TEXT,
                completed_at TEXT,
                output_directory TEXT,
                config_ids TEXT,
                notes TEXT
            )
        ''')

        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_records_status ON transcription_records(status)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_records_date ON transcription_records(start_time)
        ''')
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_inventory_digitized ON film_inventory(digitized)
        ''')

        conn.commit()
        conn.close()
        self.logger.info("Database initialized successfully")

    def _serialize_datetime(self, dt: Optional[datetime]) -> Optional[str]:
        return dt.isoformat() if dt else None

    def _deserialize_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        if not dt_str:
            return None
        try:
            return datetime.fromisoformat(dt_str)
        except:
            return None

    def _serialize_list(self, lst: Optional[List]) -> str:
        return json.dumps(lst or [])

    def _deserialize_list(self, lst_str: Optional[str]) -> List:
        if not lst_str:
            return []
        try:
            return json.loads(lst_str)
        except:
            return []

    def _serialize_dict(self, d: Optional[Dict]) -> str:
        return json.dumps(d or {})

    def _deserialize_dict(self, d_str: Optional[str]) -> Dict:
        if not d_str:
            return {}
        try:
            return json.loads(d_str)
        except:
            return {}

    def add_projector_config(self, config: ProjectorConfig) -> bool:
        try:
            now = datetime.now()
            if not config.created_at:
                config.created_at = now
            config.updated_at = now

            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('''
                INSERT OR REPLACE INTO projector_configs (
                    config_id, model_name, projector_model, serial_port,
                    baud_rate, connection_type, default_speed, lamp_brightness,
                    color_profile, scratch_sensitivity, noise_reduction_level,
                    created_at, updated_at, is_active, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                config.config_id, config.model_name, config.projector_model.value,
                config.serial_port, config.baud_rate, config.connection_type,
                config.default_speed, config.lamp_brightness, config.color_profile,
                config.scratch_sensitivity, config.noise_reduction_level,
                self._serialize_datetime(config.created_at),
                self._serialize_datetime(config.updated_at),
                1 if config.is_active else 0, config.notes
            ))

            conn.commit()
            conn.close()
            self.logger.info(f"Added projector config: {config.config_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error adding projector config: {e}")
            return False

    def get_projector_config(self, config_id: str) -> Optional[ProjectorConfig]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM projector_configs WHERE config_id = ?', (config_id,))
            row = cursor.fetchone()
            conn.close()

            if row:
                return self._row_to_projector_config(row)
            return None
        except Exception as e:
            self.logger.error(f"Error getting projector config: {e}")
            return None

    def _row_to_projector_config(self, row) -> ProjectorConfig:
        return ProjectorConfig(
            config_id=row[0], model_name=row[1],
            projector_model=ProjectorModel(row[2]) if row[2] else ProjectorModel.CUSTOM,
            serial_port=row[3], baud_rate=row[4], connection_type=row[5],
            default_speed=row[6], lamp_brightness=row[7], color_profile=row[8],
            scratch_sensitivity=row[9], noise_reduction_level=row[10],
            created_at=self._deserialize_datetime(row[11]),
            updated_at=self._deserialize_datetime(row[12]),
            is_active=bool(row[13]), notes=row[14]
        )

    def get_all_projector_configs(self, active_only: bool = True) -> List[ProjectorConfig]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            if active_only:
                cursor.execute('SELECT * FROM projector_configs WHERE is_active = 1 ORDER BY model_name')
            else:
                cursor.execute('SELECT * FROM projector_configs ORDER BY model_name')

            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_projector_config(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error getting projector configs: {e}")
            return []

    def delete_projector_config(self, config_id: str) -> bool:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()
            cursor.execute('DELETE FROM projector_configs WHERE config_id = ?', (config_id,))
            conn.commit()
            conn.close()
            self.logger.info(f"Deleted projector config: {config_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error deleting projector config: {e}")
            return False

    def add_transcription_record(self, record: TranscriptionRecord) -> bool:
        try:
            now = datetime.now()
            if not record.start_time:
                record.start_time = now

            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('''
                INSERT OR REPLACE INTO transcription_records (
                    record_id, title, input_file, output_file, projector_config_id,
                    start_time, end_time, status, duration_seconds, file_size_bytes,
                    resolution, fps, color_correction_applied, scratch_removal_applied,
                    noise_reduction_applied, quality_score, error_message, tags,
                    custom_params, created_by, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record.record_id, record.title, record.input_file, record.output_file,
                record.projector_config_id, self._serialize_datetime(record.start_time),
                self._serialize_datetime(record.end_time), record.status.value,
                record.duration_seconds, record.file_size_bytes, record.resolution,
                record.fps, 1 if record.color_correction_applied else 0,
                1 if record.scratch_removal_applied else 0,
                1 if record.noise_reduction_applied else 0,
                record.quality_score, record.error_message,
                self._serialize_list(record.tags),
                self._serialize_dict(record.custom_params),
                record.created_by, record.notes
            ))

            conn.commit()
            conn.close()
            self.logger.info(f"Added transcription record: {record.record_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error adding transcription record: {e}")
            return False

    def get_transcription_record(self, record_id: str) -> Optional[TranscriptionRecord]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM transcription_records WHERE record_id = ?', (record_id,))
            row = cursor.fetchone()
            conn.close()

            if row:
                return self._row_to_transcription_record(row)
            return None
        except Exception as e:
            self.logger.error(f"Error getting transcription record: {e}")
            return None

    def _row_to_transcription_record(self, row) -> TranscriptionRecord:
        return TranscriptionRecord(
            record_id=row[0], title=row[1], input_file=row[2], output_file=row[3],
            projector_config_id=row[4], start_time=self._deserialize_datetime(row[5]),
            end_time=self._deserialize_datetime(row[6]), status=ArchiveStatus(row[7]),
            duration_seconds=row[8], file_size_bytes=row[9], resolution=row[10],
            fps=row[11], color_correction_applied=bool(row[12]),
            scratch_removal_applied=bool(row[13]), noise_reduction_applied=bool(row[14]),
            quality_score=row[15], error_message=row[16],
            tags=self._deserialize_list(row[17]),
            custom_params=self._deserialize_dict(row[18]),
            created_by=row[19], notes=row[20]
        )

    def get_transcription_records(self, status: Optional[ArchiveStatus] = None,
                                   limit: int = 100) -> List[TranscriptionRecord]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            if status:
                cursor.execute('''
                    SELECT * FROM transcription_records
                    WHERE status = ?
                    ORDER BY start_time DESC LIMIT ?
                ''', (status.value, limit))
            else:
                cursor.execute('''
                    SELECT * FROM transcription_records
                    ORDER BY start_time DESC LIMIT ?
                ''', (limit,))

            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_transcription_record(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error getting transcription records: {e}")
            return []

    def update_transcription_status(self, record_id: str, status: ArchiveStatus,
                                    error_message: str = "") -> bool:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            if status == ArchiveStatus.COMPLETED:
                cursor.execute('''
                    UPDATE transcription_records
                    SET status = ?, end_time = ?, error_message = ?
                    WHERE record_id = ?
                ''', (status.value, self._serialize_datetime(datetime.now()), error_message, record_id))
            else:
                cursor.execute('''
                    UPDATE transcription_records SET status = ?, error_message = ?
                    WHERE record_id = ?
                ''', (status.value, error_message, record_id))

            conn.commit()
            conn.close()
            return True
        except Exception as e:
            self.logger.error(f"Error updating transcription status: {e}")
            return False

    def add_film_inventory(self, inventory: FilmInventory) -> bool:
        try:
            now = datetime.now()
            if not inventory.created_at:
                inventory.created_at = now
            inventory.updated_at = now

            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('''
                INSERT OR REPLACE INTO film_inventory (
                    inventory_id, title, film_type, film_iso, reel_number,
                    total_reels, runtime_minutes, year_produced, director,
                    studio, condition, storage_location, has_video, has_audio,
                    color, silent, digitized, digitization_date,
                    transcription_record_id, tags, notes, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                inventory.inventory_id, inventory.title, inventory.film_type,
                inventory.film_iso, inventory.reel_number, inventory.total_reels,
                inventory.runtime_minutes, inventory.year_produced, inventory.director,
                inventory.studio, inventory.condition, inventory.storage_location,
                1 if inventory.has_video else 0, 1 if inventory.has_audio else 0,
                1 if inventory.color else 0, 1 if inventory.silent else 0,
                1 if inventory.digitized else 0,
                self._serialize_datetime(inventory.digitization_date),
                inventory.transcription_record_id,
                self._serialize_list(inventory.tags), inventory.notes,
                self._serialize_datetime(inventory.created_at),
                self._serialize_datetime(inventory.updated_at)
            ))

            conn.commit()
            conn.close()
            self.logger.info(f"Added film inventory: {inventory.inventory_id}")
            return True
        except Exception as e:
            self.logger.error(f"Error adding film inventory: {e}")
            return False

    def get_film_inventory(self, inventory_id: str) -> Optional[FilmInventory]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM film_inventory WHERE inventory_id = ?', (inventory_id,))
            row = cursor.fetchone()
            conn.close()

            if row:
                return self._row_to_film_inventory(row)
            return None
        except Exception as e:
            self.logger.error(f"Error getting film inventory: {e}")
            return None

    def _row_to_film_inventory(self, row) -> FilmInventory:
        return FilmInventory(
            inventory_id=row[0], title=row[1], film_type=row[2], film_iso=row[3],
            reel_number=row[4], total_reels=row[5], runtime_minutes=row[6],
            year_produced=row[7], director=row[8], studio=row[9], condition=row[10],
            storage_location=row[11], has_video=bool(row[12]), has_audio=bool(row[13]),
            color=bool(row[14]), silent=bool(row[15]), digitized=bool(row[16]),
            digitization_date=self._deserialize_datetime(row[17]),
            transcription_record_id=row[18], tags=self._deserialize_list(row[19]),
            notes=row[20], created_at=self._deserialize_datetime(row[21]),
            updated_at=self._deserialize_datetime(row[22])
        )

    def get_all_film_inventory(self, digitized_only: bool = False,
                                limit: int = 1000) -> List[FilmInventory]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            if digitized_only:
                cursor.execute('''
                    SELECT * FROM film_inventory WHERE digitized = 1
                    ORDER BY title LIMIT ?
                ''', (limit,))
            else:
                cursor.execute('''
                    SELECT * FROM film_inventory ORDER BY title LIMIT ?
                ''', (limit,))

            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_film_inventory(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error getting film inventory: {e}")
            return []

    def search_films(self, query: str) -> List[FilmInventory]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            search_query = f"%{query}%"
            cursor.execute('''
                SELECT * FROM film_inventory
                WHERE title LIKE ? OR director LIKE ? OR studio LIKE ? OR notes LIKE ?
                ORDER BY title
            ''', (search_query, search_query, search_query, search_query))

            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_film_inventory(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error searching films: {e}")
            return []

    def get_statistics(self) -> Dict[str, Any]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT COUNT(*) FROM film_inventory')
            total_films = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM film_inventory WHERE digitized = 1')
            digitized_films = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM transcription_records')
            total_transcriptions = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM transcription_records WHERE status = ?',
                         (ArchiveStatus.COMPLETED.value,))
            completed_transcriptions = cursor.fetchone()[0]

            cursor.execute('SELECT COUNT(*) FROM projector_configs WHERE is_active = 1')
            active_configs = cursor.fetchone()[0]

            cursor.execute('SELECT SUM(file_size_bytes) FROM transcription_records')
            total_storage = cursor.fetchone()[0] or 0

            conn.close()

            return {
                "total_films": total_films,
                "digitized_films": digitized_films,
                "pending_digitization": total_films - digitized_films,
                "total_transcriptions": total_transcriptions,
                "completed_transcriptions": completed_transcriptions,
                "active_projector_configs": active_configs,
                "total_storage_bytes": total_storage,
                "digitization_rate": digitized_films / total_films if total_films > 0 else 0
            }
        except Exception as e:
            self.logger.error(f"Error getting statistics: {e}")
            return {}

    def export_configs(self, output_path: str) -> bool:
        try:
            configs = self.get_all_projector_configs(active_only=False)
            config_dicts = []
            for cfg in configs:
                d = asdict(cfg)
                d['projector_model'] = d['projector_model'].value
                d['created_at'] = self._serialize_datetime(d['created_at'])
                d['updated_at'] = self._serialize_datetime(d['updated_at'])
                config_dicts.append(d)

            with open(output_path, 'w') as f:
                json.dump(config_dicts, f, indent=2)

            self.logger.info(f"Exported configs to {output_path}")
            return True
        except Exception as e:
            self.logger.error(f"Error exporting configs: {e}")
            return False

    def import_configs(self, input_path: str) -> int:
        try:
            with open(input_path, 'r') as f:
                config_dicts = json.load(f)

            imported = 0
            for d in config_dicts:
                d['projector_model'] = ProjectorModel(d['projector_model'])
                d['created_at'] = self._deserialize_datetime(d['created_at'])
                d['updated_at'] = self._deserialize_datetime(d['updated_at'])
                config = ProjectorConfig(**d)
                if self.add_projector_config(config):
                    imported += 1

            self.logger.info(f"Imported {imported} configs from {input_path}")
            return imported
        except Exception as e:
            self.logger.error(f"Error importing configs: {e}")
            return 0

    def add_tags_to_record(self, record_id: str, tags: List[str]) -> bool:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT tags FROM transcription_records WHERE record_id = ?', (record_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False

            current_tags = self._deserialize_list(row[0])
            for tag in tags:
                if tag not in current_tags:
                    current_tags.append(tag)

            cursor.execute('''
                UPDATE transcription_records SET tags = ? WHERE record_id = ?
            ''', (self._serialize_list(current_tags), record_id))

            conn.commit()
            conn.close()
            self.logger.info(f"Added tags to record {record_id}: {tags}")
            return True
        except Exception as e:
            self.logger.error(f"Error adding tags to record: {e}")
            return False

    def remove_tags_from_record(self, record_id: str, tags: List[str]) -> bool:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT tags FROM transcription_records WHERE record_id = ?', (record_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False

            current_tags = self._deserialize_list(row[0])
            current_tags = [t for t in current_tags if t not in tags]

            cursor.execute('''
                UPDATE transcription_records SET tags = ? WHERE record_id = ?
            ''', (self._serialize_list(current_tags), record_id))

            conn.commit()
            conn.close()
            self.logger.info(f"Removed tags from record {record_id}: {tags}")
            return True
        except Exception as e:
            self.logger.error(f"Error removing tags from record: {e}")
            return False

    def add_tags_to_inventory(self, inventory_id: str, tags: List[str]) -> bool:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT tags FROM film_inventory WHERE inventory_id = ?', (inventory_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False

            current_tags = self._deserialize_list(row[0])
            for tag in tags:
                if tag not in current_tags:
                    current_tags.append(tag)

            cursor.execute('''
                UPDATE film_inventory SET tags = ? WHERE inventory_id = ?
            ''', (self._serialize_list(current_tags), inventory_id))

            conn.commit()
            conn.close()
            self.logger.info(f"Added tags to inventory {inventory_id}: {tags}")
            return True
        except Exception as e:
            self.logger.error(f"Error adding tags to inventory: {e}")
            return False

    def remove_tags_from_inventory(self, inventory_id: str, tags: List[str]) -> bool:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT tags FROM film_inventory WHERE inventory_id = ?', (inventory_id,))
            row = cursor.fetchone()
            if not row:
                conn.close()
                return False

            current_tags = self._deserialize_list(row[0])
            current_tags = [t for t in current_tags if t not in tags]

            cursor.execute('''
                UPDATE film_inventory SET tags = ? WHERE inventory_id = ?
            ''', (self._serialize_list(current_tags), inventory_id))

            conn.commit()
            conn.close()
            self.logger.info(f"Removed tags from inventory {inventory_id}: {tags}")
            return True
        except Exception as e:
            self.logger.error(f"Error removing tags from inventory: {e}")
            return False

    def get_all_tags(self) -> List[str]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT tags FROM transcription_records WHERE tags IS NOT NULL AND tags != "[]"')
            record_tags = cursor.fetchall()

            cursor.execute('SELECT tags FROM film_inventory WHERE tags IS NOT NULL AND tags != "[]"')
            inventory_tags = cursor.fetchall()

            all_tags = set()
            for (tags_str,) in record_tags + inventory_tags:
                tags = self._deserialize_list(tags_str)
                all_tags.update(tags)

            conn.close()
            return sorted(list(all_tags))
        except Exception as e:
            self.logger.error(f"Error getting all tags: {e}")
            return []

    def get_tag_counts(self) -> Dict[str, int]:
        try:
            all_tags = self.get_all_tags()
            tag_counts = {tag: 0 for tag in all_tags}

            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT tags FROM transcription_records WHERE tags IS NOT NULL AND tags != "[]"')
            for (tags_str,) in cursor.fetchall():
                tags = self._deserialize_list(tags_str)
                for tag in tags:
                    if tag in tag_counts:
                        tag_counts[tag] += 1

            conn.close()
            return dict(sorted(tag_counts.items(), key=lambda x: x[1], reverse=True))
        except Exception as e:
            self.logger.error(f"Error getting tag counts: {e}")
            return {}

    def search_by_tags(self, tags: List[str], match_all: bool = True) -> List[FilmInventory]:
        if not tags:
            return []

        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM film_inventory WHERE tags IS NOT NULL AND tags != "[]"')
            rows = cursor.fetchall()

            results = []
            for row in rows:
                film_tags = self._deserialize_list(row[19])
                if match_all:
                    if all(tag in film_tags for tag in tags):
                        results.append(self._row_to_film_inventory(row))
                else:
                    if any(tag in film_tags for tag in tags):
                        results.append(self._row_to_film_inventory(row))

            conn.close()
            return results
        except Exception as e:
            self.logger.error(f"Error searching by tags: {e}")
            return []

    def search_records_by_tags(self, tags: List[str], match_all: bool = True) -> List[TranscriptionRecord]:
        if not tags:
            return []

        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT * FROM transcription_records WHERE tags IS NOT NULL AND tags != "[]"')
            rows = cursor.fetchall()

            results = []
            for row in rows:
                record_tags = self._deserialize_list(row[17])
                if match_all:
                    if all(tag in record_tags for tag in tags):
                        results.append(self._row_to_transcription_record(row))
                else:
                    if any(tag in record_tags for tag in tags):
                        results.append(self._row_to_transcription_record(row))

            conn.close()
            return results
        except Exception as e:
            self.logger.error(f"Error searching records by tags: {e}")
            return []

    def search_by_year(self, start_year: Optional[int] = None, end_year: Optional[int] = None) -> List[FilmInventory]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            if start_year and end_year:
                cursor.execute('''
                    SELECT * FROM film_inventory
                    WHERE year_produced BETWEEN ? AND ?
                    ORDER BY year_produced, title
                ''', (start_year, end_year))
            elif start_year:
                cursor.execute('''
                    SELECT * FROM film_inventory WHERE year_produced >= ?
                    ORDER BY year_produced, title
                ''', (start_year,))
            elif end_year:
                cursor.execute('''
                    SELECT * FROM film_inventory WHERE year_produced <= ?
                    ORDER BY year_produced, title
                ''', (end_year,))
            else:
                return []

            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_film_inventory(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error searching by year: {e}")
            return []

    def search_by_film_type(self, film_type: str) -> List[FilmInventory]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('''
                SELECT * FROM film_inventory WHERE film_type LIKE ?
                ORDER BY title
            ''', (f"%{film_type}%",))

            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_film_inventory(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error searching by film type: {e}")
            return []

    def advanced_search(self, **kwargs) -> List[FilmInventory]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            conditions = []
            params = []

            if 'title' in kwargs:
                conditions.append('title LIKE ?')
                params.append(f"%{kwargs['title']}%")

            if 'year_min' in kwargs:
                conditions.append('year_produced >= ?')
                params.append(kwargs['year_min'])

            if 'year_max' in kwargs:
                conditions.append('year_produced <= ?')
                params.append(kwargs['year_max'])

            if 'film_type' in kwargs:
                conditions.append('film_type LIKE ?')
                params.append(f"%{kwargs['film_type']}%")

            if 'director' in kwargs:
                conditions.append('director LIKE ?')
                params.append(f"%{kwargs['director']}%")

            if 'studio' in kwargs:
                conditions.append('studio LIKE ?')
                params.append(f"%{kwargs['studio']}%")

            if 'condition' in kwargs:
                conditions.append('condition = ?')
                params.append(kwargs['condition'])

            if 'digitized' in kwargs:
                conditions.append('digitized = ?')
                params.append(1 if kwargs['digitized'] else 0)

            if 'color' in kwargs:
                conditions.append('color = ?')
                params.append(1 if kwargs['color'] else 0)

            if 'silent' in kwargs:
                conditions.append('silent = ?')
                params.append(1 if kwargs['silent'] else 0)

            if not conditions:
                conn.close()
                return []

            where_clause = ' AND '.join(conditions)
            query = f'''
                SELECT * FROM film_inventory WHERE {where_clause}
                ORDER BY year_produced, title
            '''

            cursor.execute(query, params)
            rows = cursor.fetchall()
            conn.close()

            return [self._row_to_film_inventory(row) for row in rows]
        except Exception as e:
            self.logger.error(f"Error in advanced search: {e}")
            return []

    def get_film_types(self) -> List[str]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT DISTINCT film_type FROM film_inventory WHERE film_type IS NOT NULL AND film_type != ""')
            rows = cursor.fetchall()

            conn.close()
            return sorted([row[0] for row in rows if row[0]])
        except Exception as e:
            self.logger.error(f"Error getting film types: {e}")
            return []

    def get_decades(self) -> List[int]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('SELECT DISTINCT year_produced FROM film_inventory WHERE year_produced IS NOT NULL')
            rows = cursor.fetchall()

            conn.close()

            years = [row[0] for row in rows if row[0]]
            decades = sorted(list(set([y // 10 * 10 for y in years])))
            return decades
        except Exception as e:
            self.logger.error(f"Error getting decades: {e}")
            return []

    def get_statistics_by_decade(self) -> Dict[int, Dict[str, int]]:
        try:
            decades = self.get_decades()
            results = {}

            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            for decade in decades:
                cursor.execute('''
                    SELECT COUNT(*) as total, SUM(digitized) as digitized
                    FROM film_inventory
                    WHERE year_produced >= ? AND year_produced < ?
                ''', (decade, decade + 10))

                row = cursor.fetchone()
                results[decade] = {
                    'total': row[0] or 0,
                    'digitized': row[1] or 0
                }

            conn.close()
            return results
        except Exception as e:
            self.logger.error(f"Error getting statistics by decade: {e}")
            return {}

    def get_films_by_condition(self) -> Dict[str, int]:
        try:
            conn = sqlite3.connect(str(self.db_path))
            cursor = conn.cursor()

            cursor.execute('''
                SELECT condition, COUNT(*) FROM film_inventory
                WHERE condition IS NOT NULL AND condition != ""
                GROUP BY condition
            ''')

            rows = cursor.fetchall()
            conn.close()

            return {row[0]: row[1] for row in rows}
        except Exception as e:
            self.logger.error(f"Error getting films by condition: {e}")
            return {}
