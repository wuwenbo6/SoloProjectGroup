import asyncio
import json
import logging
from aiohttp import web, WSMsgType
from lstm_predictor import get_prediction_service, PredictionResult

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PredictionServer:
    def __init__(self, host='0.0.0.0', port=50051):
        self.host = host
        self.port = port
        self.app = web.Application()
        self._setup_routes()
        self.prediction_service = get_prediction_service()

    def _setup_routes(self):
        self.app.router.add_get('/health', self.health_check)
        self.app.router.add_get('/status', self.get_status)
        self.app.router.add_post('/predict', self.predict_handler)
        self.app.router.add_get('/result/{request_id}', self.get_result_handler)
        self.app.router.add_get('/ws', self.websocket_handler)

    async def start(self):
        await self.prediction_service.start()
        runner = web.AppRunner(self.app)
        await runner.setup()
        site = web.TCPSite(runner, self.host, self.port)
        await site.start()
        logger.info(f"Prediction server running on {self.host}:{self.port}")

    async def health_check(self, request):
        is_ready = self.prediction_service.predictor.is_ready()
        status = 200 if is_ready else 503
        return web.json_response({
            'status': 'ready' if is_ready else 'loading',
            'model_loaded': self.prediction_service.predictor.model_loaded,
            'warmup_complete': self.prediction_service.predictor.warmup_complete
        }, status=status)

    async def get_status(self, request):
        status = self.prediction_service.get_status()
        return web.json_response(status)

    async def predict_handler(self, request):
        try:
            data = await request.json()
            device_id = data.get('device_id')
            params = data.get('params', {})
            history_data = data.get('history_data', [])

            if not device_id:
                return web.json_response({'error': 'device_id required'}, status=400)

            if not self.prediction_service.predictor.is_ready():
                return web.json_response({
                    'error': 'Model not ready',
                    'code': 'MODEL_LOADING'
                }, status=503)

            request_id = await self.prediction_service.predict_async(
                device_id=device_id,
                params=params,
                history_data=history_data
            )

            return web.json_response({
                'request_id': request_id,
                'status': 'queued',
                'message': 'Prediction request accepted'
            })

        except Exception as e:
            logger.error(f"Prediction handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)

    async def get_result_handler(self, request):
        request_id = request.match_info['request_id']
        timeout = int(request.query.get('timeout', 30))

        try:
            result = await self.prediction_service.get_result(request_id, timeout)
            if result:
                return web.json_response({
                    'request_id': request_id,
                    'status': 'complete',
                    'data': {
                        'device_id': result.device_id,
                        'timestamp': result.timestamp,
                        'horizon_minutes': result.horizon_minutes,
                        'failure_probability': result.failure_probability,
                        'final_probability': result.final_probability,
                        'confidence': result.confidence,
                        'risk_level': result.risk_level,
                        'baseline_probability': result.baseline_probability,
                        'impact_factors': result.impact_factors,
                        'recommendation': result.recommendation
                    }
                })
            else:
                return web.json_response({'status': 'pending'}, status=202)
        except TimeoutError:
            return web.json_response({'status': 'timeout'}, status=408)
        except Exception as e:
            logger.error(f"Result handler error: {e}")
            return web.json_response({'error': str(e)}, status=500)

    async def websocket_handler(self, request):
        ws = web.WebSocketResponse()
        await ws.prepare(request)

        logger.info("WebSocket client connected")

        async for msg in ws:
            if msg.type == WSMsgType.TEXT:
                try:
                    data = json.loads(msg.data)
                    if data.get('type') == 'predict':
                        device_id = data.get('device_id')
                        params = data.get('params', {})
                        history_data = data.get('history_data', [])

                        if not self.prediction_service.predictor.is_ready():
                            await ws.send_json({
                                'type': 'error',
                                'code': 'MODEL_LOADING',
                                'message': 'Model is still warming up'
                            })
                            continue

                        request_id = await self.prediction_service.predict_async(
                            device_id=device_id,
                            params=params,
                            history_data=history_data
                        )

                        await ws.send_json({
                            'type': 'queued',
                            'request_id': request_id
                        })

                        try:
                            result = await self.prediction_service.get_result(request_id, 30)
                            await ws.send_json({
                                'type': 'result',
                                'request_id': request_id,
                                'data': {
                                    'device_id': result.device_id,
                                    'failure_probability': result.failure_probability,
                                    'final_probability': result.final_probability,
                                    'confidence': result.confidence,
                                    'risk_level': result.risk_level,
                                    'impact_factors': result.impact_factors,
                                    'recommendation': result.recommendation
                                }
                            })
                        except TimeoutError:
                            await ws.send_json({
                                'type': 'timeout',
                                'request_id': request_id
                            })

                    elif data.get('type') == 'ping':
                        await ws.send_json({
                            'type': 'pong',
                            'model_ready': self.prediction_service.predictor.is_ready()
                        })

                except Exception as e:
                    logger.error(f"WebSocket message error: {e}")
                    await ws.send_json({'type': 'error', 'message': str(e)})

            elif msg.type == WSMsgType.ERROR:
                logger.error(f"WebSocket error: {ws.exception()}")

        logger.info("WebSocket client disconnected")
        return ws


async def main():
    server = PredictionServer()
    await server.start()

    while True:
        await asyncio.sleep(3600)


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Server shutdown requested")
