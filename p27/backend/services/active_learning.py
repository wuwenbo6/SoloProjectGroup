import os
import json
import uuid
import torch
from typing import List, Dict, Optional, Tuple
from loguru import logger
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from collections import defaultdict
from pathlib import Path

from config import settings
from schemas.models import Entity


@dataclass
class FeedbackRecord:
    feedback_id: str
    document_id: str
    original_entity: Optional[Dict]
    corrected_entity: Optional[Dict]
    feedback_type: str
    comment: Optional[str]
    page_num: int
    created_at: str
    status: str
    used_for_training: bool


class ActiveLearningService:
    def __init__(self):
        self.feedback_dir = Path(settings.upload_dir) / "feedback"
        self.feedback_dir.mkdir(parents=True, exist_ok=True)

        self.model_dir = Path(settings.upload_dir) / "models"
        self.model_dir.mkdir(parents=True, exist_ok=True)

        self.feedback_file = self.feedback_dir / "feedback_records.json"
        self._init_feedback_storage()

        self.training_enabled = True
        self.min_samples_for_training = 10
        self.auto_retrain_threshold = 50
        self.last_training_time = None

        logger.info("主动学习服务初始化完成")

    def _init_feedback_storage(self):
        if not self.feedback_file.exists():
            with open(self.feedback_file, 'w', encoding='utf-8') as f:
                json.dump({"records": []}, f, ensure_ascii=False, indent=2)

    def _load_feedback_records(self) -> List[Dict]:
        try:
            with open(self.feedback_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get("records", [])
        except Exception as e:
            logger.error(f"加载反馈记录失败: {str(e)}")
            return []

    def _save_feedback_records(self, records: List[Dict]):
        try:
            with open(self.feedback_file, 'w', encoding='utf-8') as f:
                json.dump({"records": records}, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存反馈记录失败: {str(e)}")
            raise

    async def submit_feedback(
        self,
        document_id: str,
        original_entity: Optional[Dict],
        corrected_entity: Optional[Dict],
        feedback_type: str,
        comment: Optional[str],
        page_num: int
    ) -> str:
        feedback_id = str(uuid.uuid4())

        record = FeedbackRecord(
            feedback_id=feedback_id,
            document_id=document_id,
            original_entity=original_entity,
            corrected_entity=corrected_entity,
            feedback_type=feedback_type,
            comment=comment,
            page_num=page_num,
            created_at=datetime.now().isoformat(),
            status="pending",
            used_for_training=False
        )

        records = self._load_feedback_records()
        records.append(asdict(record))
        self._save_feedback_records(records)

        logger.info(f"反馈已提交: {feedback_id}, 类型: {feedback_type}")

        pending_count = len([r for r in records if r['status'] == 'pending'])
        if pending_count >= self.auto_retrain_threshold:
            logger.info(f"待处理反馈达到阈值 ({pending_count})，将触发自动微调")

        return feedback_id

    async def get_feedback_by_document(self, document_id: str) -> List[Dict]:
        records = self._load_feedback_records()
        return [r for r in records if r['document_id'] == document_id]

    async def get_pending_feedback(self, limit: int = 100) -> List[Dict]:
        records = self._load_feedback_records()
        pending = [r for r in records if r['status'] == 'pending']
        return pending[:limit]

    async def get_feedback_stats(self) -> Dict:
        records = self._load_feedback_records()

        stats = {
            "total_feedbacks": len(records),
            "pending_review": len([r for r in records if r['status'] == 'pending']),
            "approved": len([r for r in records if r['status'] == 'approved']),
            "rejected": len([r for r in records if r['status'] == 'rejected']),
            "used_for_training": len([r for r in records if r['used_for_training']]),
            "by_type": defaultdict(int),
            "last_training_time": self.last_training_time.isoformat() if self.last_training_time else None
        }

        for r in records:
            stats['by_type'][r['feedback_type']] += 1

        stats['by_type'] = dict(stats['by_type'])
        return stats

    async def approve_feedback(self, feedback_id: str) -> bool:
        records = self._load_feedback_records()

        for r in records:
            if r['feedback_id'] == feedback_id:
                r['status'] = 'approved'
                self._save_feedback_records(records)
                logger.info(f"反馈已批准: {feedback_id}")
                return True

        return False

    async def reject_feedback(self, feedback_id: str) -> bool:
        records = self._load_feedback_records()

        for r in records:
            if r['feedback_id'] == feedback_id:
                r['status'] = 'rejected'
                self._save_feedback_records(records)
                logger.info(f"反馈已拒绝: {feedback_id}")
                return True

        return False

    async def prepare_training_data(self) -> List[Dict]:
        records = self._load_feedback_records()

        approved = [r for r in records if r['status'] == 'approved' and not r['used_for_training']]

        training_samples = []

        for record in approved:
            if record['feedback_type'] == 'correction' and record['corrected_entity']:
                sample = {
                    "feedback_id": record['feedback_id'],
                    "document_id": record['document_id'],
                    "entity": record['corrected_entity'],
                    "feedback_type": "correction",
                    "page_num": record['page_num']
                }
                training_samples.append(sample)

            elif record['feedback_type'] == 'false_positive':
                if record['original_entity']:
                    sample = {
                        "feedback_id": record['feedback_id'],
                        "document_id": record['document_id'],
                        "entity": record['original_entity'],
                        "feedback_type": "false_positive",
                        "page_num": record['page_num']
                    }
                    training_samples.append(sample)

            elif record['feedback_type'] == 'add_entity':
                if record['corrected_entity']:
                    sample = {
                        "feedback_id": record['feedback_id'],
                        "document_id": record['document_id'],
                        "entity": record['corrected_entity'],
                        "feedback_type": "add_entity",
                        "page_num": record['page_num']
                    }
                    training_samples.append(sample)

        logger.info(f"准备训练样本: {len(training_samples)} 个")
        return training_samples

    async def trigger_finetuning(self, layoutlm_service) -> Dict:
        if not self.training_enabled:
            return {"success": False, "message": "训练功能未启用"}

        training_data = await self.prepare_training_data()

        if len(training_data) < self.min_samples_for_training:
            return {
                "success": False,
                "message": f"训练样本不足，需要至少 {self.min_samples_for_training} 个，当前: {len(training_data)}"
            }

        job_id = str(uuid.uuid4())
        logger.info(f"开始微调任务: {job_id}, 样本数: {len(training_data)}")

        try:
            result = await self._finetune_model(layoutlm_service, training_data)

            records = self._load_feedback_records()
            used_ids = {s['feedback_id'] for s in training_data}
            for r in records:
                if r['feedback_id'] in used_ids:
                    r['used_for_training'] = True

            self._save_feedback_records(records)
            self.last_training_time = datetime.now()

            logger.info(f"微调完成: {job_id}")

            return {
                "success": True,
                "job_id": job_id,
                "sample_count": len(training_data),
                "message": "模型微调已完成"
            }

        except Exception as e:
            logger.error(f"微调失败: {str(e)}")
            return {
                "success": False,
                "job_id": job_id,
                "error": str(e)
            }

    async def _finetune_model(self, layoutlm_service, training_data: List[Dict]) -> bool:
        try:
            model = layoutlm_service.model
            processor = layoutlm_service.processor

            optimizer = torch.optim.AdamW(model.parameters(), lr=5e-5)
            model.train()

            total_loss = 0.0
            num_epochs = 3
            batch_size = min(4, len(training_data))

            for epoch in range(num_epochs):
                epoch_loss = 0.0

                for i in range(0, len(training_data), batch_size):
                    batch = training_data[i:i + batch_size]

                    texts = []
                    boxes = []
                    labels = []

                    for sample in batch:
                        entity = sample['entity']
                        text = entity.get('value', '')
                        bbox = entity.get('bbox', [0, 0, 1, 1])

                        if len(bbox) == 4:
                            norm_box = [int(b * 1000) for b in bbox]
                        else:
                            norm_box = [0, 0, 1000, 1000]

                        texts.append(text)
                        boxes.append(norm_box)

                        label_map = {
                            "DATE": 1,
                            "AMOUNT": 2,
                            "CONTRACT": 3
                        }
                        entity_type = entity.get('type', 'OTHER')
                        labels.append(label_map.get(entity_type, 0))

                    encoding = processor(
                        text=texts,
                        boxes=boxes,
                        padding=True,
                        truncation=True,
                        max_length=512,
                        return_tensors="pt"
                    ).to(layoutlm_service.device)

                    labels_tensor = torch.tensor(labels, dtype=torch.long).to(layoutlm_service.device)

                    outputs = model(**encoding, labels=labels_tensor)
                    loss = outputs.loss

                    optimizer.zero_grad()
                    loss.backward()
                    optimizer.step()

                    epoch_loss += loss.item()

                avg_loss = epoch_loss / (len(training_data) / batch_size)
                logger.info(f"微调 Epoch {epoch + 1}/{num_epochs}, Loss: {avg_loss:.4f}")
                total_loss += epoch_loss

            model.eval()

            model_path = self.model_dir / f"layoutlm_finetuned_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            model.save_pretrained(model_path)
            processor.save_pretrained(model_path)

            logger.info(f"微调模型已保存: {model_path}")
            return True

        except Exception as e:
            logger.error(f"微调过程出错: {str(e)}")
            raise

    async def get_training_suggestions(self, entities: List[Entity]) -> List[Dict]:
        suggestions = []

        entity_types = defaultdict(list)
        for entity in entities:
            entity_types[entity.type].append(entity)

        for entity_type, ents in entity_types.items():
            if len(ents) > 3:
                values = [e.value for e in ents]
                unique_values = set(values)

                if len(unique_values) != len(values):
                    suggestions.append({
                        "type": "duplicate_entity",
                        "entity_type": entity_type,
                        "message": f"发现重复的{entity_type}实体，建议人工核实",
                        "entities": ents
                    })

        for entity in entities:
            if entity.confidence < 0.5:
                suggestions.append({
                    "type": "low_confidence",
                    "entity_type": entity.type,
                    "value": entity.value,
                    "confidence": entity.confidence,
                    "message": f"该实体置信度较低 ({entity.confidence:.2f})，建议人工确认"
                })

        return suggestions

    async def export_training_dataset(self, output_path: str = None) -> str:
        training_data = await self.prepare_training_data()

        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = str(self.feedback_dir / f"training_dataset_{timestamp}.json")

        dataset = {
            "version": "1.0",
            "created_at": datetime.now().isoformat(),
            "sample_count": len(training_data),
            "samples": training_data
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(dataset, f, ensure_ascii=False, indent=2)

        logger.info(f"训练数据集已导出: {output_path}")
        return output_path

    async def delete_feedback(self, feedback_id: str) -> bool:
        records = self._load_feedback_records()
        original_count = len(records)

        records = [r for r in records if r['feedback_id'] != feedback_id]

        if len(records) < original_count:
            self._save_feedback_records(records)
            logger.info(f"反馈已删除: {feedback_id}")
            return True

        return False
