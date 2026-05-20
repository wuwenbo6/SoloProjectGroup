import numpy as np
from image_reader import read_image


def create_master_dark(dark_files):
    if not dark_files:
        return None
    
    dark_frames = []
    for f in dark_files:
        img = read_image(f)
        dark_frames.append(img)
    
    master_dark = np.median(np.stack(dark_frames), axis=0)
    return master_dark


def create_master_flat(flat_files, master_dark=None):
    if not flat_files:
        return None
    
    flat_frames = []
    for f in flat_files:
        img = read_image(f)
        if master_dark is not None:
            img = np.maximum(img - master_dark, 0)
        
        norm = np.mean(img)
        if norm > 0:
            img = img / norm
        
        flat_frames.append(img)
    
    master_flat = np.median(np.stack(flat_frames), axis=0)
    
    master_flat = np.where(master_flat > 0.1, master_flat, 1.0)
    
    return master_flat


def calibrate_image(image, master_dark=None, master_flat=None):
    result = image.copy()
    
    if master_dark is not None:
        if master_dark.shape == result.shape:
            result = np.maximum(result - master_dark, 0)
    
    if master_flat is not None:
        if master_flat.shape == result.shape:
            result = result / master_flat
    
    return result


def create_bias_frame(bias_files):
    if not bias_files:
        return None
    
    bias_frames = [read_image(f) for f in bias_files]
    master_bias = np.median(np.stack(bias_frames), axis=0)
    return master_bias
