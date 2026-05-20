import sys
import json
import os
import base64
import io
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from image_reader import read_image, image_to_preview
from star_detection import detect_stars, match_stars, estimate_transform, align_image
from calibration import create_master_dark, create_master_flat, calibrate_image
from stacking import stack_images, auto_stretch
from image_output import save_image


def send_message(message):
    print(json.dumps(message))
    sys.stdout.flush()


def image_to_base64(image_array):
    img = Image.fromarray(image_array)
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    return base64.b64encode(buffer.getvalue()).decode('utf-8')


def main():
    try:
        params = json.loads(sys.argv[1])
    except (IndexError, json.JSONDecodeError) as e:
        send_message({'type': 'error', 'message': f'Invalid parameters: {str(e)}'})
        return

    light_files = params.get('light_files', [])
    dark_files = params.get('dark_files', [])
    flat_files = params.get('flat_files', [])
    stack_method = params.get('stack_method', 'median')
    min_snr = params.get('min_snr', 5)
    output_path = params.get('output_path', None)

    if not light_files:
        send_message({'type': 'error', 'message': 'No light frames selected'})
        return

    try:
        send_message({'type': 'status', 'status': 'Reading first image...'})
        reference_image = read_image(light_files[0])
        reference_stars = detect_stars(reference_image, min_snr=min_snr)

        send_message({
            'type': 'reference_info',
            'stars': len(reference_stars),
            'shape': reference_image.shape
        })

        preview = image_to_preview(reference_image)
        send_message({
            'type': 'preview',
            'frame': 0,
            'total': len(light_files),
            'image': image_to_base64(preview),
            'stars': len(reference_stars)
        })

        send_message({'type': 'status', 'status': 'Creating calibration frames...'})
        master_dark = create_master_dark(dark_files) if dark_files else None
        master_flat = create_master_flat(flat_files, master_dark) if flat_files else None

        aligned_images = []
        transforms = []

        for i, light_file in enumerate(light_files):
            send_message({
                'type': 'status',
                'status': f'Processing frame {i + 1}/{len(light_files)}...'
            })

            image = read_image(light_file)
            image = calibrate_image(image, master_dark, master_flat)

            if i == 0:
                aligned = image
                transform = None
            else:
                stars = detect_stars(image, min_snr=min_snr)
                matched_ref, matched_img = match_stars(reference_stars, stars)
                
                if len(matched_ref) >= 10:
                    transform = estimate_transform(matched_ref, matched_img)
                    aligned = align_image(image, transform, reference_image.shape[:2])
                else:
                    aligned = image
                    transform = None

            aligned_images.append(aligned)
            transforms.append(transform)

            preview = image_to_preview(aligned)
            send_message({
                'type': 'preview',
                'frame': i + 1,
                'total': len(light_files),
                'image': image_to_base64(preview),
                'stars': len(stars) if i > 0 else len(reference_stars),
                'matched': len(matched_ref) if i > 0 else len(reference_stars)
            })

        send_message({
            'type': 'status',
            'status': f'Stacking {len(aligned_images)} frames ({stack_method})...'
        })

        stacked = stack_images(aligned_images, method=stack_method)
        stretched = auto_stretch(stacked)

        stacked_preview = image_to_preview(stretched)
        send_message({
            'type': 'stacked_preview',
            'image': image_to_base64(stacked_preview)
        })

        if output_path:
            send_message({'type': 'status', 'status': f'Saving to {output_path}...'})
            save_image(stacked, output_path)
            send_message({
                'type': 'complete',
                'message': f'Image saved to {output_path}',
                'output_path': output_path
            })
        else:
            send_message({
                'type': 'complete',
                'message': 'Stacking complete',
                'output_path': None
            })

    except Exception as e:
        send_message({'type': 'error', 'message': str(e)})
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()
