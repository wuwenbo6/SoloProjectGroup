import os
import cv2
import numpy as np
import time
import threading
import signal
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Dict, Callable, Any
from enum import Enum
from datetime import datetime
import json
import hashlib
from pathlib import Path


class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"
    CANCELLED = "cancelled"


class ErrorCode(Enum):
    NONE = 0
    FILE_NOT_FOUND = 1
    FILE_CORRUPTED = 2
    READ_ERROR = 3
    WRITE_ERROR = 4
    TIMEOUT = 5
    MEMORY_ERROR = 6
    PROCESSING_ERROR = 7
    HARDWARE_ERROR = 8
    UNKNOWN = 99


@dataclass
class TranscriptionTask:
    task_id: str
    input_path: str
    output_path: str
    params: Dict[str, Any] = field(default_factory=dict)
    status: TaskStatus = TaskStatus.PENDING
    error_code: ErrorCode = ErrorCode.NONE
    error_message: str = ""
    progress: float = 0.0
    current_frame: int = 0
    total_frames: int = 0
    retry_count: int = 0
    max_retries: int = 3
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    processing_speed: float = 0.0
    file_size: int = 0
    checksum: str = ""


@dataclass
class ProcessingOptions:
    enable_color_correction: bool = True
    enable_scratch_removal: bool = True
    enable_audio_denoise: bool = True
    output_format: str = "mp4"
    output_resolution: tuple = (1920, 1080)
    fps: float = 24.0
    codec: str = "libx264"
    crf: int = 23
    timeout_per_frame: float = 5.0
    enable_preview: bool = False
    save_checkpoints: bool = True
    checkpoint_interval: int = 1000
    validate_output: bool = True


class ProcessMonitor:
    def __init__(self, timeout_seconds: float = 300.0):
        self.timeout_seconds = timeout_seconds
        self.last_activity_time = time.time()
        self.current_task: Optional[TranscriptionTask] = None
        self._monitor_thread: Optional[threading.Thread] = None
        self._running = False
        self._timeout_callback: Optional[Callable] = None
        self.logger = logging.getLogger("ProcessMonitor")

    def start(self, timeout_callback: Callable):
        self._timeout_callback = timeout_callback
        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def stop(self):
        self._running = False
        if self._monitor_thread:
            self._monitor_thread.join(timeout=5.0)

    def update_activity(self, task: Optional[TranscriptionTask] = None):
        self.last_activity_time = time.time()
        if task:
            self.current_task = task

    def _monitor_loop(self):
        while self._running:
            try:
                elapsed = time.time() - self.last_activity_time
                if elapsed > self.timeout_seconds and self.current_task:
                    self.logger.warning(
                        f"Process timeout detected! No activity for {elapsed:.1f}s. "
                        f"Current task: {self.current_task.task_id}"
                    )
                    if self._timeout_callback:
                        self._timeout_callback(self.current_task)

                time.sleep(1.0)
            except Exception as e:
                self.logger.error(f"Monitor error: {e}")


class BatchTranscriptionProcessor:
    def __init__(self, output_dir: str = "./output"):
        self.logger = logging.getLogger("BatchProcessor")
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.tasks: List[TranscriptionTask] = []
        self._current_task_index: int = -1
        self._running = False
        self._paused = False
        self._cancelled = False
        self._processing_lock = threading.Lock()

        self.monitor = ProcessMonitor(timeout_seconds=300.0)
        self.monitor.start(self._handle_timeout)

        self.progress_callback: Optional[Callable[[TranscriptionTask], None]] = None
        self.status_callback: Optional[Callable[[str, str], None]] = None

        self._init_signal_handlers()

    def _init_signal_handlers(self):
        try:
            signal.signal(signal.SIGINT, self._handle_signal)
            signal.signal(signal.SIGTERM, self._handle_signal)
        except:
            pass

    def _handle_signal(self, signum, frame):
        self.logger.warning(f"Received signal {signum}, stopping gracefully...")
        self.cancel_all()

    def _handle_timeout(self, task: TranscriptionTask):
        self.logger.error(f"Task {task.task_id} timed out, marking for retry")
        task.status = TaskStatus.RETRYING
        task.error_code = ErrorCode.TIMEOUT
        task.error_message = f"Processing timed out after {self.monitor.timeout_seconds}s"

    def add_task(self, input_path: str, output_path: Optional[str] = None,
                 params: Optional[Dict] = None) -> str:
        task_id = self._generate_task_id(input_path)

        if not output_path:
            output_filename = f"{Path(input_path).stem}_restored.mp4"
            output_path = str(self.output_dir / output_filename)

        task = TranscriptionTask(
            task_id=task_id,
            input_path=input_path,
            output_path=output_path,
            params=params or {}
        )

        self.tasks.append(task)
        self.logger.info(f"Added task {task_id}: {input_path} -> {output_path}")
        return task_id

    def add_tasks_from_directory(self, directory: str, extensions: tuple = (".mp4", ".avi", ".mov", ".mkv")) -> List[str]:
        task_ids = []
        dir_path = Path(directory)

        if not dir_path.exists():
            self.logger.error(f"Directory not found: {directory}")
            return task_ids

        for file_path in dir_path.rglob("*"):
            if file_path.suffix.lower() in extensions:
                task_id = self.add_task(str(file_path))
                task_ids.append(task_id)

        self.logger.info(f"Added {len(task_ids)} tasks from directory")
        return task_ids

    def _generate_task_id(self, input_path: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path_hash = hashlib.md5(input_path.encode()).hexdigest()[:8]
        return f"task_{timestamp}_{path_hash}"

    def process_all(self, options: Optional[ProcessingOptions] = None) -> Dict:
        options = options or ProcessingOptions()
        self._running = True
        self._cancelled = False

        results = {
            "total": len(self.tasks),
            "completed": 0,
            "failed": 0,
            "retried": 0,
            "tasks": []
        }

        for i, task in enumerate(self.tasks):
            if self._cancelled:
                break

            self._current_task_index = i
            task_result = self._process_single_task(task, options)
            results["tasks"].append(task_result)

            if task.status == TaskStatus.COMPLETED:
                results["completed"] += 1
            elif task.status == TaskStatus.FAILED:
                results["failed"] += 1
            results["retried"] += task.retry_count

        self._running = False
        return results

    def _process_single_task(self, task: TranscriptionTask, options: ProcessingOptions) -> Dict:
        task.status = TaskStatus.RUNNING
        task.start_time = datetime.now()
        self.monitor.update_activity(task)

        while task.retry_count <= task.max_retries:
            try:
                self._process_with_recovery(task, options)

                if task.status == TaskStatus.RUNNING:
                    task.status = TaskStatus.COMPLETED
                    task.end_time = datetime.now()
                    self._update_status(task, "completed successfully")
                    break

            except Exception as e:
                task.retry_count += 1
                task.error_message = str(e)
                self.logger.error(f"Task {task.task_id} error (attempt {task.retry_count}): {e}")

                if task.retry_count <= task.max_retries:
                    task.status = TaskStatus.RETRYING
                    self._update_status(task, f"retrying ({task.retry_count}/{task.max_retries})")
                    time.sleep(2.0 ** task.retry_count)
                else:
                    task.status = TaskStatus.FAILED
                    task.error_code = ErrorCode.PROCESSING_ERROR
                    task.end_time = datetime.now()
                    self._update_status(task, f"failed after {task.max_retries} retries")
                    break

        return {
            "task_id": task.task_id,
            "status": task.status.value,
            "error": task.error_message if task.status == TaskStatus.FAILED else None
        }

    def _process_with_recovery(self, task: TranscriptionTask, options: ProcessingOptions):
        self._validate_input_file(task)

        cap = self._open_video_capture(task)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        task.total_frames = total_frames
        self.logger.info(f"Processing {total_frames} frames for task {task.task_id}")

        temp_output = self._get_temp_output_path(task)
        writer = self._create_video_writer(temp_output, cap, options)

        try:
            start_frame = task.current_frame
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

            for frame_idx in range(start_frame, total_frames):
                if self._cancelled:
                    task.status = TaskStatus.CANCELLED
                    break

                if self._paused:
                    while self._paused and not self._cancelled:
                        time.sleep(0.1)
                    if self._cancelled:
                        break

                ret, frame = cap.read()
                if not ret or frame is None:
                    self.logger.warning(f"Failed to read frame {frame_idx}, using black frame")
                    frame = self._create_blank_frame(cap)

                self.monitor.update_activity(task)

                processed_frame = self._process_frame(frame, options)

                writer.write(processed_frame)

                task.current_frame = frame_idx + 1
                task.progress = (frame_idx + 1) / total_frames * 100
                task.processing_speed = self._calculate_speed(task)

                if options.save_checkpoints and frame_idx % options.checkpoint_interval == 0:
                    self._save_checkpoint(task)

                if self.progress_callback:
                    self.progress_callback(task)

        finally:
            cap.release()
            writer.release()

        if task.status != TaskStatus.CANCELLED:
            self._finalize_output(task, temp_output, options)

    def _validate_input_file(self, task: TranscriptionTask):
        input_path = Path(task.input_path)

        if not input_path.exists():
            task.error_code = ErrorCode.FILE_NOT_FOUND
            raise FileNotFoundError(f"Input file not found: {task.input_path}")

        if input_path.stat().st_size == 0:
            task.error_code = ErrorCode.FILE_CORRUPTED
            raise ValueError(f"Input file is empty: {task.input_path}")

        task.file_size = input_path.stat().st_size

    def _open_video_capture(self, task: TranscriptionTask) -> cv2.VideoCapture:
        cap = cv2.VideoCapture(task.input_path)
        if not cap.isOpened():
            task.error_code = ErrorCode.FILE_CORRUPTED
            raise RuntimeError(f"Failed to open video: {task.input_path}")
        return cap

    def _create_video_writer(self, output_path: str, cap: cv2.VideoCapture,
                             options: ProcessingOptions) -> cv2.VideoWriter:
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS) or options.fps

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')

        output_dir = Path(output_path).parent
        output_dir.mkdir(parents=True, exist_ok=True)

        writer = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        if not writer.isOpened():
            task.error_code = ErrorCode.WRITE_ERROR
            raise RuntimeError(f"Failed to create video writer: {output_path}")
        return writer

    def _get_temp_output_path(self, task: TranscriptionTask) -> str:
        temp_path = Path(task.output_path).parent / f".temp_{task.task_id}_{Path(task.output_path).name}"
        return str(temp_path)

    def _create_blank_frame(self, cap: cv2.VideoCapture) -> np.ndarray:
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        return np.zeros((height, width, 3), dtype=np.uint8)

    def _process_frame(self, frame: np.ndarray, options: ProcessingOptions) -> np.ndarray:
        result = frame.copy()

        if options.enable_color_correction:
            result = self._apply_color_correction(result)

        if options.enable_scratch_removal:
            result = self._apply_scratch_removal(result)

        return result

    def _apply_color_correction(self, frame: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_eq = clahe.apply(l)

        lab_eq = cv2.merge((l_eq, a, b))
        return cv2.cvtColor(lab_eq, cv2.COLOR_LAB2BGR)

    def _apply_scratch_removal(self, frame: np.ndarray) -> np.ndarray:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        blurred = cv2.medianBlur(gray, 3)
        diff = cv2.absdiff(gray, blurred)

        _, mask = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        mask = cv2.dilate(mask, kernel)

        if np.count_nonzero(mask) > 0:
            frame = cv2.inpaint(frame, mask, 3, cv2.INPAINT_TELEA)

        return frame

    def _calculate_speed(self, task: TranscriptionTask) -> float:
        if task.start_time:
            elapsed = (datetime.now() - task.start_time).total_seconds()
            if elapsed > 0:
                return task.current_frame / elapsed
        return 0.0

    def _save_checkpoint(self, task: TranscriptionTask):
        checkpoint_path = Path(task.output_path).parent / f"{task.task_id}_checkpoint.json"
        checkpoint_data = {
            "task_id": task.task_id,
            "current_frame": task.current_frame,
            "progress": task.progress,
            "timestamp": datetime.now().isoformat()
        }
        try:
            with open(checkpoint_path, 'w') as f:
                json.dump(checkpoint_data, f)
        except Exception as e:
            self.logger.warning(f"Failed to save checkpoint: {e}")

    def _finalize_output(self, task: TranscriptionTask, temp_output: str, options: ProcessingOptions):
        temp_path = Path(temp_output)

        if not temp_path.exists() or temp_path.stat().st_size == 0:
            task.error_code = ErrorCode.WRITE_ERROR
            raise RuntimeError("Output file is empty or missing")

        if options.validate_output:
            if not self._validate_output_file(temp_output):
                task.error_code = ErrorCode.FILE_CORRUPTED
                raise RuntimeError("Output file validation failed")

        final_output = Path(task.output_path)
        final_output.parent.mkdir(parents=True, exist_ok=True)

        if final_output.exists():
            backup_path = final_output.with_suffix(f".bak_{int(time.time())}")
            final_output.rename(backup_path)

        temp_path.rename(final_output)

        task.checksum = self._calculate_checksum(final_output)
        self.logger.info(f"Task {task.task_id} completed: {final_output}")

    def _validate_output_file(self, file_path: str) -> bool:
        try:
            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                return False

            frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            cap.release()

            return frame_count > 0
        except Exception as e:
            self.logger.error(f"Output validation error: {e}")
            return False

    def _calculate_checksum(self, file_path: Path) -> str:
        try:
            with open(file_path, 'rb') as f:
                return hashlib.md5(f.read()).hexdigest()
        except:
            return ""

    def _update_status(self, task: TranscriptionTask, message: str):
        self.logger.info(f"Task {task.task_id}: {message}")
        if self.status_callback:
            self.status_callback(task.task_id, message)

    def pause(self):
        self._paused = True
        self.logger.info("Processing paused")

    def resume(self):
        self._paused = False
        self.logger.info("Processing resumed")

    def cancel_all(self):
        self._cancelled = True
        self._paused = False
        self.logger.info("Processing cancelled")

    def get_task_status(self, task_id: str) -> Optional[TranscriptionTask]:
        for task in self.tasks:
            if task.task_id == task_id:
                return task
        return None

    def get_overall_progress(self) -> Dict:
        total = len(self.tasks)
        completed = sum(1 for t in self.tasks if t.status == TaskStatus.COMPLETED)
        running = sum(1 for t in self.tasks if t.status == TaskStatus.RUNNING)
        failed = sum(1 for t in self.tasks if t.status == TaskStatus.FAILED)

        avg_progress = sum(t.progress for t in self.tasks) / total if total > 0 else 0

        return {
            "total_tasks": total,
            "completed": completed,
            "running": running,
            "failed": failed,
            "pending": total - completed - running - failed,
            "overall_progress": avg_progress,
            "is_paused": self._paused,
            "is_running": self._running
        }

    def save_report(self, output_path: str):
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": self.get_overall_progress(),
            "tasks": [
                {
                    "task_id": t.task_id,
                    "input_path": t.input_path,
                    "output_path": t.output_path,
                    "status": t.status.value,
                    "progress": t.progress,
                    "error": t.error_message,
                    "retry_count": t.retry_count,
                    "start_time": t.start_time.isoformat() if t.start_time else None,
                    "end_time": t.end_time.isoformat() if t.end_time else None,
                    "checksum": t.checksum
                }
                for t in self.tasks
            ]
        }

        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2)

        self.logger.info(f"Report saved to {output_path}")

    def cleanup(self):
        self.monitor.stop()

        for task in self.tasks:
            temp_files = list(Path(task.output_path).parent.glob(f".temp_{task.task_id}_*"))
            for temp_file in temp_files:
                try:
                    temp_file.unlink()
                except:
                    pass

            checkpoint_files = list(Path(task.output_path).parent.glob(f"{task.task_id}_checkpoint.json"))
            for cp_file in checkpoint_files:
                try:
                    cp_file.unlink()
                except:
                    pass
