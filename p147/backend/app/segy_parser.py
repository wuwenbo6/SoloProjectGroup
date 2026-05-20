import segyio
import numpy as np
import os
from typing import Dict, List, Tuple, Optional, Generator
from dataclasses import dataclass
from scipy import ndimage
from scipy.ndimage import sobel, gaussian_filter
import warnings
warnings.filterwarnings('ignore')


@dataclass
class SegyInfo:
    filename: str
    file_size: int
    sample_count: int
    trace_count: int
    inline_count: int
    crossline_count: int
    sample_interval: float
    min_amplitude: float
    max_amplitude: float
    mean_amplitude: float
    std_amplitude: float
    inlines: List[int]
    crosslines: List[int]


class SegyParser:
    CHUNK_SIZE = 1000

    def __init__(self, upload_dir: str):
        self.upload_dir = upload_dir
        os.makedirs(upload_dir, exist_ok=True)

    def _iter_traces_chunk(self, segy_file, chunk_size: int = None) -> Generator[np.ndarray, None, None]:
        if chunk_size is None:
            chunk_size = self.CHUNK_SIZE
        total_traces = segy_file.tracecount
        for i in range(0, total_traces, chunk_size):
            end_idx = min(i + chunk_size, total_traces)
            yield segy_file.trace.raw[i:end_idx]

    def parse_file(self, file_path: str) -> SegyInfo:
        with segyio.open(file_path, 'r', strict=False) as segy:
            sample_count = segy.samples.size
            trace_count = segy.tracecount
            sample_interval = segy.bin[segyio.BinField.Interval] / 1000.0
            
            min_amp = np.inf
            max_amp = -np.inf
            sum_amp = 0.0
            sum_sq_amp = 0.0
            count = 0
            
            for chunk in self._iter_traces_chunk(segy):
                chunk_min = np.min(chunk)
                chunk_max = np.max(chunk)
                chunk_sum = np.sum(chunk)
                chunk_sum_sq = np.sum(chunk ** 2)
                chunk_count = chunk.size
                
                min_amp = min(min_amp, chunk_min)
                max_amp = max(max_amp, chunk_max)
                sum_amp += chunk_sum
                sum_sq_amp += chunk_sum_sq
                count += chunk_count
            
            mean_amp = sum_amp / count
            var_amp = (sum_sq_amp / count) - (mean_amp ** 2)
            std_amp = np.sqrt(max(0, var_amp))
            
            inlines = sorted(list(set(segy.attributes(segyio.TraceField.INLINE_3D)[:])))
            crosslines = sorted(list(set(segy.attributes(segyio.TraceField.CROSSLINE_3D)[:])))
            
            inline_count = len(inlines)
            crossline_count = len(crosslines)
            
            file_size = os.path.getsize(file_path)
            filename = os.path.basename(file_path)
            
            return SegyInfo(
                filename=filename,
                file_size=file_size,
                sample_count=sample_count,
                trace_count=trace_count,
                inline_count=inline_count,
                crossline_count=crossline_count,
                sample_interval=sample_interval,
                min_amplitude=float(min_amp),
                max_amplitude=float(max_amp),
                mean_amplitude=float(mean_amp),
                std_amplitude=float(std_amp),
                inlines=inlines,
                crosslines=crosslines
            )

    def get_volume_data(self, file_path: str, max_size: int = 256) -> Dict:
        with segyio.open(file_path, 'r', strict=False) as segy:
            sample_count = segy.samples.size
            inlines = sorted(list(set(segy.attributes(segyio.TraceField.INLINE_3D)[:])))
            crosslines = sorted(list(set(segy.attributes(segyio.TraceField.CROSSLINE_3D)[:])))
            
            orig_shape = (len(inlines), len(crosslines), sample_count)
            
            inline_step = max(1, orig_shape[0] // max_size)
            crossline_step = max(1, orig_shape[1] // max_size)
            time_step = max(1, orig_shape[2] // max_size)
            
            new_shape = (
                (orig_shape[0] + inline_step - 1) // inline_step,
                (orig_shape[1] + crossline_step - 1) // crossline_step,
                (orig_shape[2] + time_step - 1) // time_step
            )
            
            downsampled_cube = np.zeros(new_shape, dtype=np.float32)
            
            for i, inline_idx in enumerate(range(0, len(inlines), inline_step)):
                inline_num = inlines[inline_idx]
                inline_data = np.array(segy.iline[inline_num], dtype=np.float32)
                
                for j, crossline_idx in enumerate(range(0, inline_data.shape[0], crossline_step)):
                    if j >= new_shape[1]:
                        continue
                    trace = inline_data[crossline_idx]
                    for k, time_idx in enumerate(range(0, len(trace), time_step)):
                        if k < new_shape[2]:
                            downsampled_cube[i, j, k] = trace[time_idx]
            
            gradient_mag = self._compute_gradient_magnitude(downsampled_cube)
            
            return {
                'shape': list(new_shape),
                'orig_shape': list(orig_shape),
                'data': downsampled_cube.flatten().tolist(),
                'gradient': gradient_mag.flatten().tolist(),
                'min_amplitude': float(np.min(downsampled_cube)),
                'max_amplitude': float(np.max(downsampled_cube))
            }

    def _compute_gradient_magnitude(self, cube: np.ndarray) -> np.ndarray:
        grad_x = np.gradient(cube, axis=0)
        grad_y = np.gradient(cube, axis=1)
        grad_z = np.gradient(cube, axis=2)
        
        gradient_mag = np.sqrt(grad_x ** 2 + grad_y ** 2 + grad_z ** 2)
        
        grad_min = np.min(gradient_mag)
        grad_max = np.max(gradient_mag)
        if grad_max > grad_min:
            gradient_mag = (gradient_mag - grad_min) / (grad_max - grad_min)
        
        return gradient_mag.astype(np.float32)

    def get_inline_slice(self, file_path: str, inline_idx: int) -> np.ndarray:
        with segyio.open(file_path, 'r', strict=False) as segy:
            inlines = sorted(list(set(segy.attributes(segyio.TraceField.INLINE_3D)[:])))
            if inline_idx < 0 or inline_idx >= len(inlines):
                raise ValueError(f"Inline index {inline_idx} out of range")
            inline_num = inlines[inline_idx]
            slice_data = segy.iline[inline_num]
            return np.array(slice_data, dtype=np.float32)

    def get_crossline_slice(self, file_path: str, crossline_idx: int) -> np.ndarray:
        with segyio.open(file_path, 'r', strict=False) as segy:
            crosslines = sorted(list(set(segy.attributes(segyio.TraceField.CROSSLINE_3D)[:])))
            if crossline_idx < 0 or crossline_idx >= len(crosslines):
                raise ValueError(f"Crossline index {crossline_idx} out of range")
            crossline_num = crosslines[crossline_idx]
            slice_data = segy.xline[crossline_num]
            return np.array(slice_data, dtype=np.float32)

    def get_timeslice(self, file_path: str, time_idx: int) -> np.ndarray:
        with segyio.open(file_path, 'r', strict=False) as segy:
            inlines = sorted(list(set(segy.attributes(segyio.TraceField.INLINE_3D)[:])))
            crosslines = sorted(list(set(segy.attributes(segyio.TraceField.CROSSLINE_3D)[:])))
            
            result = np.zeros((len(inlines), len(crosslines)), dtype=np.float32)
            
            for i, inline_num in enumerate(inlines):
                inline_data = np.array(segy.iline[inline_num], dtype=np.float32)
                if time_idx < inline_data.shape[1]:
                    result[i, :] = inline_data[:, time_idx]
            
            return result

    def get_amplitude_histogram(
        self, 
        file_path: str, 
        bins: int = 100,
        min_amp: Optional[float] = None,
        max_amp: Optional[float] = None
    ) -> Dict:
        with segyio.open(file_path, 'r', strict=False) as segy:
            if min_amp is None or max_amp is None:
                local_min = np.inf
                local_max = -np.inf
                for chunk in self._iter_traces_chunk(segy):
                    local_min = min(local_min, np.min(chunk))
                    local_max = max(local_max, np.max(chunk))
                if min_amp is None:
                    min_amp = local_min
                if max_amp is None:
                    max_amp = local_max
            
            hist = np.zeros(bins, dtype=np.int64)
            bin_edges = np.linspace(min_amp, max_amp, bins + 1)
            
            for chunk in self._iter_traces_chunk(segy):
                chunk_clipped = np.clip(chunk, min_amp, max_amp)
                chunk_hist, _ = np.histogram(chunk_clipped, bins=bin_edges)
                hist += chunk_hist
            
            return {
                'histogram': hist.tolist(),
                'bin_edges': bin_edges.tolist(),
                'min_amplitude': float(min_amp),
                'max_amplitude': float(max_amp),
                'bin_count': bins
            }

    def get_trace(self, file_path: str, trace_idx: int) -> Dict:
        with segyio.open(file_path, 'r', strict=False) as segy:
            if trace_idx < 0 or trace_idx >= segy.tracecount:
                raise ValueError(f"Trace index {trace_idx} out of range")
            
            trace_data = segy.trace[trace_idx]
            header = {
                'INLINE_3D': int(segy.attributes(segyio.TraceField.INLINE_3D)[trace_idx]),
                'CROSSLINE_3D': int(segy.attributes(segyio.TraceField.CROSSLINE_3D)[trace_idx]),
                'CDP_X': float(segy.attributes(segyio.TraceField.CDP_X)[trace_idx]),
                'CDP_Y': float(segy.attributes(segyio.TraceField.CDP_Y)[trace_idx])
            }
            
            return {
                'trace_index': trace_idx,
                'header': header,
                'samples': trace_data.tolist()
            }

    def _gaussian_kernel(self, size: int, sigma: float) -> np.ndarray:
        x, y = np.mgrid[-size//2 + 1:size//2 + 1, -size//2 + 1:size//2 + 1]
        g = np.exp(-((x**2 + y**2)/(2.0*sigma**2)))
        return g / g.sum()

    def _non_max_suppression(self, gradient_mag: np.ndarray, gradient_dir: np.ndarray) -> np.ndarray:
        M, N = gradient_mag.shape
        Z = np.zeros((M, N), dtype=np.float32)
        angle = gradient_dir * 180. / np.pi
        angle[angle < 0] += 180

        for i in range(1, M-1):
            for j in range(1, N-1):
                q, r = 255, 255
                if (0 <= angle[i,j] < 22.5) or (157.5 <= angle[i,j] <= 180):
                    q = gradient_mag[i, j+1]
                    r = gradient_mag[i, j-1]
                elif 22.5 <= angle[i,j] < 67.5:
                    q = gradient_mag[i+1, j+1]
                    r = gradient_mag[i-1, j-1]
                elif 67.5 <= angle[i,j] < 112.5:
                    q = gradient_mag[i+1, j]
                    r = gradient_mag[i-1, j]
                elif 112.5 <= angle[i,j] < 157.5:
                    q = gradient_mag[i-1, j+1]
                    r = gradient_mag[i+1, j-1]

                if gradient_mag[i,j] >= q and gradient_mag[i,j] >= r:
                    Z[i,j] = gradient_mag[i,j]
        return Z

    def _hysteresis_thresholding(self, img: np.ndarray, low_threshold: float, high_threshold: float) -> np.ndarray:
        M, N = img.shape
        result = np.zeros((M, N), dtype=np.int32)
        
        strong_i, strong_j = np.where(img >= high_threshold)
        weak_i, weak_j = np.where((img <= high_threshold) & (img >= low_threshold))
        
        result[strong_i, strong_j] = 255
        result[weak_i, weak_j] = 75
        
        for i in range(1, M-1):
            for j in range(1, N-1):
                if result[i,j] == 75:
                    if 255 in [result[i+1, j-1], result[i+1, j], result[i+1, j+1],
                               result[i, j-1], result[i, j+1],
                               result[i-1, j-1], result[i-1, j], result[i-1, j+1]]:
                        result[i,j] = 255
                    else:
                        result[i,j] = 0
        return result

    def detect_faults_canny(
        self,
        file_path: str,
        slice_type: str = 'inline',
        slice_index: int = 0,
        low_threshold: float = 0.1,
        high_threshold: float = 0.3,
        sigma: float = 1.5
    ) -> Dict:
        if slice_type == 'inline':
            image = self.get_inline_slice(file_path, slice_index)
        elif slice_type == 'crossline':
            image = self.get_crossline_slice(file_path, slice_index)
        elif slice_type == 'timeslice':
            image = self.get_timeslice(file_path, slice_index)
        else:
            raise ValueError(f"Invalid slice type: {slice_type}")

        img_normalized = (image - np.min(image)) / (np.max(image) - np.min(image) + 1e-8)
        
        img_smoothed = gaussian_filter(img_normalized, sigma=sigma)
        
        dx = sobel(img_smoothed, axis=0)
        dy = sobel(img_smoothed, axis=1)
        
        gradient_mag = np.sqrt(dx**2 + dy**2)
        gradient_dir = np.arctan2(dy, dx)
        
        nms = self._non_max_suppression(gradient_mag, gradient_dir)
        
        edges = self._hysteresis_thresholding(nms, low_threshold, high_threshold)
        
        edge_points = np.argwhere(edges > 0)
        
        return {
            'slice_type': slice_type,
            'slice_index': slice_index,
            'shape': list(image.shape),
            'edges': edges.astype(np.int32).tolist(),
            'edge_points': edge_points.tolist(),
            'edge_count': len(edge_points),
            'gradient_magnitude': gradient_mag.tolist()
        }

    def _region_growing(
        self,
        image: np.ndarray,
        seed_point: Tuple[int, int],
        similarity_threshold: float,
        min_amplitude: Optional[float] = None,
        max_amplitude: Optional[float] = None
    ) -> Tuple[np.ndarray, List[Tuple[int, int]]]:
        if min_amplitude is None:
            min_amplitude = np.min(image)
        if max_amplitude is None:
            max_amplitude = np.max(image)
        
        seed_value = image[seed_point[0], seed_point[1]]
        
        rows, cols = image.shape
        mask = np.zeros((rows, cols), dtype=np.int32)
        mask[seed_point[0], seed_point[1]] = 1
        
        region_points = [seed_point]
        
        queue = [seed_point]
        visited = set([seed_point])
        
        neighbors = [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]
        
        while queue:
            current_row, current_col = queue.pop(0)
            
            for dr, dc in neighbors:
                new_row, new_col = current_row + dr, current_col + dc
                
                if 0 <= new_row < rows and 0 <= new_col < cols and (new_row, new_col) not in visited:
                    neighbor_value = image[new_row, new_col]
                    
                    similarity = abs(neighbor_value - seed_value) / (max_amplitude - min_amplitude + 1e-8)
                    
                    if similarity <= similarity_threshold:
                        visited.add((new_row, new_col))
                        mask[new_row, new_col] = 1
                        region_points.append((new_row, new_col))
                        queue.append((new_row, new_col))
        
        return mask, region_points

    def track_horizon(
        self,
        file_path: str,
        slice_type: str,
        slice_index: int,
        seed_points: List[Tuple[int, int]],
        similarity_threshold: float = 0.15
    ) -> Dict:
        if slice_type == 'inline':
            image = self.get_inline_slice(file_path, slice_index)
        elif slice_type == 'crossline':
            image = self.get_crossline_slice(file_path, slice_index)
        elif slice_type == 'timeslice':
            image = self.get_timeslice(file_path, slice_index)
        else:
            raise ValueError(f"Invalid slice type: {slice_type}")
        
        min_amp = np.min(image)
        max_amp = np.max(image)
        
        combined_mask = np.zeros(image.shape, dtype=np.int32)
        all_region_points = []
        
        for seed in seed_points:
            if 0 <= seed[0] < image.shape[0] and 0 <= seed[1] < image.shape[1]:
                mask, region_points = self._region_growing(
                    image, seed, similarity_threshold, min_amp, max_amp
                )
                combined_mask = np.maximum(combined_mask, mask)
                all_region_points.extend(region_points)
        
        boundary_points = []
        padded_mask = np.pad(combined_mask, 1, mode='constant')
        for i in range(combined_mask.shape[0]):
            for j in range(combined_mask.shape[1]):
                if combined_mask[i, j] == 1:
                    neighborhood = padded_mask[i:i+3, j:j+3]
                    if np.sum(neighborhood) < 9:
                        boundary_points.append((i, j))
        
        return {
            'slice_type': slice_type,
            'slice_index': slice_index,
            'shape': list(image.shape),
            'seed_points': seed_points,
            'region_mask': combined_mask.tolist(),
            'region_points': all_region_points,
            'boundary_points': boundary_points,
            'region_size': len(all_region_points)
        }

    def _write_geotiff(
        self,
        data: np.ndarray,
        output_path: str,
        extent: Optional[Tuple[float, float, float, float]] = None
    ) -> str:
        try:
            from osgeo import gdal, osr
            
            rows, cols = data.shape
            
            driver = gdal.GetDriverByName('GTiff')
            dataset = driver.Create(output_path, cols, rows, 1, gdal.GDT_Float32)
            
            if extent:
                x_min, x_max, y_min, y_max = extent
                pixel_width = (x_max - x_min) / cols
                pixel_height = (y_max - y_min) / rows
                
                geotransform = (x_min, pixel_width, 0, y_max, 0, -pixel_height)
                dataset.SetGeoTransform(geotransform)
                
                srs = osr.SpatialReference()
                srs.ImportFromEPSG(4326)
                dataset.SetProjection(srs.ExportToWkt())
            
            band = dataset.GetRasterBand(1)
            band.WriteArray(data.astype(np.float32))
            band.SetNoDataValue(-9999)
            band.FlushCache()
            
            dataset = None
            
            return output_path
        except ImportError:
            import pickle
            data_dict = {
                'data': data,
                'extent': extent,
                'dtype': str(data.dtype)
            }
            pickle_path = output_path.replace('.tif', '.pkl')
            with open(pickle_path, 'wb') as f:
                pickle.dump(data_dict, f)
            return pickle_path

    def export_slice_to_geotiff(
        self,
        file_path: str,
        slice_type: str,
        slice_index: int,
        output_dir: Optional[str] = None
    ) -> Dict:
        if output_dir is None:
            output_dir = os.path.join(self.upload_dir, 'geotiff')
        
        os.makedirs(output_dir, exist_ok=True)
        
        if slice_type == 'inline':
            image = self.get_inline_slice(file_path, slice_index)
        elif slice_type == 'crossline':
            image = self.get_crossline_slice(file_path, slice_index)
        elif slice_type == 'timeslice':
            image = self.get_timeslice(file_path, slice_index)
        else:
            raise ValueError(f"Invalid slice type: {slice_type}")
        
        base_name = os.path.splitext(os.path.basename(file_path))[0]
        output_filename = f"{base_name}_{slice_type}_{slice_index}.tif"
        output_path = os.path.join(output_dir, output_filename)
        
        extent = (0.0, float(image.shape[1]), 0.0, float(image.shape[0]))
        
        saved_path = self._write_geotiff(image, output_path, extent)
        
        return {
            'filename': os.path.basename(saved_path),
            'filepath': saved_path,
            'slice_type': slice_type,
            'slice_index': slice_index,
            'shape': list(image.shape),
            'min_amplitude': float(np.min(image)),
            'max_amplitude': float(np.max(image)),
            'extent': extent
        }
