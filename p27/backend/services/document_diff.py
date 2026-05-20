import re
import difflib
from typing import List, Dict, Tuple, Optional
from loguru import logger
from collections import defaultdict
from datetime import datetime

from schemas.models import Entity


class DocumentDiffService:
    def __init__(self):
        self.stop_words = {'的', '了', '和', '是', '就', '都', '而', '及', '与', 'the', 'and', 'or', 'is', 'are', 'was', 'were'}
        logger.info("文档版本对比服务初始化完成")

    async def compare_documents(
        self,
        original_doc: Dict,
        revised_doc: Dict
    ) -> Dict:
        try:
            logger.info(f"开始对比文档: {original_doc.get('filename')} vs {revised_doc.get('filename')}")

            original_ocr = original_doc.get('ocr_results', [])
            revised_ocr = revised_doc.get('ocr_results', [])

            original_text = self._extract_full_text(original_ocr)
            revised_text = self._extract_full_text(revised_ocr)

            paragraph_diffs = await self._compare_paragraphs(
                original_ocr, revised_ocr, original_text, revised_text
            )

            original_entities = original_doc.get('entities', [])
            revised_entities = revised_doc.get('entities', [])

            entity_diffs = await self._compare_entities(original_entities, revised_entities)

            text_diff_ratio = difflib.SequenceMatcher(None, original_text, revised_text).ratio()

            result = {
                'original_document': {
                    'id': original_doc.get('document_id'),
                    'filename': original_doc.get('filename'),
                    'page_count': len(original_ocr)
                },
                'revised_document': {
                    'id': revised_doc.get('document_id'),
                    'filename': revised_doc.get('filename'),
                    'page_count': len(revised_ocr)
                },
                'similarity_score': round(text_diff_ratio * 100, 2),
                'total_changes': len([d for d in paragraph_diffs if d['change_type'] != 'unchanged']),
                'paragraph_diffs': paragraph_diffs,
                'entity_diffs': entity_diffs,
                'comparison_time': datetime.now().isoformat()
            }

            logger.info(f"文档对比完成，相似度: {result['similarity_score']}%, 变更数: {result['total_changes']}")
            return result

        except Exception as e:
            logger.error(f"文档对比失败: {str(e)}", exc_info=True)
            raise

    def _extract_full_text(self, ocr_results: List[Dict]) -> str:
        texts = []
        for page in ocr_results:
            if 'text' in page:
                texts.append(page['text'])
        return '\n'.join(texts)

    async def _compare_paragraphs(
        self,
        original_ocr: List[Dict],
        revised_ocr: List[Dict],
        original_text: str,
        revised_text: str
    ) -> List[Dict]:
        original_paragraphs = self._split_into_paragraphs(original_text)
        revised_paragraphs = self._split_into_paragraphs(revised_text)

        sm = difflib.SequenceMatcher(None, original_paragraphs, revised_paragraphs)

        diffs = []

        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal':
                for i in range(i1, i2):
                    diffs.append({
                        'change_type': 'unchanged',
                        'content': original_paragraphs[i],
                        'content_html': original_paragraphs[i],
                        'original_index': i,
                        'revised_index': j1 + (i - i1)
                    })
            elif tag == 'delete':
                for i in range(i1, i2):
                    diffs.append({
                        'change_type': 'deleted',
                        'content': original_paragraphs[i],
                        'content_html': f'<span class="diff-deleted">{original_paragraphs[i]}</span>',
                        'original_index': i,
                        'revised_index': None
                    })
            elif tag == 'insert':
                for j in range(j1, j2):
                    diffs.append({
                        'change_type': 'inserted',
                        'content': revised_paragraphs[j],
                        'content_html': f'<span class="diff-inserted">{revised_paragraphs[j]}</span>',
                        'original_index': None,
                        'revised_index': j
                    })
            elif tag == 'replace':
                orig_content = '\n'.join(original_paragraphs[i1:i2])
                rev_content = '\n'.join(revised_paragraphs[j1:j2])

                inline_diff = await self._generate_inline_diff(orig_content, rev_content)

                diffs.append({
                    'change_type': 'modified',
                    'original_content': orig_content,
                    'revised_content': rev_content,
                    'content_html': inline_diff,
                    'original_index': i1,
                    'revised_index': j1
                })

        return diffs

    def _split_into_paragraphs(self, text: str) -> List[str]:
        paragraphs = re.split(r'\n\s*\n', text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        return paragraphs

    async def _generate_inline_diff(self, original: str, revised: str) -> str:
        sm = difflib.SequenceMatcher(None, original, revised)

        html_parts = []

        for tag, i1, i2, j1, j2 in sm.get_opcodes():
            if tag == 'equal':
                html_parts.append(original[i1:i2])
            elif tag == 'delete':
                html_parts.append(f'<span class="diff-deleted-inline">{original[i1:i2]}</span>')
            elif tag == 'insert':
                html_parts.append(f'<span class="diff-inserted-inline">{revised[j1:j2]}</span>')
            elif tag == 'replace':
                html_parts.append(f'<span class="diff-deleted-inline">{original[i1:i2]}</span>')
                html_parts.append(f'<span class="diff-inserted-inline">{revised[j1:j2]}</span>')

        return ''.join(html_parts)

    async def _compare_entities(
        self,
        original_entities: List[Entity],
        revised_entities: List[Entity]
    ) -> Dict:
        result = {
            'summary': {
                'total_original': len(original_entities),
                'total_revised': len(revised_entities),
                'added': 0,
                'deleted': 0,
                'modified': 0,
                'unchanged': 0
            },
            'by_type': defaultdict(lambda: {
                'original_count': 0,
                'revised_count': 0,
                'added': [],
                'deleted': [],
                'modified': [],
                'unchanged': []
            }),
            'changes': []
        }

        original_by_type = defaultdict(list)
        for ent in original_entities:
            original_by_type[ent.type].append(ent)

        revised_by_type = defaultdict(list)
        for ent in revised_entities:
            revised_by_type[ent.type].append(ent)

        all_types = set(original_by_type.keys()) | set(revised_by_type.keys())

        for entity_type in all_types:
            orig_ents = original_by_type[entity_type]
            rev_ents = revised_by_type[entity_type]

            result['by_type'][entity_type]['original_count'] = len(orig_ents)
            result['by_type'][entity_type]['revised_count'] = len(rev_ents)

            matched_indices = set()

            for orig_ent in orig_ents:
                best_match = None
                best_similarity = 0

                for j, rev_ent in enumerate(rev_ents):
                    if j in matched_indices:
                        continue

                    similarity = await self._calculate_entity_similarity(orig_ent, rev_ent)
                    if similarity > best_similarity:
                        best_similarity = similarity
                        best_match = (j, rev_ent)

                if best_match and best_similarity > 0.8:
                    j, rev_ent = best_match
                    matched_indices.add(j)

                    if orig_ent.value == rev_ent.value:
                        result['by_type'][entity_type]['unchanged'].append({
                            'value': orig_ent.value,
                            'original': orig_ent.dict(),
                            'revised': rev_ent.dict()
                        })
                        result['summary']['unchanged'] += 1
                    else:
                        result['by_type'][entity_type]['modified'].append({
                            'original_value': orig_ent.value,
                            'revised_value': rev_ent.value,
                            'original': orig_ent.dict(),
                            'revised': rev_ent.dict(),
                            'confidence_change': round(rev_ent.confidence - orig_ent.confidence, 4)
                        })
                        result['summary']['modified'] += 1
                        result['changes'].append({
                            'type': entity_type,
                            'change_type': 'modified',
                            'original_value': orig_ent.value,
                            'revised_value': rev_ent.value,
                            'original_bbox': orig_ent.bbox,
                            'revised_bbox': rev_ent.bbox
                        })
                else:
                    result['by_type'][entity_type]['deleted'].append({
                        'value': orig_ent.value,
                        'entity': orig_ent.dict()
                    })
                    result['summary']['deleted'] += 1
                    result['changes'].append({
                        'type': entity_type,
                        'change_type': 'deleted',
                        'value': orig_ent.value,
                        'bbox': orig_ent.bbox
                    })

            for j, rev_ent in enumerate(rev_ents):
                if j not in matched_indices:
                    result['by_type'][entity_type]['added'].append({
                        'value': rev_ent.value,
                        'entity': rev_ent.dict()
                    })
                    result['summary']['added'] += 1
                    result['changes'].append({
                        'type': entity_type,
                        'change_type': 'added',
                        'value': rev_ent.value,
                        'bbox': rev_ent.bbox
                    })

        result['by_type'] = dict(result['by_type'])
        return result

    async def _calculate_entity_similarity(self, ent1: Entity, ent2: Entity) -> float:
        if ent1.type != ent2.type:
            return 0.0

        value_sim = difflib.SequenceMatcher(None, ent1.value, ent2.value).ratio()

        bbox_sim = 0.0
        if ent1.bbox and ent2.bbox and len(ent1.bbox) >= 4 and len(ent2.bbox) >= 4:
            x1_overlap = max(0, min(ent1.bbox[2], ent2.bbox[2]) - max(ent1.bbox[0], ent2.bbox[0]))
            y1_overlap = max(0, min(ent1.bbox[3], ent2.bbox[3]) - max(ent1.bbox[1], ent2.bbox[1]))
            overlap = x1_overlap * y1_overlap
            area1 = (ent1.bbox[2] - ent1.bbox[0]) * (ent1.bbox[3] - ent1.bbox[1])
            area2 = (ent2.bbox[2] - ent2.bbox[0]) * (ent2.bbox[3] - ent2.bbox[1])
            union = area1 + area2 - overlap
            bbox_sim = overlap / union if union > 0 else 0

        final_sim = value_sim * 0.7 + bbox_sim * 0.3
        return final_sim

    async def generate_diff_statistics(self, diff_result: Dict) -> Dict:
        entity_changes = diff_result.get('entity_diffs', {}).get('changes', [])
        paragraph_diffs = diff_result.get('paragraph_diffs', [])

        stats = {
            'total_paragraphs': {
                'original': len([p for p in paragraph_diffs if p['original_index'] is not None]),
                'revised': len([p for p in paragraph_diffs if p['revised_index'] is not None])
            },
            'paragraph_changes': {
                'unchanged': len([p for p in paragraph_diffs if p['change_type'] == 'unchanged']),
                'inserted': len([p for p in paragraph_diffs if p['change_type'] == 'inserted']),
                'deleted': len([p for p in paragraph_diffs if p['change_type'] == 'deleted']),
                'modified': len([p for p in paragraph_diffs if p['change_type'] == 'modified'])
            },
            'entity_changes_by_type': defaultdict(lambda: {'added': 0, 'deleted': 0, 'modified': 0, 'unchanged': 0}),
            'critical_changes': []
        }

        for change in entity_changes:
            change_type = change['change_type']
            entity_type = change['type']
            stats['entity_changes_by_type'][entity_type][change_type] += 1

            if entity_type in ['AMOUNT', 'DATE', 'CONTRACT']:
                stats['critical_changes'].append({
                    'severity': 'high' if entity_type == 'AMOUNT' else 'medium',
                    **change
                })

        stats['entity_changes_by_type'] = dict(stats['entity_changes_by_type'])

        return stats

    async def export_diff_report(self, diff_result: Dict, format: str = 'json') -> str:
        if format == 'json':
            import json
            return json.dumps(diff_result, ensure_ascii=False, indent=2)
        elif format == 'html':
            return await self._generate_html_report(diff_result)
        else:
            raise ValueError(f"不支持的格式: {format}")

    async def _generate_html_report(self, diff_result: Dict) -> str:
        entity_changes = diff_result.get('entity_diffs', {}).get('changes', [])

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>文档版本对比报告</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .diff-deleted {{ background: #ffebee; color: #c62828; padding: 10px; display: block; margin: 5px 0; }}
        .diff-inserted {{ background: #e8f5e9; color: #2e7d32; padding: 10px; display: block; margin: 5px 0; }}
        .diff-deleted-inline {{ background: #ffcdd2; color: #c62828; text-decoration: line-through; }}
        .diff-inserted-inline {{ background: #c8e6c9; color: #2e7d32; }}
        .entity-change {{ padding: 10px; margin: 5px 0; border-radius: 4px; }}
        .entity-added {{ background: #e3f2fd; border-left: 4px solid #1976d2; }}
        .entity-deleted {{ background: #fbe9e7; border-left: 4px solid #d32f2f; }}
        .entity-modified {{ background: #fff3e0; border-left: 4px solid #f57c00; }}
        .stats {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }}
        .stat-card {{ padding: 15px; background: #f5f5f5; border-radius: 8px; text-align: center; }}
        .stat-value {{ font-size: 24px; font-weight: bold; }}
        h1, h2 {{ color: #333; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>文档版本对比报告</h1>
        <p><strong>原始文档:</strong> {diff_result['original_document']['filename']}</p>
        <p><strong>修订文档:</strong> {diff_result['revised_document']['filename']}</p>
        <p><strong>相似度:</strong> {diff_result['similarity_score']}%</p>
        <p><strong>对比时间:</strong> {diff_result['comparison_time']}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-value">{diff_result['entity_diffs']['summary']['added']}</div>
            <div>新增实体</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{diff_result['entity_diffs']['summary']['deleted']}</div>
            <div>删除实体</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{diff_result['entity_diffs']['summary']['modified']}</div>
            <div>修改实体</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{diff_result['total_changes']}</div>
            <div>段落变更</div>
        </div>
    </div>

    <h2>实体变更详情</h2>
"""
        for change in entity_changes:
            change_class = f'entity-{change["change_type"]}'
            change_label = {
                'added': '新增',
                'deleted': '删除',
                'modified': '修改'
            }[change['change_type']]

            if change['change_type'] == 'modified':
                html += f"""
            <div class="entity-change {change_class}">
                <strong>[{change_label}] {change['type']}</strong><br>
                原始值: {change['original_value']}<br>
                修改值: {change['revised_value']}
            </div>
                """
            else:
                html += f"""
            <div class="entity-change {change_class}">
                <strong>[{change_label}] {change['type']}</strong>: {change['value']}
            </div>
                """

        html += """
    <h2>段落变更详情</h2>
"""
        for diff in diff_result['paragraph_diffs']:
            if diff['change_type'] != 'unchanged':
                html += f"<p>{diff['content_html']}</p>"

        html += """
</body>
</html>
"""
        return html
