import os
import uuid
import asyncio
import numpy as np
from typing import Dict, Any
try:
    from PIL import Image, ImageEnhance, ImageFilter, ImageOps, ImageDraw, ImageChops
except ImportError:
    Image = None


class PhotoRepairService:
    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        self.repaired_dir = os.path.join(upload_dir, "repaired")
        self.thumbnail_dir = os.path.join(upload_dir, "thumbnails")
        os.makedirs(self.repaired_dir, exist_ok=True)
        os.makedirs(self.thumbnail_dir, exist_ok=True)

    def auto_contrast(self, img: Image.Image, cutoff: float = 0.5) -> Image.Image:
        return ImageOps.autocontrast(img, cutoff=cutoff)

    def apply_color_correction(self, img: Image.Image) -> Image.Image:
        img = self.auto_contrast(img, cutoff=1)
        
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(1.4)
        
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.15)
        
        enhancer = ImageEnhance.Brightness(img)
        img = enhancer.enhance(1.05)
        
        return img

    def remove_scratches(self, img: Image.Image) -> Image.Image:
        img_denoised = img.filter(ImageFilter.MedianFilter(size=2))
        
        detail_layer = ImageChops.subtract(img, img_denoised)
        
        enhancer = ImageEnhance.Sharpness(detail_layer)
        detail_layer = enhancer.enhance(2.0)
        
        img = ImageChops.add(img_denoised, detail_layer)
        
        img = img.filter(ImageFilter.UnsharpMask(radius=2, percent=150, threshold=2))
        
        return img

    def enhance_details(self, img: Image.Image) -> Image.Image:
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.6)
        
        img = img.filter(ImageFilter.EDGE_ENHANCE_MORE)
        
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.05)
        
        return img

    def reduce_noise(self, img: Image.Image) -> Image.Image:
        img = img.filter(ImageFilter.SMOOTH)
        img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
        return img

    def fade_restoration(self, img: Image.Image) -> Image.Image:
        r, g, b = img.split()
        
        r = ImageEnhance.Brightness(r).enhance(1.1)
        b = ImageEnhance.Brightness(b).enhance(1.05)
        
        img = Image.merge("RGB", (r, g, b))
        
        enhancer = ImageEnhance.Color(img)
        img = enhancer.enhance(1.2)
        
        return img

    def apply_film_grain(self, img: Image.Image, intensity: float = 0.3) -> Image.Image:
        np_img = np.array(img)
        noise = np.random.normal(0, 255 * intensity, np_img.shape)
        noisy_img = np.clip(np_img + noise, 0, 255).astype(np.uint8)
        return Image.fromarray(noisy_img)

    def apply_vintage_color(self, img: Image.Image, style: str = "classic") -> Image.Image:
        img_array = np.array(img).astype(float)
        
        if style == "classic":
            img_array[..., 0] *= 1.1
            img_array[..., 1] *= 1.05
            img_array[..., 2] *= 0.9
        elif style == "sepia":
            r, g, b = img_array[..., 0], img_array[..., 1], img_array[..., 2]
            tr = 0.393 * r + 0.769 * g + 0.189 * b
            tg = 0.349 * r + 0.686 * g + 0.168 * b
            tb = 0.272 * r + 0.534 * g + 0.131 * b
            img_array[..., 0] = tr
            img_array[..., 1] = tg
            img_array[..., 2] = tb
        elif style == "warm":
            img_array[..., 0] *= 1.15
            img_array[..., 1] *= 1.05
            img_array[..., 2] *= 0.85
        elif style == "cool":
            img_array[..., 0] *= 0.9
            img_array[..., 1] *= 1.0
            img_array[..., 2] *= 1.15
        
        img_array = np.clip(img_array, 0, 255).astype(np.uint8)
        return Image.fromarray(img_array)

    def apply_vignette(self, img: Image.Image, intensity: float = 0.3) -> Image.Image:
        width, height = img.size
        mask = Image.new('L', (width, height), 255)
        draw = ImageDraw.Draw(mask)
        
        for i in range(int(max(width, height) * 0.7)):
            alpha = int(255 * (1 - intensity) * (1 - i / (max(width, height) * 0.7)))
            draw.ellipse(
                [i, i, width - i, height - i],
                fill=alpha
            )
        
        img_rgb = img.convert('RGB')
        darkened = ImageEnhance.Brightness(img_rgb).enhance(1 - intensity)
        result = Image.composite(img_rgb, darkened, mask)
        return result

    def apply_soft_focus(self, img: Image.Image, strength: float = 0.5) -> Image.Image:
        blurred = img.filter(ImageFilter.GaussianBlur(radius=strength * 2))
        return Image.blend(img, blurred, strength * 0.3)

    def apply_retro_border(self, img: Image.Image, border_width: int = 20) -> Image.Image:
        width, height = img.size
        border_color = (245, 240, 230)
        
        new_width = width + 2 * border_width
        new_height = height + 2 * border_width
        bordered = Image.new('RGB', (new_width, new_height), border_color)
        bordered.paste(img, (border_width, border_width))
        
        draw = ImageDraw.Draw(bordered)
        for i in range(3):
            draw.rectangle(
                [border_width - i, border_width - i, 
                 new_width - border_width + i, new_height - border_width + i],
                outline=(200 - i * 20, 190 - i * 20, 175 - i * 20)
            )
        
        return bordered

    def apply_film_style(
        self,
        img: Image.Image,
        style: str = "classic",
        grain: float = 0.2,
        vignette: float = 0.2,
        soft_focus: bool = False,
        border: bool = False
    ) -> Image.Image:
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img = self.apply_vintage_color(img, style)
        
        if grain > 0:
            img = self.apply_film_grain(img, grain)
        
        if vignette > 0:
            img = self.apply_vignette(img, vignette)
        
        if soft_focus:
            img = self.apply_soft_focus(img, 0.5)
        
        if border:
            img = self.apply_retro_border(img, 25)
        
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(1.1)
        
        enhancer = ImageEnhance.Sharpness(img)
        img = enhancer.enhance(1.05)
        
        return img

    async def apply_film_style_async(
        self,
        original_path: str,
        style: str = "classic",
        grain: float = 0.2,
        vignette: float = 0.2,
        soft_focus: bool = False,
        border: bool = False
    ) -> str:
        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(None, Image.open, original_path)
        
        img = await loop.run_in_executor(
            None,
            self.apply_film_style,
            img, style, grain, vignette, soft_focus, border
        )
        
        filename = f"film_{style}_{uuid.uuid4()}.jpg"
        output_path = os.path.join(self.upload_dir, "repaired", filename)
        
        await loop.run_in_executor(None, lambda: img.save(output_path, quality=95, optimize=True))
        return output_path

    async def repair_photo(
        self,
        original_path: str,
        repair_type: str = "full",
        parameters: Dict[str, Any] = None
    ) -> tuple[str, str]:
        parameters = parameters or {}
        
        loop = asyncio.get_event_loop()
        img = await loop.run_in_executor(None, Image.open, original_path)
        
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        img = ImageOps.exif_transpose(img)
        
        if repair_type in ["full", "denoise"]:
            img = await loop.run_in_executor(None, self.reduce_noise, img)
        
        if repair_type in ["full", "scratch"]:
            img = await loop.run_in_executor(None, self.remove_scratches, img)
        
        if repair_type in ["full", "color"]:
            img = await loop.run_in_executor(None, self.fade_restoration, img)
            img = await loop.run_in_executor(None, self.apply_color_correction, img)
        
        if repair_type in ["full", "enhance"]:
            img = await loop.run_in_executor(None, self.enhance_details, img)
        
        filename = f"{uuid.uuid4()}.jpg"
        repaired_path = os.path.join(self.repaired_dir, filename)
        thumbnail_path = os.path.join(self.thumbnail_dir, filename)
        
        await loop.run_in_executor(None, lambda: img.save(repaired_path, quality=95, optimize=True))
        
        thumbnail_size = parameters.get("thumbnail_size", 300)
        img.thumbnail((thumbnail_size, thumbnail_size), Image.Resampling.LANCZOS)
        await loop.run_in_executor(None, lambda: img.save(thumbnail_path, quality=85, optimize=True))
        
        return repaired_path, thumbnail_path


try:
    from PIL import ImageChops
except ImportError:
    class ImageChops:
        @staticmethod
        def subtract(img1, img2):
            return img1
        @staticmethod
        def add(img1, img2):
            return img1


repair_service = PhotoRepairService(
    os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
)
