import httpx
import json
import logging
from datetime import datetime
from typing import Dict, Optional

from config import Config

logger = logging.getLogger(__name__)

class DingTalkNotifier:
    def __init__(self, webhook_url: str = None):
        self.webhook_url = webhook_url or Config.DINGTALK_WEBHOOK
    
    async def send_text(self, content: str, at_mobiles: list = None, is_at_all: bool = False):
        if not self.webhook_url:
            logger.warning("DingTalk webhook not configured")
            return False
        
        data = {
            "msgtype": "text",
            "text": {
                "content": content
            },
            "at": {
                "atMobiles": at_mobiles or [],
                "isAtAll": is_at_all
            }
        }
        
        return await self._send_request(data)
    
    async def send_markdown(self, title: str, text: str, at_mobiles: list = None, is_at_all: bool = False):
        if not self.webhook_url:
            logger.warning("DingTalk webhook not configured")
            return False
        
        data = {
            "msgtype": "markdown",
            "markdown": {
                "title": title,
                "text": text
            },
            "at": {
                "atMobiles": at_mobiles or [],
                "isAtAll": is_at_all
            }
        }
        
        return await self._send_request(data)
    
    async def send_anomaly_alert(self, sensor_id: str, anomaly_score: float, 
                                  timestamp: datetime, details: Dict = None):
        title = "⚠️ 设备异常报警"
        
        time_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")
        
        text = f"""
### ⚠️ 设备异常报警

**报警时间**: {time_str}

**设备ID**: {sensor_id}

**异常评分**: {anomaly_score:.2f}

**异常类型**: 传感器数据异常

---
**详细信息**:
- 振动值: {details.get('vibration', 'N/A') if details else 'N/A'}
- 摆度值: {details.get('swing', 'N/A') if details else 'N/A'}
- 温度值: {details.get('temperature', 'N/A') if details else 'N/A'}

> 请及时检查设备状态！
"""
        
        return await self.send_markdown(title, text, is_at_all=True)
    
    async def send_training_complete(self, epochs: int, threshold: float, final_loss: float):
        title = "✅ 模型训练完成"
        
        text = f"""
### ✅ 模型训练完成

**训练时间**: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

**训练轮次**: {epochs}

**异常阈值**: {threshold:.4f}

**最终损失**: {final_loss:.6f}

> 新模型已加载，可以开始异常检测！
"""
        
        return await self.send_markdown(title, text)
    
    async def _send_request(self, data: Dict):
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.webhook_url,
                    json=data,
                    headers={"Content-Type": "application/json"},
                    timeout=10
                )
            
            result = response.json()
            
            if result.get("errcode") == 0:
                logger.info("DingTalk notification sent successfully")
                return True
            else:
                logger.error(f"DingTalk notification failed: {result}")
                return False
                
        except Exception as e:
            logger.error(f"Failed to send DingTalk notification: {e}")
            return False

notifier = DingTalkNotifier()
