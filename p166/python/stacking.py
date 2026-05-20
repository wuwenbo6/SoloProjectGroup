import numpy as np


def stack_images(images, method='median'):
    if not images:
        return None
    
    stack = np.stack(images, axis=0)
    
    if method == 'median':
        result = np.median(stack, axis=0)
    elif method == 'mean':
        result = np.mean(stack, axis=0)
    elif method == 'sigma_clip':
        result = sigma_clip_stack(stack)
    else:
        result = np.median(stack, axis=0)
    
    return result


def sigma_clip_stack(stack, sigma=3, max_iterations=5):
    result = np.median(stack, axis=0)
    
    for _ in range(max_iterations):
        std = np.std(stack, axis=0)
        mean = np.mean(stack, axis=0)
        
        mask = np.abs(stack - mean) < (sigma * std)
        
        for i in range(stack.shape[1]):
            for j in range(stack.shape[2]):
                for k in range(stack.shape[3]):
                    pixel_stack = stack[:, i, j, k]
                    pixel_mask = mask[:, i, j, k]
                    if np.sum(pixel_mask) > 0:
                        result[i, j, k] = np.mean(pixel_stack[pixel_mask])
    
    return result


def apply_histogram_stretch(image, black_point=0.0, white_point=1.0, gamma=1.0):
    stretched = np.clip((image - black_point) / (white_point - black_point), 0, 1)
    
    if gamma != 1.0:
        stretched = np.power(stretched, 1.0 / gamma)
    
    return stretched


def auto_stretch(image, percentile_low=0.1, percentile_high=99.5):
    stretched = np.zeros_like(image)
    
    for i in range(image.shape[-1]):
        channel = image[..., i]
        low = np.percentile(channel, percentile_low)
        high = np.percentile(channel, percentile_high)
        
        if high > low:
            stretched[..., i] = np.clip((channel - low) / (high - low), 0, 1)
        else:
            stretched[..., i] = channel
    
    return stretched
