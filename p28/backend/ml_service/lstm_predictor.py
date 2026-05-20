import asyncio
import numpy as np
import logging
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime
import pickle
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class PredictionResult:
    device_id: str
    timestamp: float
    horizon_minutes: int
    failure_probability: List[float]
    final_probability: float
    confidence: float
    risk_level: str
    baseline_probability: float
    impact_factors: Dict[str, str]
    recommendation: Dict[str, str]


class LSTMPredictorModel:
    def __init__(self):
        self.model_loaded = False
        self.model = None
        self.scaler = None
        self.model_size_mb = 0
        self.warmup_complete = False

    async def load_model(self, model_path: str = None) -> bool:
        if self.model_loaded:
            logger.info("Model already loaded, skipping")
            return True

        try:
            logger.info("Starting model warmup... (this may take 30-60 seconds)")
            await asyncio.sleep(0.1)

            if model_path and os.path.exists(model_path):
                with open(model_path, 'rb') as f:
                    model_data = pickle.load(f)
                    self.model = model_data.get('model')
                    self.scaler = model_data.get('scaler')
                    self.model_size_mb = model_data.get('size_mb', 1024)
            else:
                await asyncio.sleep(2)
                self.model_size_mb = 1024
                logger.info(f"Simulated {self.model_size_mb}MB LSTM model loaded")

            await self._warmup_inference()

            self.model_loaded = True
            self.warmup_complete = True
            logger.info("Model warmup complete! Ready for predictions")
            return True

        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False

    async def _warmup_inference(self):
        logger.info("Running warmup inferences...")
        warmup_data = np.random.rand(10, 20, 4)

        for i in range(3):
            await asyncio.sleep(0.5)
            logger.info(f"Warmup iteration {i + 1}/3")

        logger.info("Warmup inferences completed")

    def is_ready(self) -> bool:
        return self.model_loaded and self.warmup_complete


class PredictionService:
    def __init__(self):
        self.predictor = LSTMPredictorModel()
        self._request_queue = asyncio.Queue(maxsize=100)
        self._worker_task = None
        self._results_cache = {}
        self._cache_ttl = 300

    async def start(self):
        if self._worker_task is None:
            self._worker_task = asyncio.create_task(self._prediction_worker())
            await self.predictor.load_model()
            logger.info("Prediction service started successfully")

    async def stop(self):
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Prediction service stopped")

    async def predict_async(self, device_id: str, params: Dict,
                           history_data: List[Dict] = None) -> str:
        request_id = f"req_{device_id}_{int(datetime.now().timestamp() * 1000)}"
        request = {
            'request_id': request_id,
            'device_id': device_id,
            'params': params,
            'history_data': history_data or [],
            'timestamp': datetime.now().timestamp()
        }

        try:
            self._request_queue.put_nowait(request)
            logger.info(f"Queued prediction request {request_id} for device {device_id}")
            return request_id
        except asyncio.QueueFull:
            raise RuntimeError("Prediction queue is full, please try again later")

    async def get_result(self, request_id: str, timeout: int = 30) -> Optional[PredictionResult]:
        start = datetime.now().timestamp()

        while (datetime.now().timestamp() - start) < timeout:
            if request_id in self._results_cache:
                result = self._results_cache.pop(request_id)
                logger.info(f"Retrieved result for {request_id}")
                return result
            await asyncio.sleep(0.1)

        raise TimeoutError(f"Prediction timed out after {timeout}s")

    async def _prediction_worker(self):
        logger.info("Prediction worker started")
        while True:
            try:
                request = await self._request_queue.get()
                await self._process_prediction(request)
                self._request_queue.task_done()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Worker error: {e}")

        logger.info("Prediction worker stopped")

    async def _process_prediction(self, request: Dict):
        request_id = request['request_id']
        device_id = request['device_id']
        params = request['params']
        history_data = request['history_data']

        try:
            await asyncio.sleep(0.3)

            base_temp = np.mean([d.get('temperature', 40) for d in history_data]) if history_data else 40
            speed_multiplier = params.get('speed', 1.0)
            temp_multiplier = params.get('temperature', base_temp) / base_temp if base_temp > 0 else 1

            n_steps = 30
            time_points = np.linspace(0, 1, n_steps)

            base_risk = 0.05 + (temp_multiplier - 1) * 0.3 + (speed_multiplier - 1) * 0.2
            base_risk = max(0.01, min(0.95, base_risk))

            trend = base_risk * (1 + 0.3 * time_points)
            noise = np.random.normal(0, 0.02, n_steps)
            probabilities = np.clip(trend + noise, 0, 1).tolist()

            final_prob = probabilities[-1]

            if final_prob > 0.6:
                risk_level = 'high'
                rec_title = "立即调整参数"
                rec_suggestions = [
                    "降低设备运行速度20%以上",
                    "启动冷却系统降低温度",
                    "建议停机检修"
                ]
            elif final_prob > 0.3:
                risk_level = 'medium'
                rec_title = "参数调整需谨慎"
                rec_suggestions = [
                    "可适当降低运行速度",
                    "监控温度变化趋势",
                    "考虑预防性维护"
                ]
            else:
                risk_level = 'low'
                rec_title = "参数在安全范围内"
                rec_suggestions = [
                    "当前参数配置合理",
                    "可持续监控运行状态",
                    "定期维护即可"
                ]

            result = PredictionResult(
                device_id=device_id,
                timestamp=datetime.now().timestamp(),
                horizon_minutes=5,
                failure_probability=probabilities,
                final_probability=final_prob,
                confidence=min(0.95, 0.5 + len(history_data) * 0.01),
                risk_level=risk_level,
                baseline_probability=base_risk,
                impact_factors={
                    'temperature': 'high' if temp_multiplier > 1.1 else 'medium' if temp_multiplier > 1.05 else 'low',
                    'speed': 'high' if speed_multiplier > 1.2 else 'medium' if speed_multiplier > 1.1 else 'low'
                },
                recommendation={
                    'level': risk_level,
                    'title': rec_title,
                    'suggestions': rec_suggestions
                }
            )

            self._results_cache[request_id] = result
            logger.info(f"Completed prediction {request_id}: {risk_level} risk ({final_prob:.1%})")

        except Exception as e:
            logger.error(f"Prediction failed for {request_id}: {e}")
            self._results_cache[request_id] = PredictionResult(
                device_id=device_id,
                timestamp=datetime.now().timestamp(),
                horizon_minutes=5,
                failure_probability=[0.5] * 30,
                final_probability=0.5,
                confidence=0.3,
                risk_level='medium',
                baseline_probability=0.5,
                impact_factors={'temperature': 'unknown', 'speed': 'unknown'},
                recommendation={'level': 'error', 'title': '预测服务异常', 'suggestions': ['请重试']}
            )

    def get_status(self) -> Dict:
        return {
            'model_loaded': self.predictor.is_ready(),
            'queue_size': self._request_queue.qsize(),
            'cache_size': len(self._results_cache),
            'model_size_mb': self.predictor.model_size_mb
        }


_prediction_service = None


def get_prediction_service() -> PredictionService:
    global _prediction_service
    if _prediction_service is None:
        _prediction_service = PredictionService()
    return _prediction_service
