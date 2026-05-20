import re
from typing import List, Dict, Tuple, Optional
from loguru import logger
from collections import defaultdict

from schemas.models import Entity


class EntityAlignmentService:
    def __init__(self):
        self.amount_keywords = [
            "金额", "合计", "总计", "小计", "总数", "价格", "费用",
            "amount", "total", "sum", "price", "cost"
        ]
        self.date_keywords = [
            "日期", "时间", "年月日", "签订", "生效", "截止",
            "date", "time", "day", "month", "year"
        ]
        self.contract_keywords = [
            "合同号", "编号", "协议号", "编码", "单号",
            "contract", "no", "number", "id", "code"
        ]

    async def align_table_entities(
        self,
        tables: List[Dict],
        raw_entities: List[Entity]
    ) -> List[Entity]:
        aligned_entities = []

        for table in tables:
            text_grid = table["text_grid"]
            cell_grid = table["cell_grid"]
            table_bbox = table["table_bbox"]

            table_entities = await self._extract_entities_from_table(
                text_grid, cell_grid, table_bbox
            )
            aligned_entities.extend(table_entities)

        for entity in raw_entities:
            if not await self._is_duplicate(entity, aligned_entities):
                aligned_entities.append(entity)

        logger.info(f"表格对齐后实体数: {len(aligned_entities)}")
        return aligned_entities

    async def _extract_entities_from_table(
        self,
        text_grid: List[List[str]],
        cell_grid: Dict,
        table_bbox: List[float]
    ) -> List[Entity]:
        entities = []
        row_count = len(text_grid)
        if row_count == 0:
            return entities

        col_count = len(text_grid[0])

        header_row_indices = await self._detect_header_rows(text_grid)

        for row_idx in range(row_count):
            for col_idx in range(col_count):
                cell_text = text_grid[row_idx][col_idx]
                if not cell_text:
                    continue

                cell_key = f"{row_idx}_{col_idx}"
                cell_data = cell_grid.get(cell_key, {})
                cell_bbox = cell_data.get("bbox", table_bbox)

                cell_amounts = await self._extract_amount_from_cell(cell_text, cell_bbox)
                for amount in cell_amounts:
                    amount_entity = await self._create_entity_from_value(
                        amount, "AMOUNT", cell_bbox
                    )
                    if amount_entity:
                        amount_entity, is_valid = await self._validate_amount_in_context(
                            amount_entity, text_grid, row_idx, col_idx
                        )
                        if is_valid:
                            entities.append(amount_entity)

                cell_dates = await self._extract_date_from_cell(cell_text, cell_bbox)
                for date in cell_dates:
                    date_entity = await self._create_entity_from_value(
                        date, "DATE", cell_bbox
                    )
                    if date_entity:
                        entities.append(date_entity)

                cell_contracts = await self._extract_contract_from_cell(cell_text, cell_bbox)
                for contract in cell_contracts:
                    contract_entity = await self._create_entity_from_value(
                        contract, "CONTRACT", cell_bbox
                    )
                    if contract_entity:
                        entities.append(contract_entity)

        entities = await self._merge_cross_cell_entities(entities, text_grid, cell_grid)

        return entities

    async def _detect_header_rows(self, text_grid: List[List[str]]) -> List[int]:
        header_rows = []
        for row_idx, row in enumerate(text_grid):
            keyword_count = 0
            for cell_text in row:
                cell_lower = cell_text.lower()
                for keyword in (self.amount_keywords + self.date_keywords + self.contract_keywords):
                    if keyword in cell_lower:
                        keyword_count += 1
                        break
            if keyword_count >= 2:
                header_rows.append(row_idx)

        return header_rows if header_rows else [0]

    async def _extract_amount_from_cell(self, cell_text: str, cell_bbox: List[float]) -> List[str]:
        amounts = []

        patterns = [
            r'[¥$€￥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)',
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*[元圆]',
            r'人民币\s*(\d+(?:\.\d+)?)',
            r'(\d+(?:\.\d{2})?)',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, cell_text):
                amount = match.group(1)
                if amount and len(amount) >= 2:
                    amounts.append(amount)

        return list(set(amounts))

    async def _extract_date_from_cell(self, cell_text: str, cell_bbox: List[float]) -> List[str]:
        dates = []

        patterns = [
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}[日号]?)',
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{4})',
            r'(\d{4}年\d{1,2}月\d{1,2}日)',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, cell_text):
                date = match.group(1)
                if date:
                    dates.append(date)

        return list(set(dates))

    async def _extract_contract_from_cell(self, cell_text: str, cell_bbox: List[float]) -> List[str]:
        contracts = []

        patterns = [
            r'合同号?[：:]\s*([A-Z0-9-]+)',
            r'编号[：:]\s*([A-Z0-9-]+)',
            r'HT[A-Z0-9-]{6,}',
            r'[A-Z]{2,}[-_]\d{6,}',
        ]

        for pattern in patterns:
            for match in re.finditer(pattern, cell_text):
                contract = match.group(1) if match.groups() else match.group()
                if contract and len(contract) >= 4:
                    contracts.append(contract)

        return list(set(contracts))

    async def _create_entity_from_value(
        self,
        value: str,
        entity_type: str,
        bbox: List[float]
    ) -> Optional[Entity]:
        if not value or len(value.strip()) == 0:
            return None

        normalized_bbox = [b / 1000 if b > 1 else b for b in bbox]

        return Entity(
            type=entity_type,
            value=value.strip(),
            confidence=0.92,
            bbox=normalized_bbox
        )

    async def _validate_amount_in_context(
        self,
        entity: Entity,
        text_grid: List[List[str]],
        row_idx: int,
        col_idx: int
    ) -> Tuple[Entity, bool]:
        if row_idx >= len(text_grid) or col_idx >= len(text_grid[0]):
            return entity, True

        for check_col in range(max(0, col_idx - 3), col_idx):
            header_text = text_grid[0][check_col] if 0 < len(text_grid) else ""
            cell_text = text_grid[row_idx][check_col]

            for keyword in self.amount_keywords:
                if keyword in header_text or keyword in cell_text:
                    entity.confidence = min(0.98, entity.confidence + 0.05)
                    return entity, True

        return entity, True

    async def _merge_cross_cell_entities(
        self,
        entities: List[Entity],
        text_grid: List[List[str]],
        cell_grid: Dict
    ) -> List[Entity]:
        merged_entities = []

        amount_groups = defaultdict(list)
        for entity in entities:
            if entity.type == "AMOUNT":
                amount_groups[entity.value].append(entity)

        for amount_value, amount_entities in amount_groups.items():
            if len(amount_entities) == 1:
                merged_entities.append(amount_entities[0])
            else:
                best_entity = max(amount_entities, key=lambda e: e.confidence)
                best_entity.confidence = min(0.99, best_entity.confidence + 0.03)
                merged_entities.append(best_entity)

        for entity in entities:
            if entity.type != "AMOUNT":
                merged_entities.append(entity)

        return merged_entities

    async def _is_duplicate(self, entity: Entity, existing_entities: List[Entity]) -> bool:
        for existing in existing_entities:
            if existing.type == entity.type and existing.value == entity.value:
                return True

            if existing.type == entity.type:
                similarity = await self._calculate_similarity(existing.value, entity.value)
                if similarity > 0.9:
                    return True

        return False

    async def _calculate_similarity(self, str1: str, str2: str) -> float:
        if str1 == str2:
            return 1.0

        set1 = set(str1)
        set2 = set(str2)

        intersection = len(set1 & set2)
        union = len(set1 | set2)

        return intersection / union if union > 0 else 0

    async def align_by_rows(
        self,
        words: List[Dict],
        entities: List[Entity]
    ) -> List[Entity]:
        rows = defaultdict(list)
        for word in words:
            row_key = word.get("line_num", 0)
            rows[row_key].append(word)

        row_texts = {}
        for row_key, row_words in rows.items():
            sorted_words = sorted(row_words, key=lambda x: x["word_num"])
            row_texts[row_key] = " ".join([w["text"] for w in sorted_words])

        for entity in entities:
            if entity.bbox is None:
                continue

            entity_center_y = (entity.bbox[1] + entity.bbox[3]) / 2
            best_row = None
            min_distance = float('inf')

            for row_key, row_words in rows.items():
                if not row_words:
                    continue

                row_y = sum((w["bbox"][1] + w["bbox"][3]) / 2 for w in row_words) / len(row_words)
                distance = abs(entity_center_y - row_y)

                if distance < min_distance:
                    min_distance = distance
                    best_row = row_key

            if best_row is not None and min_distance < 0.05:
                entity.confidence = min(0.95, entity.confidence + 0.02)

        return entities

    async def extract_table_key_value_pairs(
        self,
        table: Dict
    ) -> Dict[str, Dict]:
        text_grid = table["text_grid"]
        kv_pairs = {}

        if len(text_grid) < 2:
            return kv_pairs

        for row_idx in range(1, len(text_grid)):
            for col_idx in range(0, len(text_grid[row_idx])):
                key_text = text_grid[0][col_idx].strip()
                value_text = text_grid[row_idx][col_idx].strip()

                if key_text and value_text and key_text != value_text:
                    kv_pairs[key_text] = {
                        "value": value_text,
                        "row": row_idx,
                        "col": col_idx
                    }

        return kv_pairs
