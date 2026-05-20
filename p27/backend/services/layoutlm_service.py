import torch
import re
from typing import List, Dict, Tuple, Optional
from loguru import logger
from PIL import Image
from transformers import (
    LayoutLMv3Processor,
    LayoutLMv3ForTokenClassification
)

from config import settings
from schemas.models import Entity
from .table_detector import TableDetector
from .entity_alignment import EntityAlignmentService


class LayoutLMService:
    def __init__(self, enable_table_detection: bool = True):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"使用设备: {self.device}")

        self.enable_table_detection = enable_table_detection

        self.processor = LayoutLMv3Processor.from_pretrained(
            settings.layoutlm_model_name,
            apply_ocr=False
        )

        self.model = LayoutLMv3ForTokenClassification.from_pretrained(
            settings.layoutlm_model_name,
            num_labels=9
        ).to(self.device)

        self.id2label = {
            0: "O",
            1: "B-DATE",
            2: "I-DATE",
            3: "B-AMOUNT",
            4: "I-AMOUNT",
            5: "B-CONTRACT",
            6: "I-CONTRACT",
            7: "B-OTHER",
            8: "I-OTHER"
        }

        self.table_detector = TableDetector() if enable_table_detection else None
        self.alignment_service = EntityAlignmentService()

        logger.info(f"LayoutLMv3模型加载完成 (表格检测: {'开启' if enable_table_detection else '关闭'})")

    async def extract_entities(
        self,
        ocr_results: List[Dict],
        images: Optional[List[Image.Image]] = None
    ) -> List[Entity]:
        all_entities = []
        all_tables = []

        for page_idx, ocr_result in enumerate(ocr_results):
            try:
                image = images[page_idx] if images and page_idx < len(images) else None
                entities, tables = await self._extract_from_page(
                    ocr_result, page_idx, image
                )
                all_entities.extend(entities)
                all_tables.extend(tables)
            except Exception as e:
                logger.error(f"第 {page_idx} 页实体抽取失败: {str(e)}", exc_info=True)

        if self.enable_table_detection and all_tables:
            table_aligned_entities = await self.alignment_service.align_table_entities(
                all_tables, all_entities
            )
            all_entities = table_aligned_entities

        rule_entities = await self._extract_by_rules(ocr_results)
        all_entities.extend(rule_entities)

        all_entities = await self._deduplicate_entities(all_entities)

        logger.info(f"共抽取 {len(all_entities)} 个实体 (含表格对齐)")
        return all_entities

    async def _extract_from_page(
        self,
        ocr_result: Dict,
        page_num: int,
        image: Optional[Image.Image] = None
    ) -> Tuple[List[Entity], List[Dict]]:
        words = ocr_result['words']
        if not words:
            return [], []

        tables = []
        non_table_words = words

        if self.enable_table_detection and image:
            try:
                table_result = await self.table_detector.process_image_with_tables(
                    image, ocr_result
                )
                tables = table_result["tables"]
                non_table_words = table_result["non_table_words"]
                logger.info(f"第 {page_num} 页处理 {len(tables)} 个表格")
            except Exception as e:
                logger.warning(f"表格处理失败，回退到普通模式: {str(e)}")

        entities_from_layoutlm = await self._extract_with_layoutlm(
            non_table_words, page_num
        )

        table_entities = []
        for table in tables:
            table_ents = await self._extract_entities_from_table_words(
                table["words"], page_num
            )
            table_entities.extend(table_ents)

        all_entities = entities_from_layoutlm + table_entities

        return all_entities, tables

    async def _extract_with_layoutlm(
        self,
        words: List[Dict],
        page_num: int
    ) -> List[Entity]:
        if not words:
            return []

        texts = [w['text'] for w in words]
        boxes = [[int(b * 1000) for b in w['bbox']] for w in words]

        encoding = self.processor(
            text=texts,
            boxes=boxes,
            padding="max_length",
            truncation=True,
            max_length=settings.layoutlm_max_length,
            return_tensors="pt"
        ).to(self.device)

        with torch.no_grad():
            outputs = self.model(**encoding)

        predictions = outputs.logits.argmax(-1).squeeze().tolist()
        token_boxes = encoding.bbox.squeeze().tolist()

        word_ids = encoding.word_ids()

        entities = []
        current_entity = None

        for token_idx, (pred, box) in enumerate(zip(predictions, token_boxes)):
            label = self.id2label.get(pred, "O")
            word_idx = word_ids[token_idx]

            if word_idx is None:
                continue

            if label == "O":
                if current_entity:
                    entities.append(current_entity)
                    current_entity = None
                continue

            if label.startswith("B-"):
                if current_entity:
                    entities.append(current_entity)

                entity_type = label[2:]
                word_text = words[word_idx]['text'] if word_idx < len(words) else ""
                word_bbox = words[word_idx]['bbox'] if word_idx < len(words) else box

                current_entity = {
                    "type": entity_type,
                    "value": word_text,
                    "confidence": 0.85,
                    "bbox": word_bbox,
                    "page_num": page_num,
                    "word_indices": [word_idx]
                }

            elif label.startswith("I-") and current_entity:
                entity_type = label[2:]
                if current_entity["type"] == entity_type:
                    word_text = words[word_idx]['text'] if word_idx < len(words) else ""
                    current_entity["value"] += " " + word_text
                    current_entity["word_indices"].append(word_idx)

                    if word_idx < len(words):
                        word_bbox = words[word_idx]['bbox']
                        current_entity["bbox"] = [
                            min(current_entity["bbox"][0], word_bbox[0]),
                            min(current_entity["bbox"][1], word_bbox[1]),
                            max(current_entity["bbox"][2], word_bbox[2]),
                            max(current_entity["bbox"][3], word_bbox[3])
                        ]

        if current_entity:
            entities.append(current_entity)

        result_entities = []
        for e in entities:
            e.pop("word_indices", None)
            e["value"] = e["value"].strip()
            if e["value"] and len(e["value"]) >= 2:
                result_entities.append(Entity(**e))

        return result_entities

    async def _extract_entities_from_table_words(
        self,
        table_words: List[Dict],
        page_num: int
    ) -> List[Entity]:
        if not table_words:
            return []

        return await self._extract_with_layoutlm(table_words, page_num)

    async def _extract_by_rules(self, ocr_results: List[Dict]) -> List[Entity]:
        entities = []

        date_patterns = [
            r'\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?',
            r'\d{1,2}[-/]\d{1,2}[-/]\d{4}',
            r'\d{4}年\d{1,2}月\d{1,2}日'
        ]

        amount_patterns = [
            r'[¥$€]\s*\d{1,3}(?:,\d{3})*(?:\.\d{2})?',
            r'\d{1,3}(?:,\d{3})*(?:\.\d{2})?\s*[元圆]',
            r'人民币\s*\d+(?:\.\d+)?\s*[元圆]?'
        ]

        contract_patterns = [
            r'合同号?[：:]\s*([A-Z0-9-]+)',
            r'[Cc]ontract\s*[Nn]o?[.:]\s*([A-Z0-9-]+)',
            r'编号[：:]\s*([A-Z0-9-]+)',
            r'HT[A-Z0-9-]{8,}'
        ]

        for page_idx, ocr_result in enumerate(ocr_results):
            text = ocr_result['text']

            for pattern in date_patterns:
                for match in re.finditer(pattern, text):
                    entities.append(Entity(
                        type="DATE",
                        value=match.group(),
                        confidence=0.95,
                        bbox=None
                    ))

            for pattern in amount_patterns:
                for match in re.finditer(pattern, text):
                    entities.append(Entity(
                        type="AMOUNT",
                        value=match.group(),
                        confidence=0.95,
                        bbox=None
                    ))

            for pattern in contract_patterns:
                for match in re.finditer(pattern, text):
                    entities.append(Entity(
                        type="CONTRACT",
                        value=match.group(1) if match.groups() else match.group(),
                        confidence=0.95,
                        bbox=None
                    ))

        return entities

    async def _deduplicate_entities(self, entities: List[Entity]) -> List[Entity]:
        seen = set()
        unique_entities = []

        for entity in entities:
            key = (entity.type, entity.value)
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)

        return unique_entities
