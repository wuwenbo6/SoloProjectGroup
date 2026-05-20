import cv2
import numpy as np
import json
from dataclasses import dataclass
from typing import Optional, List, Tuple, Callable, Dict
from pathlib import Path
import logging
from enum import Enum
import threading
import time


class ExportFormat(Enum):
    MP4 = "mp4"
    AVI = "avi"
    MOV = "mov"
    MKV = "mkv"
    GIF = "gif"
    WEBM = "webm"


@dataclass
class VideoSegment:
    segment_id: str
    start_frame: int
    end_frame: int
    start_time: float = 0.0
    end_time: float = 0.0
    name: str = ""
    description: str = ""
    tags: List[str] = None


@dataclass
class ExportOptions:
    output_format: ExportFormat = ExportFormat.MP4
    codec: str = "libx264"
    fps: Optional[float] = None
    resolution: Optional[Tuple[int, int]] = None
    bitrate: str = "5M"
    quality: int = 23
    apply_color_correction: bool = False
    apply_scratch_removal: bool = False
    keep_audio: bool = True
    watermark_text: str = ""
    watermark_position: Tuple[int, int] = (20, 20)


class VideoEditor:
    def __init__(self):
        self.logger = logging.getLogger("VideoEditor")
        self._current_video: Optional[str] = None
        self._cap: Optional[cv2.VideoCapture] = None
        self._video_info: Optional[Dict] = None
        self.segments: List[VideoSegment] = []
        self._preview_frame: Optional[np.ndarray] = None
        self._progress_callback: Optional[Callable[[float, str], None]] = None
        self._lock = threading.Lock()

    def set_progress_callback(self, callback: Callable[[float, str], None]):
        self._progress_callback = callback

    def _notify_progress(self, progress: float, message: str):
        if self._progress_callback:
            try:
                self._progress_callback(progress, message)
            except Exception as e:
                self.logger.error(f"Progress callback error: {e}")

    def load_video(self, video_path: str) -> bool:
        with self._lock:
            try:
                if self._cap:
                    self._cap.release()

                self._cap = cv2.VideoCapture(video_path)
                if not self._cap.isOpened():
                    self.logger.error(f"Failed to open video: {video_path}")
                    return False

                fps = self._cap.get(cv2.CAP_PROP_FPS)
                frame_count = int(self._cap.get(cv2.CAP_PROP_FRAME_COUNT))
                width = int(self._cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(self._cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                duration = frame_count / fps if fps > 0 else 0

                self._video_info = {
                    "path": video_path,
                    "fps": fps,
                    "frame_count": frame_count,
                    "width": width,
                    "height": height,
                    "duration": duration
                }
                self._current_video = video_path

                self.logger.info(f"Loaded video: {width}x{height}, {fps}fps, {frame_count} frames, {duration:.2f}s")
                return True

            except Exception as e:
                self.logger.error(f"Load video error: {e}")
                return False

    def get_video_info(self) -> Optional[Dict]:
        return self._video_info.copy() if self._video_info else None

    def get_frame(self, frame_number: int) -> Optional[np.ndarray]:
        if not self._cap or frame_number < 0:
            return None

        with self._lock:
            self._cap.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
            ret, frame = self._cap.read()
            return frame if ret else None

    def get_frame_by_time(self, time_seconds: float) -> Optional[np.ndarray]:
        if not self._video_info or self._video_info["fps"] <= 0:
            return None

        frame_number = int(time_seconds * self._video_info["fps"])
        return self.get_frame(frame_number)

    def add_segment(self, start_frame: int, end_frame: int,
                    name: str = "", description: str = "") -> str:
        if not self._video_info:
            return ""

        fps = self._video_info["fps"]
        segment_id = f"seg_{int(time.time())}_{len(self.segments)}"

        segment = VideoSegment(
            segment_id=segment_id,
            start_frame=start_frame,
            end_frame=end_frame,
            start_time=start_frame / fps if fps > 0 else 0,
            end_time=end_frame / fps if fps > 0 else 0,
            name=name or f"片段 {len(self.segments) + 1}",
            description=description
        )

        self.segments.append(segment)
        return segment_id

    def add_segment_by_time(self, start_time: float, end_time: float,
                            name: str = "", description: str = "") -> str:
        if not self._video_info or self._video_info["fps"] <= 0:
            return ""

        start_frame = int(start_time * self._video_info["fps"])
        end_frame = int(end_time * self._video_info["fps"])

        return self.add_segment(start_frame, end_frame, name, description)

    def remove_segment(self, segment_id: str) -> bool:
        for i, seg in enumerate(self.segments):
            if seg.segment_id == segment_id:
                del self.segments[i]
                return True
        return False

    def get_segment(self, segment_id: str) -> Optional[VideoSegment]:
        for seg in self.segments:
            if seg.segment_id == segment_id:
                return seg
        return None

    def update_segment(self, segment_id: str, **kwargs) -> bool:
        segment = self.get_segment(segment_id)
        if not segment:
            return False

        for key, value in kwargs.items():
            if hasattr(segment, key):
                setattr(segment, key, value)

        if 'start_frame' in kwargs or 'end_frame' in kwargs:
            if self._video_info and self._video_info["fps"] > 0:
                fps = self._video_info["fps"]
                segment.start_time = segment.start_frame / fps
                segment.end_time = segment.end_frame / fps

        return True

    def clear_segments(self):
        self.segments.clear()

    def export_segment(self, segment_id: str, output_path: str,
                       options: Optional[ExportOptions] = None) -> bool:
        segment = self.get_segment(segment_id)
        if not segment:
            self.logger.error(f"Segment not found: {segment_id}")
            return False

        return self._export_frames(segment.start_frame, segment.end_frame, output_path, options)

    def export_multiple_segments(self, segment_ids: List[str], output_path: str,
                                 merge: bool = True, options: Optional[ExportOptions] = None) -> bool:
        if not segment_ids:
            return False

        if merge:
            return self._export_merge_segments(segment_ids, output_path, options)
        else:
            base_path = Path(output_path)
            base_name = base_path.stem
            suffix = base_path.suffix

            success = True
            for i, seg_id in enumerate(segment_ids):
                seg_path = str(base_path.parent / f"{base_name}_{i + 1}{suffix}")
                if not self.export_segment(seg_id, seg_path, options):
                    success = False
            return success

    def _export_merge_segments(self, segment_ids: List[str], output_path: str,
                               options: Optional[ExportOptions] = None) -> bool:
        options = options or ExportOptions()

        segments = [self.get_segment(sid) for sid in segment_ids]
        segments = [s for s in segments if s is not None]

        if not segments:
            return False

        total_frames = sum(s.end_frame - s.start_frame for s in segments)
        current_frame = 0

        try:
            width = self._video_info["width"]
            height = self._video_info["height"]
            fps = options.fps or self._video_info["fps"]

            if options.resolution:
                width, height = options.resolution

            fourcc = self._get_fourcc(options.output_format)
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

            if not writer.isOpened():
                self.logger.error(f"Failed to create video writer: {output_path}")
                return False

            for seg in segments:
                self._cap.set(cv2.CAP_PROP_POS_FRAMES, seg.start_frame)

                for frame_idx in range(seg.start_frame, seg.end_frame):
                    ret, frame = self._cap.read()
                    if not ret:
                        break

                    if options.resolution:
                        frame = cv2.resize(frame, options.resolution)

                    if options.watermark_text:
                        frame = self._add_watermark(frame, options)

                    writer.write(frame)
                    current_frame += 1

                    if current_frame % 10 == 0:
                        progress = current_frame / total_frames
                        self._notify_progress(progress, f"导出中... {current_frame}/{total_frames}")

            writer.release()
            self._notify_progress(1.0, "导出完成")
            return True

        except Exception as e:
            self.logger.error(f"Merge export error: {e}")
            return False

    def _export_frames(self, start_frame: int, end_frame: int, output_path: str,
                       options: Optional[ExportOptions] = None) -> bool:
        options = options or ExportOptions()

        try:
            width = self._video_info["width"]
            height = self._video_info["height"]
            fps = options.fps or self._video_info["fps"]

            if options.resolution:
                width, height = options.resolution

            total_frames = end_frame - start_frame

            if options.output_format == ExportFormat.GIF:
                return self._export_as_gif(start_frame, end_frame, output_path, options)

            fourcc = self._get_fourcc(options.output_format)
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

            if not writer.isOpened():
                self.logger.error(f"Failed to create video writer: {output_path}")
                return False

            self._cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            for frame_idx in range(start_frame, end_frame):
                ret, frame = self._cap.read()
                if not ret:
                    break

                if options.resolution:
                    frame = cv2.resize(frame, options.resolution)

                if options.watermark_text:
                    frame = self._add_watermark(frame, options)

                writer.write(frame)

                if (frame_idx - start_frame) % 10 == 0:
                    progress = (frame_idx - start_frame) / total_frames
                    self._notify_progress(progress, f"导出中... {frame_idx - start_frame}/{total_frames}")

            writer.release()
            self._notify_progress(1.0, "导出完成")
            return True

        except Exception as e:
            self.logger.error(f"Export error: {e}")
            return False

    def _export_as_gif(self, start_frame: int, end_frame: int, output_path: str,
                       options: ExportOptions) -> bool:
        try:
            from PIL import Image

            width = self._video_info["width"]
            height = self._video_info["height"]
            fps = options.fps or self._video_info["fps"]

            max_size = 480
            scale = min(1.0, max_size / max(width, height))
            new_width = int(width * scale)
            new_height = int(height * scale)

            frames = []
            total_frames = end_frame - start_frame

            self._cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            for frame_idx in range(start_frame, end_frame):
                ret, frame = self._cap.read()
                if not ret:
                    break

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                frame_rgb = cv2.resize(frame_rgb, (new_width, new_height))
                frames.append(Image.fromarray(frame_rgb))

                if (frame_idx - start_frame) % 5 == 0:
                    progress = (frame_idx - start_frame) / total_frames
                    self._notify_progress(progress, f"生成GIF... {len(frames)}/{total_frames}")

            if frames:
                duration = 1000 / fps
                frames[0].save(
                    output_path,
                    save_all=True,
                    append_images=frames[1:],
                    duration=duration,
                    loop=0,
                    optimize=True
                )

            self._notify_progress(1.0, "GIF导出完成")
            return True

        except ImportError:
            self.logger.warning("PIL not available, using video format instead")
            options.output_format = ExportFormat.MP4
            return self._export_frames(start_frame, end_frame, output_path, options)
        except Exception as e:
            self.logger.error(f"GIF export error: {e}")
            return False

    def _get_fourcc(self, format: ExportFormat) -> int:
        codec_map = {
            ExportFormat.MP4: cv2.VideoWriter_fourcc(*'mp4v'),
            ExportFormat.AVI: cv2.VideoWriter_fourcc(*'XVID'),
            ExportFormat.MOV: cv2.VideoWriter_fourcc(*'mp4v'),
            ExportFormat.MKV: cv2.VideoWriter_fourcc(*'XVID'),
            ExportFormat.WEBM: cv2.VideoWriter_fourcc(*'VP90'),
        }
        return codec_map.get(format, cv2.VideoWriter_fourcc(*'mp4v'))

    def _add_watermark(self, frame: np.ndarray, options: ExportOptions) -> np.ndarray:
        if not options.watermark_text:
            return frame

        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.8
        thickness = 2
        color = (255, 255, 255)

        text_size = cv2.getTextSize(options.watermark_text, font, font_scale, thickness)[0]
        x, y = options.watermark_position

        cv2.putText(frame, options.watermark_text, (x, y + text_size[1]),
                   font, font_scale, (0, 0, 0), thickness + 2)
        cv2.putText(frame, options.watermark_text, (x, y + text_size[1]),
                   font, font_scale, color, thickness)

        return frame

    def export_thumbnail(self, frame_number: int, output_path: str,
                         size: Optional[Tuple[int, int]] = None) -> bool:
        frame = self.get_frame(frame_number)
        if frame is None:
            return False

        try:
            if size:
                frame = cv2.resize(frame, size)

            cv2.imwrite(output_path, frame)
            return True
        except Exception as e:
            self.logger.error(f"Thumbnail export error: {e}")
            return False

    def export_thumbnails_grid(self, frame_numbers: List[int], output_path: str,
                               cols: int = 4, thumb_size: Tuple[int, int] = (240, 180)) -> bool:
        try:
            rows = (len(frame_numbers) + cols - 1) // cols

            grid = np.zeros((rows * thumb_size[1], cols * thumb_size[0], 3), dtype=np.uint8)

            for i, frame_num in enumerate(frame_numbers):
                frame = self.get_frame(frame_num)
                if frame is not None:
                    frame = cv2.resize(frame, thumb_size)
                    row = i // cols
                    col = i % cols
                    y1 = row * thumb_size[1]
                    y2 = y1 + thumb_size[1]
                    x1 = col * thumb_size[0]
                    x2 = x1 + thumb_size[0]
                    grid[y1:y2, x1:x2] = frame

            cv2.imwrite(output_path, grid)
            return True
        except Exception as e:
            self.logger.error(f"Thumbnail grid export error: {e}")
            return False

    def concat_videos(self, video_paths: List[str], output_path: str,
                      options: Optional[ExportOptions] = None) -> bool:
        options = options or ExportOptions()

        try:
            caps = []
            for path in video_paths:
                cap = cv2.VideoCapture(path)
                if cap.isOpened():
                    caps.append(cap)

            if not caps:
                return False

            first_cap = caps[0]
            width = int(first_cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(first_cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = options.fps or first_cap.get(cv2.CAP_PROP_FPS)

            if options.resolution:
                width, height = options.resolution

            fourcc = self._get_fourcc(options.output_format)
            writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

            total_frames = sum(int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) for cap in caps)
            current_frame = 0

            for cap in caps:
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break

                    if options.resolution:
                        frame = cv2.resize(frame, options.resolution)

                    writer.write(frame)
                    current_frame += 1

                    if current_frame % 100 == 0:
                        progress = current_frame / total_frames
                        self._notify_progress(progress, f"合并中... {current_frame}/{total_frames}")

                cap.release()

            writer.release()
            self._notify_progress(1.0, "合并完成")
            return True

        except Exception as e:
            self.logger.error(f"Concat videos error: {e}")
            return False

    def trim_video(self, start_frame: int, end_frame: int, output_path: str,
                   options: Optional[ExportOptions] = None) -> bool:
        return self._export_frames(start_frame, end_frame, output_path, options)

    def trim_video_by_time(self, start_time: float, end_time: float, output_path: str,
                           options: Optional[ExportOptions] = None) -> bool:
        if not self._video_info or self._video_info["fps"] <= 0:
            return False

        start_frame = int(start_time * self._video_info["fps"])
        end_frame = int(end_time * self._video_info["fps"])

        return self.trim_video(start_frame, end_frame, output_path, options)

    def save_segments_list(self, output_path: str) -> bool:
        try:
            data = {
                "source_video": self._current_video,
                "video_info": self._video_info,
                "segments": [
                    {
                        "segment_id": s.segment_id,
                        "start_frame": s.start_frame,
                        "end_frame": s.end_frame,
                        "start_time": s.start_time,
                        "end_time": s.end_time,
                        "name": s.name,
                        "description": s.description,
                        "tags": s.tags or []
                    }
                    for s in self.segments
                ]
            }

            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)

            return True
        except Exception as e:
            self.logger.error(f"Save segments error: {e}")
            return False

    def load_segments_list(self, input_path: str) -> bool:
        try:
            with open(input_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if "source_video" in data:
                self.load_video(data["source_video"])

            self.segments.clear()
            for seg_data in data.get("segments", []):
                segment = VideoSegment(
                    segment_id=seg_data["segment_id"],
                    start_frame=seg_data["start_frame"],
                    end_frame=seg_data["end_frame"],
                    start_time=seg_data.get("start_time", 0),
                    end_time=seg_data.get("end_time", 0),
                    name=seg_data.get("name", ""),
                    description=seg_data.get("description", ""),
                    tags=seg_data.get("tags", [])
                )
                self.segments.append(segment)

            return True
        except Exception as e:
            self.logger.error(f"Load segments error: {e}")
            return False

    def close(self):
        with self._lock:
            if self._cap:
                self._cap.release()
                self._cap = None
            self._current_video = None
            self._video_info = None
            self.segments.clear()

    def __del__(self):
        self.close()
