import os
import uuid
from pathlib import Path
from typing import List
from loguru import logger
from fastapi import UploadFile
import aiofiles
from pypdf import PdfReader
from pdf2image import convert_from_path
from PIL import Image

from config import settings


class DocumentParser:
    def __init__(self):
        self.upload_dir = Path(settings.upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def save_upload_file(self, file: UploadFile) -> str:
        file_ext = file.filename.split(".")[-1].lower()
        file_id = str(uuid.uuid4())
        save_filename = f"{file_id}.{file_ext}"
        save_path = self.upload_dir / save_filename

        async with aiofiles.open(save_path, 'wb') as out_file:
            content = await file.read()
            await out_file.write(content)

        logger.info(f"文件已保存: {save_path}")
        return str(save_path)

    async def convert_to_images(self, file_path: str) -> List[Image.Image]:
        file_ext = file_path.split(".")[-1].lower()

        if file_ext == "pdf":
            return await self._pdf_to_images(file_path)
        elif file_ext in ["png", "jpg", "jpeg", "tiff"]:
            return await self._image_to_images(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_ext}")

    async def _pdf_to_images(self, pdf_path: str) -> List[Image.Image]:
        try:
            images = convert_from_path(
                pdf_path,
                dpi=300,
                fmt="png",
                thread_count=4
            )
            logger.info(f"PDF转换完成，共 {len(images)} 页")
            return images
        except Exception as e:
            logger.error(f"PDF转换失败: {str(e)}")
            raise

    async def _image_to_images(self, image_path: str) -> List[Image.Image]:
        try:
            img = Image.open(image_path)
            if img.mode != "RGB":
                img = img.convert("RGB")
            logger.info(f"图片加载完成")
            return [img]
        except Exception as e:
            logger.error(f"图片加载失败: {str(e)}")
            raise

    async def extract_text_from_pdf(self, pdf_path: str) -> str:
        try:
            reader = PdfReader(pdf_path)
            text = ""
            for page in reader.pages:
                text += page.extract_text() + "\n"
            return text
        except Exception as e:
            logger.error(f"PDF文本提取失败: {str(e)}")
            raise

    @staticmethod
    def get_file_size(file_path: str) -> int:
        return os.path.getsize(file_path)
