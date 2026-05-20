import numpy as np
from PIL import Image
import tifffile
import os


def save_image(image, output_path, file_format='tiff', bit_depth=16):
    ext = os.path.splitext(output_path)[1].lower()
    if ext in ['.tiff', '.tif']:
        file_format = 'tiff'
    elif ext == '.png':
        file_format = 'png'
    
    image_normalized = normalize_for_output(image)
    
    if file_format == 'tiff':
        save_tiff(image_normalized, output_path, bit_depth)
    else:
        save_png(image_normalized, output_path, bit_depth)
    
    return output_path


def normalize_for_output(image):
    normalized = np.zeros_like(image)
    
    for i in range(image.shape[-1]):
        channel = image[..., i]
        min_val = np.min(channel)
        max_val = np.max(channel)
        
        if max_val > min_val:
            normalized[..., i] = (channel - min_val) / (max_val - min_val)
        else:
            normalized[..., i] = 0.5
    
    return normalized


def save_tiff(image, output_path, bit_depth=16):
    if bit_depth == 16:
        data = (image * 65535).astype(np.uint16)
    else:
        data = (image * 255).astype(np.uint8)
    
    tifffile.imwrite(output_path, data)


def save_png(image, output_path, bit_depth=16):
    if bit_depth == 16:
        data = (image * 65535).astype(np.uint16)
        mode = 'RGB'
    else:
        data = (image * 255).astype(np.uint8)
        mode = 'RGB'
    
    img = Image.fromarray(data, mode=mode)
    img.save(output_path, 'PNG')


def save_preview(image, output_path, max_size=1024):
    from image_reader import normalize_image, image_to_preview
    preview = image_to_preview(image, max_size)
    img = Image.fromarray(preview)
    img.save(output_path, 'PNG')
    return output_path
