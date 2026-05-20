import os
import subprocess
import uuid
import json
from pathlib import Path
from typing import Dict, Tuple, Optional
import shutil


class AudioVideoAligner:
    def __init__(self, upload_dir: str = '../uploads', output_dir: str = '../results/aligned'):
        self.upload_dir = Path(upload_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _check_ffmpeg_available(self) -> bool:
        try:
            result = subprocess.run(['ffmpeg', '-version'], capture_output=True, text=True)
            return result.returncode == 0
        except FileNotFoundError:
            return False

    def _get_media_duration(self, file_path: str) -> float:
        cmd = [
            'ffprobe', '-v', 'quiet', '-print_format', 'json',
            '-show_format', '-show_streams', file_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return float(data['format']['duration'])
        return 0.0

    def _apply_audio_delay(self, video_path: str, audio_path: str,
                           offset_seconds: float, output_path: str) -> Tuple[bool, str]:
        try:
            if offset_seconds > 0:
                atempo_filter = f"adelay={int(offset_seconds * 1000)}:all=1"
            else:
                atempo_filter = f"adelay=0:all=1"

            audio_duration = self._get_media_duration(audio_path)
            video_duration = self._get_media_duration(video_path)

            if offset_seconds < 0:
                trim_start = abs(offset_seconds)
                atempo_filter = f"atrim=start={trim_start},adelay=0:all=1"

            cmd = [
                'ffmpeg', '-y',
                '-i', video_path,
                '-i', audio_path,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-b:a', '192k',
                '-filter:a', atempo_filter,
                '-map', '0:v:0',
                '-map', '1:a:0',
                '-shortest',
                output_path
            ]

            process = subprocess.run(cmd, capture_output=True, text=True)

            if process.returncode != 0:
                return False, f"FFmpeg error: {process.stderr[:500]}"

            if not os.path.exists(output_path):
                return False, "Output file was not created"

            return True, "Success"

        except Exception as e:
            return False, str(e)

    def _create_aligned_audio_only(self, audio_path: str, offset_seconds: float,
                                    output_path: str) -> Tuple[bool, str]:
        try:
            if offset_seconds > 0:
                filter_complex = f"[0:a]adelay={int(offset_seconds * 1000)}:all=1[a]"
            else:
                trim_start = abs(offset_seconds)
                filter_complex = f"[0:a]atrim=start={trim_start}[a]"

            cmd = [
                'ffmpeg', '-y',
                '-i', audio_path,
                '-filter_complex', filter_complex,
                '-map', '[a]',
                '-c:a', 'aac',
                '-b:a', '192k',
                output_path
            ]

            process = subprocess.run(cmd, capture_output=True, text=True)

            if process.returncode != 0:
                return False, f"FFmpeg error: {process.stderr[:500]}"

            return True, "Success"

        except Exception as e:
            return False, str(e)

    def align_media(self, video_filename: str, audio_filename: str,
                    offset_seconds: float, original_video_path: str = None,
                    original_audio_path: str = None) -> Dict:
        if not self._check_ffmpeg_available():
            return {
                'success': False,
                'error': 'FFmpeg is not installed or not available in PATH. '
                        'Please install FFmpeg to use this feature.'
            }

        try:
            if original_video_path and os.path.exists(original_video_path):
                video_path = original_video_path
            else:
                video_path = str(self.upload_dir / video_filename)

            if original_audio_path and os.path.exists(original_audio_path):
                audio_path = original_audio_path
            else:
                audio_path = str(self.upload_dir / audio_filename)

            if not os.path.exists(video_path):
                return {'success': False, 'error': f'Video file not found: {video_path}'}

            if not os.path.exists(audio_path):
                return {'success': False, 'error': f'Audio file not found: {audio_path}'}

            output_id = str(uuid.uuid4())[:8]
            video_name = Path(video_filename).stem
            output_filename = f"{video_name}_aligned_{output_id}.mp4"
            output_path = str(self.output_dir / output_filename)

            success, message = self._apply_audio_delay(video_path, audio_path, offset_seconds, output_path)

            if not success:
                return {'success': False, 'error': message}

            aligned_audio_filename = f"{video_name}_aligned_audio_{output_id}.aac"
            aligned_audio_path = str(self.output_dir / aligned_audio_filename)
            audio_success, _ = self._create_aligned_audio_only(audio_path, offset_seconds, aligned_audio_path)

            file_size = os.path.getsize(output_path)
            duration = self._get_media_duration(output_path)

            return {
                'success': True,
                'output_filename': output_filename,
                'output_path': output_path,
                'aligned_audio_filename': aligned_audio_filename if audio_success else None,
                'file_size': file_size,
                'duration': duration,
                'offset_applied': offset_seconds,
                'offset_description': self._get_offset_description(offset_seconds),
                'download_url': f'/api/download-aligned/{output_filename}'
            }

        except Exception as e:
            return {'success': False, 'error': str(e)}

    def _get_offset_description(self, offset_seconds: float) -> str:
        if abs(offset_seconds) < 0.001:
            return "无需调整，音视频已同步"

        if offset_seconds > 0:
            return f"音频延迟 {offset_seconds:.3f} 秒（{int(offset_seconds * 30)} 帧）"
        else:
            return f"音频提前 {abs(offset_seconds):.3f} 秒（{int(abs(offset_seconds) * 30)} 帧）"

    def list_aligned_files(self) -> list:
        files = []
        for file_path in self.output_dir.glob('*.mp4'):
            stat = file_path.stat()
            files.append({
                'filename': file_path.name,
                'size': stat.st_size,
                'modified': stat.st_mtime,
                'download_url': f'/api/download-aligned/{file_path.name}'
            })
        return sorted(files, key=lambda x: x['modified'], reverse=True)

    def cleanup_old_files(self, max_age_hours: int = 24):
        import time
        cutoff = time.time() - (max_age_hours * 3600)

        for file_path in self.output_dir.glob('*.mp4'):
            if file_path.stat().st_mtime < cutoff:
                file_path.unlink()

        for file_path in self.output_dir.glob('*.aac'):
            if file_path.stat().st_mtime < cutoff:
                file_path.unlink()
