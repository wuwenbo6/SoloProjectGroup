import torch
import numpy as np
from typing import List, Dict, Tuple, Optional
from loguru import logger
from PIL import Image
from transformers import (
    DetrFeatureExtractor,
    TableTransformerForObjectDetection
)
import cv2


class TableDetector:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"表格检测使用设备: {self.device}")

        self.feature_extractor = DetrFeatureExtractor()
        self.table_model = TableTransformerForObjectDetection.from_pretrained(
            "microsoft/table-transformer-detection"
        ).to(self.device)

        self.structure_model = TableTransformerForObjectDetection.from_pretrained(
            "microsoft/table-transformer-structure-recognition"
        ).to(self.device)

        self.table_class_labels = ["table"]
        self.structure_class_labels = [
            "table", "table column", "table row", "table column header",
            "table projected row header", "table spanning cell"
        ]

        logger.info("Table Transformer 模型加载完成")

    async def detect_tables(self, image: Image.Image) -> List[Dict]:
        try:
            encoding = self.feature_extractor(images=image, return_tensors="pt").to(self.device)

            with torch.no_grad():
                outputs = self.table_model(**encoding)

            target_sizes = torch.tensor([image.size[::-1]])
            results = self.feature_extractor.post_process_object_detection(
                outputs, threshold=0.7, target_sizes=target_sizes
            )[0]

            tables = []
            for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
                if label.item() < len(self.table_class_labels):
                    box = box.tolist()
                    tables.append({
                        "bbox": box,
                        "confidence": score.item(),
                        "label": self.table_class_labels[label.item()]
                    })

            tables = sorted(tables, key=lambda x: x["bbox"][1])

            logger.info(f"检测到 {len(tables)} 个表格")
            return tables

        except Exception as e:
            logger.error(f"表格检测失败: {str(e)}")
            return []

    async def recognize_table_structure(self, table_image: Image.Image) -> Dict:
        try:
            encoding = self.feature_extractor(images=table_image, return_tensors="pt").to(self.device)

            with torch.no_grad():
                outputs = self.structure_model(**encoding)

            target_sizes = torch.tensor([table_image.size[::-1]])
            results = self.feature_extractor.post_process_object_detection(
                outputs, threshold=0.7, target_sizes=target_sizes
            )[0]

            rows = []
            columns = []
            cells = []

            for score, label, box in zip(results["scores"], results["labels"], results["boxes"]):
                label_idx = label.item()
                if label_idx < len(self.structure_class_labels):
                    label_name = self.structure_class_labels[label_idx]
                    box = box.tolist()

                    if "row" in label_name and "header" not in label_name:
                        rows.append({"bbox": box, "confidence": score.item(), "type": label_name})
                    elif "column" in label_name and "header" not in label_name:
                        columns.append({"bbox": box, "confidence": score.item(), "type": label_name})
                    elif "cell" in label_name:
                        cells.append({"bbox": box, "confidence": score.item(), "type": label_name})

            rows = sorted(rows, key=lambda x: x["bbox"][1])
            columns = sorted(columns, key=lambda x: x["bbox"][0])

            return {
                "rows": rows,
                "columns": columns,
                "cells": cells,
                "row_count": len(rows),
                "column_count": len(columns)
            }

        except Exception as e:
            logger.error(f"表格结构识别失败: {str(e)}")
            return {"rows": [], "columns": [], "cells": [], "row_count": 0, "column_count": 0}

    async def assign_words_to_cells(
        self,
        words: List[Dict],
        table_bbox: List[float],
        table_structure: Dict,
        image_size: Tuple[int, int]
    ) -> Dict:
        img_width, img_height = image_size

        table_x1, table_y1, table_x2, table_y2 = table_bbox
        table_width = table_x2 - table_x1
        table_height = table_y2 - table_y1

        rows = table_structure["rows"]
        columns = table_structure["columns"]

        cell_grid = {}
        for row_idx, row in enumerate(rows):
            for col_idx, col in enumerate(columns):
                cell_key = f"{row_idx}_{col_idx}"
                cell_grid[cell_key] = {
                    "row_idx": row_idx,
                    "col_idx": col_idx,
                    "words": [],
                    "bbox": [
                        col["bbox"][0] + table_x1,
                        row["bbox"][1] + table_y1,
                        col["bbox"][2] + table_x1,
                        row["bbox"][3] + table_y1
                    ]
                }

        table_words = []
        for word in words:
            word_center_x = (word["bbox"][0] + word["bbox"][2]) / 2 * img_width
            word_center_y = (word["bbox"][1] + word["bbox"][3]) / 2 * img_height

            if (table_x1 <= word_center_x <= table_x2 and
                table_y1 <= word_center_y <= table_y2):
                table_words.append(word)

                word_rel_y = word_center_y - table_y1
                word_rel_x = word_center_x - table_x1

                row_idx = self._find_row_index(word_rel_y, rows)
                col_idx = self._find_column_index(word_rel_x, columns)

                if row_idx is not None and col_idx is not None:
                    cell_key = f"{row_idx}_{col_idx}"
                    if cell_key in cell_grid:
                        cell_grid[cell_key]["words"].append(word)

        return {
            "cell_grid": cell_grid,
            "table_words": table_words,
            "row_count": len(rows),
            "column_count": len(columns)
        }

    def _find_row_index(self, y_pos: float, rows: List[Dict]) -> Optional[int]:
        for idx, row in enumerate(rows):
            row_y1, row_y2 = row["bbox"][1], row["bbox"][3]
            if row_y1 <= y_pos <= row_y2:
                return idx
            if idx > 0 and y_pos < (rows[idx-1]["bbox"][3] + row_y1) / 2:
                return idx-1
        return len(rows) - 1 if rows else None

    def _find_column_index(self, x_pos: float, columns: List[Dict]) -> Optional[int]:
        for idx, col in enumerate(columns):
            col_x1, col_x2 = col["bbox"][0], col["bbox"][2]
            if col_x1 <= x_pos <= col_x2:
                return idx
            if idx > 0 and x_pos < (columns[idx-1]["bbox"][2] + col_x1) / 2:
                return idx-1
        return len(columns) - 1 if columns else None

    async def extract_table_text_grid(self, table_data: Dict) -> List[List[str]]:
        cell_grid = table_data["cell_grid"]
        row_count = table_data["row_count"]
        col_count = table_data["column_count"]

        text_grid = [["" for _ in range(col_count)] for _ in range(row_count)]

        for cell_key, cell_data in cell_grid.items():
            row_idx = cell_data["row_idx"]
            col_idx = cell_data["col_idx"]

            words_sorted = sorted(cell_data["words"], key=lambda x: x["word_num"])
            cell_text = " ".join([w["text"] for w in words_sorted])

            if 0 <= row_idx < row_count and 0 <= col_idx < col_count:
                text_grid[row_idx][col_idx] = cell_text

        return text_grid

    async def process_image_with_tables(
        self,
        image: Image.Image,
        ocr_result: Dict
    ) -> Dict:
        words = ocr_result["words"]
        image_size = (ocr_result["width"], ocr_result["height"])

        tables = await self.detect_tables(image)

        processed_tables = []
        non_table_words = words.copy()

        for table_idx, table in enumerate(tables):
            table_bbox = table["bbox"]

            table_cropped = image.crop(table_bbox)
            table_structure = await self.recognize_table_structure(table_cropped)

            table_data = await self.assign_words_to_cells(
                words, table_bbox, table_structure, image_size
            )

            text_grid = await self.extract_table_text_grid(table_data)

            for word in table_data["table_words"]:
                if word in non_table_words:
                    non_table_words.remove(word)

            processed_tables.append({
                "table_idx": table_idx,
                "table_bbox": table_bbox,
                "structure": table_structure,
                "cell_grid": table_data["cell_grid"],
                "text_grid": text_grid,
                "words": table_data["table_words"]
            })

        logger.info(f"表格处理完成: {len(processed_tables)} 个表格, {len(non_table_words)} 个非表格词")

        return {
            "tables": processed_tables,
            "non_table_words": non_table_words,
            "original_words": words
        }
