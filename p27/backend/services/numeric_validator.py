import re
import numpy as np
from typing import List, Dict, Tuple, Optional
from loguru import logger
from dataclasses import dataclass
from collections import defaultdict


@dataclass
class NumericValue:
    value: float
    raw_text: str
    context: str
    page_num: int
    value_type: str  # amount, count, percentage, date, other
    confidence: float
    bbox: Optional[List[float]] = None


class NumericValidator:
    def __init__(self):
        self.amount_patterns = [
            r'[¥$€￥]\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)',
            r'(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)\s*[元圆]',
            r'人民币\s*(\d+(?:\.\d{1,2})?)',
            r'(?:合计|总计|总金额)\s*[：:]\s*(\d+(?:\.\d{1,2})?)',
            r'金额\s*[：:]\s*(\d+(?:\.\d{1,2})?)',
        ]

        self.percentage_patterns = [
            r'(\d+(?:\.\d+)?)\s*%',
            r'百分之?(\d+(?:\.\d+)?)',
        ]

        self.count_patterns = [
            r'共\s*(\d+)\s*[笔个项条]',
            r'数量[：:]\s*(\d+)',
            r'(\d+)\s*[笔个项条]',
        ]

        self.numeric_question_keywords = [
            '总金额', '多少元', '多少钱', '金额', '总计', '合计',
            '数量', '多少笔', '多少个', '百分比', '%',
            'total', 'amount', 'sum', 'how much', 'how many'
        ]

        logger.info("数值验证服务初始化完成")

    async def extract_all_numerics(self, ocr_results: List[Dict]) -> List[NumericValue]:
        all_numerics = []

        for page_idx, page_result in enumerate(ocr_results):
            text = page_result.get('text', '')
            words = page_result.get('words', [])

            amounts = await self._extract_amounts(text, page_idx, words)
            all_numerics.extend(amounts)

            percentages = await self._extract_percentages(text, page_idx)
            all_numerics.extend(percentages)

            counts = await self._extract_counts(text, page_idx)
            all_numerics.extend(counts)

            numbers = await self._extract_plain_numbers(text, page_idx)
            all_numerics.extend(numbers)

        deduplicated = await self._deduplicate_numerics(all_numerics)
        logger.info(f"从文档中提取到 {len(deduplicated)} 个数值")
        return deduplicated

    async def _extract_amounts(
        self, text: str, page_num: int, words: List[Dict]
    ) -> List[NumericValue]:
        amounts = []

        for pattern in self.amount_patterns:
            for match in re.finditer(pattern, text, re.IGNORECASE):
                raw_value = match.group(1)
                numeric_value = self._parse_numeric(raw_value)

                if numeric_value is not None:
                    context = self._extract_context(text, match.start(), match.end())

                    amounts.append(NumericValue(
                        value=numeric_value,
                        raw_text=match.group(0),
                        context=context,
                        page_num=page_num,
                        value_type='amount',
                        confidence=0.95
                    ))

        return amounts

    async def _extract_percentages(self, text: str, page_num: int) -> List[NumericValue]:
        percentages = []

        for pattern in self.percentage_patterns:
            for match in re.finditer(pattern, text):
                raw_value = match.group(1)
                numeric_value = self._parse_numeric(raw_value)

                if numeric_value is not None:
                    context = self._extract_context(text, match.start(), match.end())

                    percentages.append(NumericValue(
                        value=numeric_value,
                        raw_text=match.group(0),
                        context=context,
                        page_num=page_num,
                        value_type='percentage',
                        confidence=0.9
                    ))

        return percentages

    async def _extract_counts(self, text: str, page_num: int) -> List[NumericValue]:
        counts = []

        for pattern in self.count_patterns:
            for match in re.finditer(pattern, text):
                raw_value = match.group(1)
                numeric_value = self._parse_numeric(raw_value)

                if numeric_value is not None:
                    context = self._extract_context(text, match.start(), match.end())

                    counts.append(NumericValue(
                        value=numeric_value,
                        raw_text=match.group(0),
                        context=context,
                        page_num=page_num,
                        value_type='count',
                        confidence=0.85
                    ))

        return counts

    async def _extract_plain_numbers(self, text: str, page_num: int) -> List[NumericValue]:
        numbers = []
        pattern = r'\b\d+(?:\.\d+)?\b'

        for match in re.finditer(pattern, text):
            raw_value = match.group(0)
            numeric_value = self._parse_numeric(raw_value)

            if numeric_value is not None and numeric_value > 0:
                context = self._extract_context(text, match.start(), match.end())

                numbers.append(NumericValue(
                    value=numeric_value,
                    raw_text=raw_value,
                    context=context,
                    page_num=page_num,
                    value_type='other',
                    confidence=0.7
                ))

        return numbers

    def _parse_numeric(self, raw: str) -> Optional[float]:
        try:
            cleaned = raw.replace(',', '').replace('，', '')
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    def _extract_context(self, text: str, start: int, end: int, window: int = 30) -> str:
        context_start = max(0, start - window)
        context_end = min(len(text), end + window)
        return text[context_start:context_end].strip()

    async def _deduplicate_numerics(self, numerics: List[NumericValue]) -> List[NumericValue]:
        seen = {}
        deduplicated = []

        for num in numerics:
            key = (num.value, num.value_type)
            if key not in seen:
                seen[key] = num
                deduplicated.append(num)
            elif num.confidence > seen[key].confidence:
                seen[key] = num
                idx = next(i for i, n in enumerate(deduplicated)
                          if n.value == num.value and n.value_type == num.value_type)
                deduplicated[idx] = num

        return deduplicated

    def is_numeric_question(self, question: str) -> bool:
        question_lower = question.lower()
        return any(keyword in question_lower for keyword in self.numeric_question_keywords)

    async def validate_answer_numerics(
        self, answer: str, document_numerics: List[NumericValue]
    ) -> Tuple[bool, List[Dict], List[Dict]]:
        answer_numerics = self._extract_numerics_from_text(answer)

        valid_numerics = []
        invalid_numerics = []

        for ans_num in answer_numerics:
            is_valid = await self._verify_numeric_in_document(ans_num, document_numerics)
            if is_valid:
                valid_numerics.append(ans_num)
            else:
                invalid_numerics.append(ans_num)

        is_valid = len(invalid_numerics) == 0

        if not is_valid:
            logger.warning(f"发现 {len(invalid_numerics)} 个未经验证的数值: {[n['value'] for n in invalid_numerics]}")

        return is_valid, valid_numerics, invalid_numerics

    def _extract_numerics_from_text(self, text: str) -> List[Dict]:
        numerics = []
        pattern = r'[¥$€￥]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|(?:\d+(?:\.\d+)?)\s*[元圆%]?'

        for match in re.finditer(pattern, text):
            raw = match.group(0)
            value = self._parse_numeric(raw.replace(r'[¥$€￥元圆%]', ''))

            if value is not None:
                numerics.append({
                    'value': value,
                    'raw_text': raw,
                    'context': self._extract_context(text, match.start(), match.end(), 20)
                })

        return numerics

    async def _verify_numeric_in_document(
        self, ans_num: Dict, doc_numerics: List[NumericValue], tolerance: float = 0.01
    ) -> bool:
        ans_value = ans_num['value']

        for doc_num in doc_numerics:
            if doc_num.value_type in ['amount', 'percentage', 'count']:
                if abs(ans_value - doc_num.value) < tolerance:
                    return True

                if abs(ans_value - doc_num.value * 100) < tolerance:
                    return True

                if abs(ans_value - doc_num.value / 100) < tolerance:
                    return True

        return False

    async def generate_constrained_prompt(
        self, question: str, context: str, document_numerics: List[NumericValue]
    ) -> str:
        relevant_numerics = await self._find_relevant_numerics(question, document_numerics)

        if not relevant_numerics:
            return f"""请基于以下文档内容回答问题。如果文档中没有明确答案，请说明无法回答，不要猜测。

参考文档：
{context}

用户问题：{question}

回答要求：
1. 只使用文档中明确提到的信息
2. 如果文档中没有答案，请明确说明
3. 不要编造任何数字或金额
"""

        numeric_info = self._format_numerics_for_prompt(relevant_numerics)

        prompt = f"""请基于以下文档内容回答问题。必须严格遵守以下规则：

【重要规则】
1. 答案中所有数字、金额、百分比必须从以下【允许的数值列表】中选择
2. 绝对禁止编造或推测任何不在列表中的数值
3. 如果文档中没有明确答案，请直接说明"文档中没有找到相关信息"

【允许的数值列表】
{numeric_info}

参考文档：
{context}

用户问题：{question}

请给出准确、详细的回答："""

        return prompt

    async def _find_relevant_numerics(
        self, question: str, document_numerics: List[NumericValue]
    ) -> List[NumericValue]:
        question_lower = question.lower()

        relevant_types = []
        if any(k in question_lower for k in ['金额', '多少钱', '多少元', 'total', 'amount', 'sum']):
            relevant_types.append('amount')
        if any(k in question_lower for k in ['百分比', '%', 'percent']):
            relevant_types.append('percentage')
        if any(k in question_lower for k in ['数量', '多少个', '多少笔', 'how many', 'count']):
            relevant_types.append('count')

        if relevant_types:
            return [n for n in document_numerics if n.value_type in relevant_types]

        return [n for n in document_numerics if n.value_type in ['amount', 'percentage', 'count']]

    def _format_numerics_for_prompt(self, numerics: List[NumericValue]) -> str:
        if not numerics:
            return "（文档中未提取到相关数值）"

        grouped = defaultdict(list)
        for num in numerics:
            grouped[num.value_type].append(num)

        lines = []
        type_labels = {
            'amount': '金额数值',
            'percentage': '百分比数值',
            'count': '数量数值',
            'other': '其他数值'
        }

        for value_type, nums in grouped.items():
            if nums:
                nums_sorted = sorted(nums, key=lambda x: -x.confidence)
                values_str = '、'.join([
                    f"{n.value:.2f}（原始文本：{n.raw_text}）"
                    for n in nums_sorted[:10]
                ])
                lines.append(f"[{type_labels.get(value_type, value_type)}] {values_str}")

        return '\n'.join(lines)

    async def correct_invalid_numerics(
        self, answer: str, invalid_numerics: List[Dict], document_numerics: List[NumericValue]
    ) -> str:
        corrected_answer = answer

        for invalid in invalid_numerics:
            invalid_value = invalid['value']
            invalid_text = invalid['raw_text']

            closest = self._find_closest_numeric(invalid_value, document_numerics)

            if closest:
                logger.info(f"将未验证数值 {invalid_text} 替换为文档中的数值: {closest.raw_text}")
                corrected_answer = corrected_answer.replace(invalid_text, closest.raw_text)
            else:
                logger.warning(f"未找到可替换的数值，移除可疑数值: {invalid_text}")
                correction_note = f"[注：文档中未找到数值 {invalid_text}，已移除]"
                corrected_answer = corrected_answer.replace(invalid_text, correction_note)

        return corrected_answer

    def _find_closest_numeric(
        self, target: float, numerics: List[NumericValue]
    ) -> Optional[NumericValue]:
        if not numerics:
            return None

        closest = None
        min_diff = float('inf')

        for num in numerics:
            diff = abs(target - num.value)
            relative_diff = diff / max(num.value, 1)

            if relative_diff < 0.3 and diff < min_diff:
                min_diff = diff
                closest = num

        return closest

    async def generate_warning_note(self, invalid_numerics: List[Dict]) -> str:
        if not invalid_numerics:
            return ""

        values = ', '.join([str(n['value']) for n in invalid_numerics])
        note = f"\n\n⚠️ 注意：上述答案中包含的数值({values})在原始文档中未找到对应记录，请谨慎参考。"
        return note

    def get_numeric_statistics(self, numerics: List[NumericValue]) -> Dict:
        stats = {
            'total_count': len(numerics),
            'by_type': defaultdict(int),
            'amounts': [],
            'percentages': [],
            'counts': []
        }

        for num in numerics:
            stats['by_type'][num.value_type] += 1

            if num.value_type == 'amount':
                stats['amounts'].append({
                    'value': num.value,
                    'raw_text': num.raw_text,
                    'context': num.context,
                    'page': num.page_num + 1
                })
            elif num.value_type == 'percentage':
                stats['percentages'].append({
                    'value': num.value,
                    'raw_text': num.raw_text,
                    'context': num.context,
                    'page': num.page_num + 1
                })
            elif num.value_type == 'count':
                stats['counts'].append({
                    'value': num.value,
                    'raw_text': num.raw_text,
                    'context': num.context,
                    'page': num.page_num + 1
                })

        stats['by_type'] = dict(stats['by_type'])
        return stats
