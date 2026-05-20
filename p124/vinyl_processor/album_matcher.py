import numpy as np
from typing import Dict, List, Optional, Tuple, Any
import json
import os
import re
from difflib import SequenceMatcher
import hashlib
import warnings
warnings.filterwarnings('ignore')

try:
    import music_tag
    MUSIC_TAG_AVAILABLE = True
except ImportError:
    MUSIC_TAG_AVAILABLE = False
    print("music_tag 未安装，标签功能受限")


class AlbumMetadata:
    def __init__(self, title: str = "", artist: str = ""):
        self.title = title
        self.artist = artist
        self.year = ""
        self.genre = ""
        self.label = ""
        self.catalog_number = ""
        self.tracks: List[Dict[str, Any]] = []
        self.cover_url = ""
        self.discogs_id = ""
        self.musicbrainz_id = ""
        self.confidence = 0.0
    
    def to_dict(self) -> Dict:
        return {
            "title": self.title,
            "artist": self.artist,
            "year": self.year,
            "genre": self.genre,
            "label": self.label,
            "catalog_number": self.catalog_number,
            "tracks": self.tracks,
            "cover_url": self.cover_url,
            "discogs_id": self.discogs_id,
            "musicbrainz_id": self.musicbrainz_id,
            "confidence": float(self.confidence)
        }
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'AlbumMetadata':
        meta = cls(data.get("title", ""), data.get("artist", ""))
        meta.year = data.get("year", "")
        meta.genre = data.get("genre", "")
        meta.label = data.get("label", "")
        meta.catalog_number = data.get("catalog_number", "")
        meta.tracks = data.get("tracks", [])
        meta.cover_url = data.get("cover_url", "")
        meta.discogs_id = data.get("discogs_id", "")
        meta.musicbrainz_id = data.get("musicbrainz_id", "")
        meta.confidence = data.get("confidence", 0.0)
        return meta
    
    def __repr__(self) -> str:
        return f"AlbumMetadata('{self.artist}' - '{self.title}', confidence={self.confidence:.2f})"


class AudioFingerprinter:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
    
    def compute_fingerprint(self, audio: np.ndarray) -> str:
        try:
            if audio.ndim == 2:
                audio_mono = np.mean(audio, axis=1)
            else:
                audio_mono = audio
            
            downsample_factor = max(1, len(audio_mono) // 10000)
            audio_downsampled = audio_mono[::downsample_factor]
            
            normalized = audio_downsampled / (np.max(np.abs(audio_downsampled)) + 1e-8)
            
            features = []
            for i in range(0, len(normalized), 100):
                chunk = normalized[i:i+100]
                if len(chunk) > 0:
                    features.append(np.mean(chunk))
                    features.append(np.std(chunk))
                    features.append(np.max(np.abs(chunk)))
            
            features_np = np.array(features[:100])
            
            fingerprint = hashlib.sha256(features_np.tobytes()).hexdigest()
            return fingerprint
        except Exception as e:
            print(f"计算音频指纹失败: {e}")
            return ""
    
    def compare_fingerprints(self, fp1: str, fp2: str) -> float:
        if not fp1 or not fp2:
            return 0.0
        
        matches = sum(1 for a, b in zip(fp1, fp2) if a == b)
        return matches / len(fp1)


class AlbumMatcher:
    def __init__(self, sample_rate: int = 44100):
        self.sample_rate = sample_rate
        self.fingerprinter = AudioFingerprinter(sample_rate)
        self._local_database: Dict[str, AlbumMetadata] = {}
        self._fingerprint_index: Dict[str, str] = {}
        self._load_local_database()
    
    def _load_local_database(self):
        try:
            home_dir = os.path.expanduser("~")
            db_path = os.path.join(home_dir, ".vinyl_processor", "album_db.json")
            
            if os.path.exists(db_path):
                with open(db_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                for key, value in data.items():
                    self._local_database[key] = AlbumMetadata.from_dict(value)
                    if "fingerprint" in value:
                        self._fingerprint_index[value["fingerprint"]] = key
                
                print(f"已加载 {len(self._local_database)} 条专辑记录")
        except Exception as e:
            print(f"加载专辑数据库失败: {e}")
    
    def _save_local_database(self):
        try:
            home_dir = os.path.expanduser("~")
            config_dir = os.path.join(home_dir, ".vinyl_processor")
            os.makedirs(config_dir, exist_ok=True)
            
            db_path = os.path.join(config_dir, "album_db.json")
            
            data = {}
            for key, album in self._local_database.items():
                data[key] = album.to_dict()
            
            with open(db_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            
            print("专辑数据库已保存")
        except Exception as e:
            print(f"保存专辑数据库失败: {e}")
    
    def add_to_database(self, album: AlbumMetadata, fingerprint: str = "") -> bool:
        try:
            key = f"{album.artist.lower()}_{album.title.lower()}".replace(" ", "_")
            self._local_database[key] = album
            
            if fingerprint:
                self._fingerprint_index[fingerprint] = key
            
            self._save_local_database()
            print(f"专辑已添加到数据库: {album.artist} - {album.title}")
            return True
        except Exception as e:
            print(f"添加专辑到数据库失败: {e}")
            return False
    
    def _string_similarity(self, str1: str, str2: str) -> float:
        if not str1 or not str2:
            return 0.0
        
        str1_clean = self._clean_string(str1)
        str2_clean = self._clean_string(str2)
        
        return SequenceMatcher(None, str1_clean, str2_clean).ratio()
    
    def _clean_string(self, s: str) -> str:
        s = s.lower()
        s = re.sub(r'[^\w\s]', '', s)
        s = re.sub(r'\s+', ' ', s).strip()
        return s
    
    def match_by_filename(self, filename: str) -> List[AlbumMetadata]:
        matches = []
        
        filename_clean = self._clean_string(filename)
        
        for key, album in self._local_database.items():
            artist_score = self._string_similarity(album.artist, filename_clean)
            title_score = self._string_similarity(album.title, filename_clean)
            
            combined_score = max(artist_score, title_score)
            
            if combined_score > 0.5:
                album.confidence = combined_score
                matches.append(album)
        
        matches.sort(key=lambda x: x.confidence, reverse=True)
        return matches[:5]
    
    def match_by_audio(self, audio: np.ndarray) -> List[AlbumMetadata]:
        matches = []
        
        try:
            fingerprint = self.fingerprinter.compute_fingerprint(audio)
            
            if fingerprint in self._fingerprint_index:
                key = self._fingerprint_index[fingerprint]
                album = self._local_database[key]
                album.confidence = 0.95
                matches.append(album)
                return matches
            
            for stored_fp, key in self._fingerprint_index.items():
                similarity = self.fingerprinter.compare_fingerprints(fingerprint, stored_fp)
                if similarity > 0.7:
                    album = self._local_database[key]
                    album.confidence = similarity
                    matches.append(album)
            
            matches.sort(key=lambda x: x.confidence, reverse=True)
            return matches[:3]
        
        except Exception as e:
            print(f"音频匹配失败: {e}")
            return matches
    
    def match_by_metadata(self, artist: str = "", title: str = "", year: str = "") -> List[AlbumMetadata]:
        matches = []
        
        for key, album in self._local_database.items():
            scores = []
            
            if artist:
                scores.append(self._string_similarity(artist, album.artist))
            if title:
                scores.append(self._string_similarity(title, album.title))
            if year and album.year:
                scores.append(1.0 if str(year) == str(album.year) else 0.0)
            
            if scores:
                avg_score = sum(scores) / len(scores)
                if avg_score > 0.4:
                    album.confidence = avg_score
                    matches.append(album)
        
        matches.sort(key=lambda x: x.confidence, reverse=True)
        return matches[:5]
    
    def smart_match(self, audio: np.ndarray = None, filename: str = "",
                   artist: str = "", title: str = "", year: str = "") -> List[AlbumMetadata]:
        all_matches = {}
        
        if audio is not None:
            audio_matches = self.match_by_audio(audio)
            for match in audio_matches:
                key = f"{match.artist}_{match.title}"
                if key not in all_matches or match.confidence > all_matches[key].confidence:
                    match.confidence *= 1.0
                    all_matches[key] = match
        
        if filename:
            filename_matches = self.match_by_filename(filename)
            for match in filename_matches:
                key = f"{match.artist}_{match.title}"
                if key not in all_matches or match.confidence * 0.9 > all_matches[key].confidence:
                    match.confidence *= 0.9
                    all_matches[key] = match
        
        if artist or title:
            meta_matches = self.match_by_metadata(artist, title, year)
            for match in meta_matches:
                key = f"{match.artist}_{match.title}"
                if key not in all_matches or match.confidence * 0.85 > all_matches[key].confidence:
                    match.confidence *= 0.85
                    all_matches[key] = match
        
        results = list(all_matches.values())
        results.sort(key=lambda x: x.confidence, reverse=True)
        return results
    
    def search_album(self, query: str) -> List[AlbumMetadata]:
        matches = []
        query_clean = self._clean_string(query)
        
        for key, album in self._local_database.items():
            search_text = f"{album.artist} {album.title} {album.year} {album.genre}"
            search_clean = self._clean_string(search_text)
            
            similarity = self._string_similarity(query_clean, search_clean)
            
            if query_clean in search_clean or similarity > 0.5:
                album.confidence = max(similarity, 0.6 if query_clean in search_clean else similarity)
                matches.append(album)
        
        matches.sort(key=lambda x: x.confidence, reverse=True)
        return matches[:10]
    
    def get_album_info(self, artist: str, title: str) -> Optional[AlbumMetadata]:
        key = f"{artist.lower()}_{title.lower()}".replace(" ", "_")
        return self._local_database.get(key)
    
    def list_all_albums(self) -> List[AlbumMetadata]:
        return list(self._local_database.values())
    
    def write_id3_tags(self, file_path: str, album: AlbumMetadata, track_number: int = 1) -> bool:
        if not MUSIC_TAG_AVAILABLE:
            print("music_tag 未安装，无法写入标签")
            return False
        
        try:
            f = music_tag.load_file(file_path)
            
            f['artist'] = album.artist
            f['album'] = album.title
            f['year'] = str(album.year) if album.year else ""
            f['genre'] = album.genre
            
            if album.tracks and track_number <= len(album.tracks):
                track = album.tracks[track_number - 1]
                f['tracktitle'] = track.get("title", "")
                f['tracknumber'] = f"{track_number}/{len(album.tracks)}"
            else:
                f['tracknumber'] = str(track_number)
            
            f.save()
            print(f"标签已写入: {file_path}")
            return True
        except Exception as e:
            print(f"写入标签失败: {e}")
            return False
    
    def read_id3_tags(self, file_path: str) -> Optional[Dict]:
        if not MUSIC_TAG_AVAILABLE:
            print("music_tag 未安装，无法读取标签")
            return None
        
        try:
            f = music_tag.load_file(file_path)
            
            tags = {
                "artist": str(f.get('artist', '')),
                "album": str(f.get('album', '')),
                "title": str(f.get('tracktitle', '')),
                "year": str(f.get('year', '')),
                "genre": str(f.get('genre', '')),
                "tracknumber": str(f.get('tracknumber', ''))
            }
            
            return tags
        except Exception as e:
            print(f"读取标签失败: {e}")
            return None
    
    def get_suggested_metadata(self, filename: str) -> Dict:
        result = {
            "artist": "",
            "album": "",
            "title": "",
            "year": "",
            "track_number": 1,
            "confidence": 0.0
        }
        
        try:
            filename_clean = os.path.basename(filename)
            filename_clean = os.path.splitext(filename_clean)[0]
            
            year_match = re.search(r'\b(19|20)\d{2}\b', filename_clean)
            if year_match:
                result["year"] = year_match.group()
                result["confidence"] += 0.1
            
            track_match = re.search(r'^(\d{1,2})\s*[-_.]\s*', filename_clean)
            if track_match:
                result["track_number"] = int(track_match.group(1))
                result["confidence"] += 0.15
            
            if ' - ' in filename_clean:
                parts = filename_clean.split(' - ', 1)
                if len(parts) == 2:
                    result["artist"] = parts[0].strip()
                    result["title"] = parts[1].strip()
                    result["confidence"] += 0.3
            
            matches = self.match_by_filename(filename_clean)
            if matches:
                best_match = matches[0]
                result["artist"] = result["artist"] or best_match.artist
                result["album"] = result["album"] or best_match.title
                result["year"] = result["year"] or best_match.year
                result["confidence"] = max(result["confidence"], best_match.confidence)
            
            return result
        except Exception as e:
            print(f"提取元数据建议失败: {e}")
            return result
    
    def create_sample_database(self):
        sample_albums = [
            {
                "title": "Dark Side of the Moon",
                "artist": "Pink Floyd",
                "year": "1973",
                "genre": "Progressive Rock",
                "label": "Harvest",
                "tracks": [
                    {"title": "Speak to Me", "duration": "1:30"},
                    {"title": "Breathe", "duration": "2:43"},
                    {"title": "On the Run", "duration": "3:35"},
                    {"title": "Time", "duration": "7:06"},
                    {"title": "The Great Gig in the Sky", "duration": "4:43"},
                    {"title": "Money", "duration": "6:22"},
                    {"title": "Us and Them", "duration": "7:49"},
                    {"title": "Any Colour You Like", "duration": "3:26"},
                    {"title": "Brain Damage", "duration": "3:50"},
                    {"title": "Eclipse", "duration": "2:03"}
                ]
            },
            {
                "title": "Abbey Road",
                "artist": "The Beatles",
                "year": "1969",
                "genre": "Rock",
                "label": "Apple",
                "tracks": [
                    {"title": "Come Together", "duration": "4:19"},
                    {"title": "Something", "duration": "3:02"},
                    {"title": "Maxwell's Silver Hammer", "duration": "3:27"},
                    {"title": "Oh! Darling", "duration": "3:27"},
                    {"title": "Octopus's Garden", "duration": "2:51"},
                    {"title": "I Want You (She's So Heavy)", "duration": "7:47"},
                    {"title": "Here Comes the Sun", "duration": "3:05"},
                    {"title": "Because", "duration": "2:45"},
                    {"title": "You Never Give Me Your Money", "duration": "4:03"},
                    {"title": "Sun King", "duration": "2:26"}
                ]
            },
            {
                "title": "Thriller",
                "artist": "Michael Jackson",
                "year": "1982",
                "genre": "Pop",
                "label": "Epic",
                "tracks": [
                    {"title": "Wanna Be Startin' Somethin'", "duration": "6:02"},
                    {"title": "Baby Be Mine", "duration": "4:20"},
                    {"title": "The Girl Is Mine", "duration": "3:42"},
                    {"title": "Thriller", "duration": "5:57"},
                    {"title": "Beat It", "duration": "4:18"},
                    {"title": "Billie Jean", "duration": "4:54"},
                    {"title": "Human Nature", "duration": "4:06"},
                    {"title": "P.Y.T. (Pretty Young Thing)", "duration": "3:59"},
                    {"title": "The Lady in My Life", "duration": "5:00"}
                ]
            },
            {
                "title": "Rumours",
                "artist": "Fleetwood Mac",
                "year": "1977",
                "genre": "Rock",
                "label": "Warner Bros.",
                "tracks": [
                    {"title": "Second Hand News", "duration": "2:54"},
                    {"title": "Dreams", "duration": "4:14"},
                    {"title": "Never Going Back Again", "duration": "2:02"},
                    {"title": "Don't Stop", "duration": "3:13"},
                    {"title": "Go Your Own Way", "duration": "3:38"},
                    {"title": "Songbird", "duration": "3:20"},
                    {"title": "The Chain", "duration": "4:30"},
                    {"title": "You Make Loving Fun", "duration": "3:31"},
                    {"title": "I Don't Want to Know", "duration": "3:15"},
                    {"title": "Oh Daddy", "duration": "3:55"}
                ]
            },
            {
                "title": "The Wall",
                "artist": "Pink Floyd",
                "year": "1979",
                "genre": "Progressive Rock",
                "label": "Harvest",
                "tracks": [
                    {"title": "In the Flesh?", "duration": "3:16"},
                    {"title": "The Thin Ice", "duration": "2:27"},
                    {"title": "Another Brick in the Wall (Part 1)", "duration": "3:11"},
                    {"title": "The Happiest Days of Our Lives", "duration": "1:46"},
                    {"title": "Another Brick in the Wall (Part 2)", "duration": "3:59"},
                    {"title": "Mother", "duration": "5:32"},
                    {"title": "Goodbye Blue Sky", "duration": "2:45"},
                    {"title": "Empty Spaces", "duration": "2:10"}
                ]
            }
        ]
        
        for album_data in sample_albums:
            album = AlbumMetadata.from_dict(album_data)
            album.confidence = 1.0
            self.add_to_database(album)
        
        print(f"已添加 {len(sample_albums)} 张示例专辑到数据库")
    
    def get_database_stats(self) -> Dict:
        return {
            "total_albums": len(self._local_database),
            "total_tracks": sum(len(album.tracks) for album in self._local_database.values()),
            "genres": list(set(album.genre for album in self._local_database.values() if album.genre)),
            "years": sorted(list(set(album.year for album in self._local_database.values() if album.year)))
        }
