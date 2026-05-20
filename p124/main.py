#!/usr/bin/env python3
import os
import sys
import numpy as np
from vinyl_processor import (
    AudioCapture,
    NoiseReducer,
    SpeedCorrector,
    AudioSegmenter,
    FileExporter,
    LibraryManager
)


SAMPLE_RATE = 44100


class VinylProcessor:
    def __init__(self):
        self.audio_capture = AudioCapture(SAMPLE_RATE)
        self.noise_reducer = NoiseReducer(SAMPLE_RATE)
        self.speed_corrector = SpeedCorrector(SAMPLE_RATE)
        self.segmenter = AudioSegmenter(SAMPLE_RATE)
        self.exporter = FileExporter(SAMPLE_RATE)
        self.library = LibraryManager()
        
        self.raw_audio = None
        self.processed_audio = None
        self.segments = []
    
    def record_audio(self, device_id=None):
        print("=" * 60)
        print("录音模式")
        print("=" * 60)
        
        devices = self.audio_capture.list_devices()
        if not devices:
            print("未找到音频输入设备")
            return None
        
        print("\n可用音频设备:")
        for dev in devices:
            print(f"  [{dev['id']}] {dev['name']} ({dev['channels']}声道)")
        
        if device_id is None:
            device_id = int(input("\n请选择设备ID: "))
        
        input("\n按回车键开始录音...")
        self.audio_capture.start_recording(device_id)
        
        input("按回车键停止录音...")
        self.raw_audio = self.audio_capture.stop_recording()
        
        duration = len(self.raw_audio) / SAMPLE_RATE
        print(f"\n录音完成! 时长: {duration:.2f}秒")
        
        return self.raw_audio
    
    def load_audio_file(self, file_path):
        print(f"加载音频文件: {file_path}")
        self.raw_audio, sr = self.audio_capture.load_audio_file(file_path)
        
        duration = len(self.raw_audio) / SAMPLE_RATE
        print(f"加载完成! 时长: {duration:.2f}秒")
        
        return self.raw_audio
    
    def process_audio(self, noise_sample=None):
        print("=" * 60)
        print("音频处理")
        print("=" * 60)
        
        if self.raw_audio is None:
            print("请先录音或加载音频文件")
            return None
        
        self.processed_audio = self.noise_reducer.auto_clean(
            self.raw_audio, 
            noise_sample
        )
        
        self.processed_audio, speed_ratio = self.speed_corrector.auto_correct(
            self.processed_audio
        )
        
        print(f"\n转速校正比例: {speed_ratio:.4f}")
        
        return self.processed_audio
    
    def segment_audio(self, method='combined', min_duration=10.0):
        print("=" * 60)
        print("音频分段")
        print("=" * 60)
        
        if self.processed_audio is None:
            if self.raw_audio is None:
                print("请先录音或加载音频文件")
                return None
            audio = self.raw_audio
        else:
            audio = self.processed_audio
        
        self.segments = self.segmenter.auto_segment(
            audio, 
            method=method,
            min_duration=min_duration
        )
        
        self.segments = self.segmenter.merge_short_segments(
            self.segments,
            min_duration=min_duration
        )
        
        info = self.segmenter.get_segment_info(self.segments)
        
        print(f"\n分段结果:")
        for seg in info:
            print(f"  曲目 {seg['index'] + 1}: {seg['duration']:.2f}秒")
        
        return self.segments
    
    def export_segments(self, output_dir, album_title="Unknown", 
                        artist="Unknown", format="wav"):
        print("=" * 60)
        print("导出音频")
        print("=" * 60)
        
        if not self.segments:
            print("没有可导出的音轨")
            return None
        
        os.makedirs(output_dir, exist_ok=True)
        
        album_id = self.library.add_album(
            title=album_title,
            artist=artist
        )
        
        exported_files = self.exporter.export_batch(
            self.segments,
            output_dir,
            base_name=f"{album_title.replace(' ', '_')}",
            format=format
        )
        
        for i, (file_path, (audio, start, end)) in enumerate(zip(exported_files, self.segments)):
            duration = end - start
            peak_level = float(np.max(np.abs(audio)))
            
            if audio.ndim == 2:
                mono = np.mean(audio, axis=1)
            else:
                mono = audio
            
            rms_level = float(np.sqrt(np.mean(mono**2)))
            
            self.library.add_track(
                album_id=album_id,
                title=f"Track {i + 1}",
                file_path=file_path,
                track_number=i + 1,
                duration=duration,
                file_format=format,
                bit_depth=16,
                sample_rate=SAMPLE_RATE,
                peak_level=peak_level,
                rms_level=rms_level
            )
        
        self.exporter.export_metadata(
            self.segments,
            os.path.join(output_dir, 'metadata.json')
        )
        
        self.exporter.create_m3u_playlist(
            exported_files,
            os.path.join(output_dir, 'playlist.m3u'),
            output_dir
        )
        
        print(f"\n导出完成! 共导出 {len(exported_files)} 个文件")
        print(f"输出目录: {output_dir}")
        
        return exported_files
    
    def quick_process_file(self, input_file, output_dir, 
                           album_title="Unknown", artist="Unknown"):
        print("=" * 60)
        print("快速处理模式")
        print("=" * 60)
        print(f"输入文件: {input_file}")
        print(f"输出目录: {output_dir}")
        
        self.load_audio_file(input_file)
        
        self.process_audio()
        
        self.segment_audio()
        
        self.export_segments(output_dir, album_title, artist)
        
        print("\n" + "=" * 60)
        print("处理完成!")
        print("=" * 60)
    
    def show_library_stats(self):
        stats = self.library.get_statistics()
        
        print("=" * 60)
        print("曲库统计")
        print("=" * 60)
        print(f"  专辑数量: {stats['album_count']}")
        print(f"  曲目数量: {stats['track_count']}")
        print(f"  文件数量: {stats['file_count']}")
        print(f"  总时长: {stats['total_duration_minutes']:.2f}分钟")
        
        albums = self.library.list_albums()
        if albums:
            print(f"\n最近专辑:")
            for album in albums[:5]:
                tracks = self.library.get_album_tracks(album['id'])
                print(f"  {album['title']} - {album.get('artist', 'Unknown')} ({len(tracks)}首曲目)")


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='唱机音频处理工具')
    parser.add_argument('--input', '-i', help='输入音频文件')
    parser.add_argument('--output', '-o', default='./output', help='输出目录')
    parser.add_argument('--album', help='专辑名称')
    parser.add_argument('--artist', help='艺术家名称')
    parser.add_argument('--record', action='store_true', help='录音模式')
    parser.add_argument('--stats', action='store_true', help='显示曲库统计')
    
    args = parser.parse_args()
    
    processor = VinylProcessor()
    
    if args.stats:
        processor.show_library_stats()
        return
    
    if args.record:
        processor.record_audio()
        processor.process_audio()
        processor.segment_audio()
        processor.export_segments(
            args.output,
            album_title=args.album or "Recorded Album",
            artist=args.artist or "Unknown"
        )
        return
    
    if args.input:
        processor.quick_process_file(
            args.input,
            args.output,
            album_title=args.album or "Unknown Album",
            artist=args.artist or "Unknown Artist"
        )
        return
    
    print("唱机音频处理工具")
    print("\n用法示例:")
    print("  python main.py --stats                     显示曲库统计")
    print("  python main.py --record                    录音模式")
    print("  python main.py -i input.wav -o ./output    处理音频文件")
    print("  python main.py -i input.wav -o ./output --album \"My Album\" --artist \"Artist Name\"")


if __name__ == '__main__':
    main()
