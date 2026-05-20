import numpy as np
from astropy.io import fits
import rawpy
from PIL import Image
import os


def read_image(file_path):
    ext = os.path.splitext(file_path)[1].lower()
    
    if ext in ['.fits', '.fit', '.fts']:
        return read_fits(file_path)
    elif ext in ['.raw', '.cr2', '.nef', '.arw', '.dng']:
        return read_raw(file_path)
    else:
        return read_generic(file_path)


def read_fits(file_path):
    with fits.open(file_path) as hdul:
        data = hdul[0].data.astype(np.float32)
        if data.ndim == 2:
            data = np.stack([data, data, data], axis=-1)
        elif data.ndim == 3:
            if data.shape[0] in [1, 3]:
                data = np.transpose(data, (1, 2, 0))
            if data.shape[-1] == 1:
                data = np.concatenate([data, data, data], axis=-1)
        return data


def read_raw(file_path):
    with rawpy.imread(file_path) as raw:
        rgb = raw.postprocess(
            output_bps=16,
            no_auto_bright=True,
            output_color=rawpy.ColorSpace.sRGB,
            gamma=(1, 1)
        )
    return rgb.astype(np.float32)


def read_generic(file_path):
    img = Image.open(file_path)
    data = np.array(img, dtype=np.float32)
    if data.ndim == 2:
        data = np.stack([data, data, data], axis=-1)
    elif data.shape[-1] == 4:
        data = data[..., :3]
    return data


def normalize_image(image, percentile_low=0.1, percentile_high=99.9):
    normalized = np.zeros_like(image)
    for i in range(image.shape[-1]):
        channel = image[..., i]
        low = np.percentile(channel, percentile_low)
        high = np.percentile(channel, percentile_high)
        if high > low:
            normalized[..., i] = np.clip((channel - low) / (high - low), 0, 1)
    return normalized


def image_to_preview(image, max_size=800):
    normalized = normalize_image(image)
    h, w = normalized.shape[:2]
    scale = min(max_size / h, max_size / w)
    if scale < 1:
        new_h, new_w = int(h * scale), int(w * scale)
        from PIL import Image as PILImage
        pil_img = PILImage.fromarray((normalized * 255).astype(np.uint8))
        pil_img = pil_img.resize((new_w, new_h), PILImage.LANCZOS)
        normalized = np.array(pil_img) / 255.0
    return (normalized * 255).astype(np.uint8)
