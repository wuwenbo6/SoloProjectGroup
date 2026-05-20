from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List
import cv2
import numpy as np
import base64
import threading
import time
from datetime import datetime
import os
import logging
import queue
import asyncio

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter()


class ScanConfig(BaseModel):
    resolution: int = 2400
    film_format: str = "135"
    frame_count: int = 36
    auto_exposure: bool = True
    exposure_time: float = 0.1
    batch_mode: bool = False
    profile_id: Optional[int] = None
    brightness: float = 0.0
    contrast: float = 1.0
    saturation: float = 1.0
    color_temperature: int = 5500
    sharpness: float = 1.0
    noise_reduction: int = 50
    scratch_removal: bool = True
    fade_correction: bool = True
    performance_mode: str = "balanced"
    preview_quality: int = 75
    frame_skip: int = 0
    low_power_mode: bool = False


class ScanStatus(BaseModel):
    status: str
    current_frame: int
    total_frames: int
    progress: float
    current_image: Optional[str] = None


class ScanManager:
    def __init__(self):
        self.is_scanning = False
        self.current_frame = 0
        self.total_frames = 0
        self.config = None
        self.active_connections: List[WebSocket] = []
        self.capture_device = None
        self.scan_thread = None
        self.stop_event = threading.Event()
        self.output_dir = os.path.join(os.path.dirname(__file__), "..", "scans")
        os.makedirs(self.output_dir, exist_ok=True)
        self.error_count = 0
        self.max_errors = 10
        self.message_queue = queue.Queue()
        self.frame_skip_counter = 0
        self.last_processed_frame = None
        self.processed_frames_cache = []
        self.max_cache_size = 5
        self._color_correction_cache = {}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_status(self, status_dict):
        for conn in self.active_connections:
            try:
                await conn.send_json(status_dict)
            except Exception as e:
                logger.warning(f"Broadcast error: {e}")

    def init_capture_device(self):
        try:
            if self.capture_device is not None:
                self.capture_device.release()
            
            self.capture_device = cv2.VideoCapture(0)
            if not self.capture_device.isOpened():
                logger.error("Failed to open capture device")
                self.capture_device = None
                return False
            
            if self.config:
                resolution = self.config.get('resolution', 2400)
                width = 1920 if resolution <= 1200 else 3840
                height = 1080 if resolution <= 1200 else 2160
                self.capture_device.set(cv2.CAP_PROP_FRAME_WIDTH, width)
                self.capture_device.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
            
            self.capture_device.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.75 if self.config and self.config.get('auto_exposure', True) else 0.25)
            self.capture_device.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            
            for _ in range(3):
                ret, _ = self.capture_device.read()
                if ret:
                    break
                time.sleep(0.1)
            
            return True
        except Exception as e:
            logger.error(f"Capture device init error: {e}")
            self.capture_device = None
            return False

    def capture_frame(self):
        try:
            if self.capture_device is None:
                if not self.init_capture_device():
                    return None
            
            if not self.capture_device.isOpened():
                self.capture_device = None
                return None
            
            for _ in range(3):
                ret, frame = self.capture_device.read()
                if ret and frame is not None:
                    return frame
                time.sleep(0.05)
            
            logger.warning("Frame capture failed after retries")
            return None
        except Exception as e:
            logger.error(f"Capture error: {e}")
            return None

    def apply_color_correction(self, image, temperature):
        try:
            cache_key = f"temp_{temperature}"
            if cache_key in self._color_correction_cache:
                rgb_factors = self._color_correction_cache[cache_key]
            else:
                kelvin = temperature / 100
                if kelvin <= 66:
                    red = 255
                    green = 99.4708025861 * np.log(kelvin) - 161.1195681661
                    blue = 0 if kelvin <= 19 else 138.5177312231 * np.log(kelvin - 10) - 305.0447927307
                else:
                    red = 329.698727446 * ((kelvin - 60) ** -0.1332047592)
                    green = 288.1221695283 * ((kelvin - 60) ** -0.0755148492)
                    blue = 255
                
                rgb_factors = (
                    np.clip(red, 0, 255) / 255,
                    np.clip(green, 0, 255) / 255,
                    np.clip(blue, 0, 255) / 255
                )
                
                if len(self._color_correction_cache) > 20:
                    self._color_correction_cache.clear()
                self._color_correction_cache[cache_key] = rgb_factors
            
            result = image.astype(np.float32)
            result[:, :, 2] *= rgb_factors[0]
            result[:, :, 1] *= rgb_factors[1]
            result[:, :, 0] *= rgb_factors[2]
            
            return np.clip(result, 0, 255).astype(np.uint8)
        except Exception as e:
            logger.error(f"Color correction error: {e}")
            return image

    def apply_noise_reduction(self, image, strength):
        try:
            if strength <= 0:
                return image
            h = strength / 10
            return cv2.fastNlMeansDenoisingColored(image, None, h, h, 7, 21)
        except Exception as e:
            logger.error(f"Noise reduction error: {e}")
            return image

    def apply_sharpen(self, image, amount):
        try:
            if amount <= 0:
                return image
            kernel = np.array([
                [-1, -1, -1],
                [-1,  9, -1],
                [-1, -1, -1]
            ]) * amount / 2
            result = cv2.filter2D(image, -1, kernel)
            return np.clip(result, 0, 255).astype(np.uint8)
        except Exception as e:
            logger.error(f"Sharpen error: {e}")
            return image

    def apply_film_params(self, image, params=None, for_preview=False):
        if params is None or image is None:
            return image
        
        try:
            perf_mode = params.get('performance_mode', 'balanced')
            
            if for_preview or perf_mode == 'fast':
                scale = 0.5 if perf_mode == 'fast' else 0.75
                if scale < 1.0:
                    h, w = image.shape[:2]
                    small_img = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_LINEAR)
                else:
                    small_img = image
            else:
                small_img = image
            
            result = small_img.astype(np.float32)
            
            brightness = params.get('brightness', 0)
            contrast = params.get('contrast', 1.0)
            if brightness != 0 or contrast != 1.0:
                if brightness != 0:
                    result = cv2.add(result, np.full_like(result, brightness))
                if contrast != 1.0:
                    result = result * contrast
                result = np.clip(result, 0, 255).astype(np.uint8)
            else:
                result = result.astype(np.uint8)
            
            saturation = params.get('saturation', 1.0)
            if saturation != 1.0:
                hsv = cv2.cvtColor(result, cv2.COLOR_BGR2HSV).astype(np.float32)
                hsv[:, :, 1] = np.clip(hsv[:, :, 1] * saturation, 0, 255)
                result = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
            
            color_temp = params.get('color_temperature', 5500)
            if color_temp != 5500:
                result = self.apply_color_correction(result, color_temp)
            
            if perf_mode != 'fast':
                sharpness = params.get('sharpness', 1.0)
                if sharpness != 1.0:
                    result = self.apply_sharpen(result, sharpness)
                
                noise_red = params.get('noise_reduction', 0)
                if noise_red > 0:
                    strength = noise_red if perf_mode == 'high_quality' else max(0, noise_red - 20)
                    result = self.apply_noise_reduction(result, strength)
            
            if for_preview and perf_mode == 'fast':
                h, w = image.shape[:2]
                result = cv2.resize(result, (w, h), interpolation=cv2.INTER_LINEAR)
            
            return result
        except Exception as e:
            logger.error(f"Apply params error: {e}")
            return image

    def save_scan(self, image, frame_num):
        try:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"scan_{timestamp}_frame_{frame_num:03d}.tiff"
            filepath = os.path.join(self.output_dir, filename)
            
            success = cv2.imwrite(filepath, image, [
                cv2.IMWRITE_TIFF_COMPRESSION, 1,
                cv2.IMWRITE_TIFF_XDPI, 300,
                cv2.IMWRITE_TIFF_YDPI, 300
            ])
            
            if not success:
                raise IOError("Failed to write TIFF file")
            
            if not os.path.exists(filepath) or os.path.getsize(filepath) < 1024:
                raise IOError("File corrupted or too small")
            
            return filepath, filename
        except Exception as e:
            logger.error(f"Save scan error: {e}")
            raise

    def scanning_worker(self):
        logger.info("Starting scan worker")
        self.error_count = 0
        self.frame_skip_counter = 0
        
        params = self.config.copy() if self.config else {}
        frame_skip = params.get('frame_skip', 0)
        low_power = params.get('low_power_mode', False)
        perf_mode = params.get('performance_mode', 'balanced')
        preview_quality = params.get('preview_quality', 75)
        
        base_sleep = 0.1 if perf_mode == 'fast' else 0.3
        if low_power:
            base_sleep *= 1.5
        
        try:
            while not self.stop_event.is_set() and self.current_frame < self.total_frames:
                if self.error_count >= self.max_errors:
                    logger.error("Too many errors, stopping scan")
                    break
                
                if frame_skip > 0:
                    self.frame_skip_counter += 1
                    if self.frame_skip_counter <= frame_skip:
                        _ = self.capture_frame()
                        time.sleep(base_sleep * 0.5)
                        continue
                    self.frame_skip_counter = 0
                
                frame = self.capture_frame()
                if frame is None:
                    self.error_count += 1
                    time.sleep(base_sleep)
                    continue
                
                try:
                    processed = self.apply_film_params(frame, params)
                    
                    try:
                        filepath, filename = self.save_scan(processed, self.current_frame)
                    except Exception as e:
                        logger.error(f"Save error for frame {self.current_frame}: {e}")
                        self.error_count += 1
                        continue
                    
                    if len(self.active_connections) > 0:
                        try:
                            preview_h, preview_w = processed.shape[:2]
                            if perf_mode == 'fast' and preview_w > 640:
                                scale = 640 / preview_w
                                preview = cv2.resize(processed, (640, int(preview_h * scale)), interpolation=cv2.INTER_NEAREST)
                            else:
                                preview = processed
                            
                            _, buffer = cv2.imencode('.jpg', preview, [cv2.IMWRITE_JPEG_QUALITY, preview_quality])
                            img_base64 = base64.b64encode(buffer).decode()
                            
                            status = {
                                "status": "scanning",
                                "current_frame": self.current_frame,
                                "total_frames": self.total_frames,
                                "progress": ((self.current_frame + 1) / self.total_frames * 100),
                                "current_image": img_base64,
                                "saved_path": filepath
                            }
                            
                            self.message_queue.put(status)
                        except Exception as e:
                            logger.error(f"Encode error: {e}")
                    
                    self.current_frame += 1
                    self.error_count = 0
                    
                except Exception as e:
                    logger.error(f"Processing error: {e}")
                    self.error_count += 1
                
                if not self.stop_event.is_set():
                    time.sleep(base_sleep)
        
        except Exception as e:
            logger.error(f"Scan worker fatal error: {e}")
        finally:
            self.is_scanning = False
            self._color_correction_cache.clear()
            logger.info("Scan worker finished")


scan_manager = ScanManager()


async def broadcast_worker():
    while True:
        try:
            while not scan_manager.message_queue.empty():
                status = scan_manager.message_queue.get()
                await scan_manager.broadcast_status(status)
            await asyncio.sleep(0.1)
        except Exception as e:
            logger.error(f"Broadcast worker error: {e}")
            await asyncio.sleep(1)


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await scan_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "get_preview":
                frame = scan_manager.capture_frame()
                if frame is not None:
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    img_base64 = base64.b64encode(buffer).decode()
                    await websocket.send_json({"preview": img_base64})
                else:
                    await websocket.send_json({"error": "无法获取预览画面"})
    except WebSocketDisconnect:
        await scan_manager.disconnect(websocket)


@router.post("/start")
async def start_scan(config: ScanConfig):
    if scan_manager.is_scanning:
        raise HTTPException(status_code=400, detail="扫描正在进行中")
    
    scan_manager.config = config.dict()
    scan_manager.current_frame = 0
    scan_manager.total_frames = config.frame_count
    scan_manager.stop_event.clear()
    scan_manager.is_scanning = True
    scan_manager.error_count = 0
    
    scan_manager.init_capture_device()
    
    scan_manager.scan_thread = threading.Thread(target=scan_manager.scanning_worker)
    scan_manager.scan_thread.daemon = True
    scan_manager.scan_thread.start()
    
    return {"status": "started", "total_frames": config.frame_count}


@router.post("/stop")
async def stop_scan():
    scan_manager.stop_event.set()
    scan_manager.is_scanning = False
    
    if scan_manager.scan_thread and scan_manager.scan_thread.is_alive():
        scan_manager.scan_thread.join(timeout=3.0)
    
    if scan_manager.capture_device:
        scan_manager.capture_device.release()
        scan_manager.capture_device = None
    
    return {"status": "stopped", "frames_completed": scan_manager.current_frame}


@router.get("/status")
async def get_scan_status():
    return {
        "is_scanning": scan_manager.is_scanning,
        "current_frame": scan_manager.current_frame,
        "total_frames": scan_manager.total_frames,
        "progress": (scan_manager.current_frame / scan_manager.total_frames * 100) if scan_manager.total_frames > 0 else 0,
        "error_count": scan_manager.error_count
    }


@router.post("/capture-single")
async def capture_single(params: Optional[dict] = None):
    frame = scan_manager.capture_frame()
    if frame is None:
        raise HTTPException(status_code=500, detail="无法捕获图像")
    
    if params:
        frame = scan_manager.apply_film_params(frame, params)
    
    filepath, filename = scan_manager.save_scan(frame, 0)
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    img_base64 = base64.b64encode(buffer).decode()
    
    return {
        "filename": filename,
        "filepath": filepath,
        "image": img_base64
    }


@router.get("/recent-scans")
async def get_recent_scans(limit: int = 10):
    scans = []
    try:
        if os.path.exists(scan_manager.output_dir):
            files = sorted(os.listdir(scan_manager.output_dir), reverse=True)
            for f in files[:limit]:
                if f.endswith(('.tiff', '.tif', '.jpg', '.png')):
                    filepath = os.path.join(scan_manager.output_dir, f)
                    if os.path.exists(filepath):
                        stat = os.stat(filepath)
                        scans.append({
                            "filename": f,
                            "filepath": filepath,
                            "size": stat.st_size,
                            "created": stat.st_ctime
                        })
    except Exception as e:
        logger.error(f"Error getting recent scans: {e}")
    return {"scans": scans}
