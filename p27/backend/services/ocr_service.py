import pytesseract
from PIL import Image
from typing import List, Dict
from loguru import logger

from config import settings


class OCRService:
    def __init__(self):
        pytesseract.pytesseract.tesseract_cmd = settings.tesseract_cmd
        self.lang = settings.tesseract_lang
        logger.info(f"OCR服务初始化完成，使用语言: {self.lang}")

    async def extract_text_with_layout(self, image: Image.Image) -> Dict:
        try:
            ocr_data = pytesseract.image_to_data(
                image,
                lang=self.lang,
                output_type=pytesseract.Output.DICT
            )

            words = []
            full_text = ""
            width, height = image.size

            for i in range(len(ocr_data['text'])):
                text = ocr_data['text'][i].strip()
                if text and ocr_data['conf'][i] > 0:
                    left = ocr_data['left'][i]
                    top = ocr_data['top'][i]
                    w = ocr_data['width'][i]
                    h = ocr_data['height'][i]

                    normalized_bbox = [
                        left / width,
                        top / height,
                        (left + w) / width,
                        (top + h) / height
                    ]

                    words.append({
                        'text': text,
                        'bbox': normalized_bbox,
                        'confidence': ocr_data['conf'][i] / 100.0,
                        'block_num': ocr_data['block_num'][i],
                        'line_num': ocr_data['line_num'][i],
                        'word_num': ocr_data['word_num'][i]
                    })
                    full_text += text + " "

            words_sorted = sorted(words, key=lambda x: (x['block_num'], x['line_num'], x['word_num']))

            result = {
                'text': full_text.strip(),
                'words': words_sorted,
                'width': width,
                'height': height
            }

            logger.info(f"OCR识别完成，共识别 {len(words_sorted)} 个词")
            return result

        except Exception as e:
            logger.error(f"OCR识别失败: {str(e)}")
            raise

    async def extract_text_simple(self, image: Image.Image) -> str:
        try:
            text = pytesseract.image_to_string(
                image,
                lang=self.lang
            )
            return text.strip()
        except Exception as e:
            logger.error(f"简单OCR识别失败: {str(e)}")
            raise

    @staticmethod
    def preprocess_image(image: Image.Image) -> Image.Image:
        if image.mode != 'RGB':
            image = image.convert('RGB')

        return image
