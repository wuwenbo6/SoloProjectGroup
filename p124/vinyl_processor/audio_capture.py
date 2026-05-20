import numpy as np
import sounddevice as sd
import soundfile as sf
import librosa
from typing import Optional, Tuple
import threading
import queue
import time


class AudioCapture:
    def __init__(self, sample_rate: int = 44100, channels: int = 2):
        self.sample_rate = sample_rate
        self.channels = channels
        self.is_recording = False
        self.recording_queue = queue.Queue()
        self.recording_data = []
        self.recording_thread = None

    def list_devices(self) -> list:
        devices = sd.query_devices()
        device_list = []
        for i, dev in enumerate(devices):
            if dev['max_input_channels'] > 0:
                device_list.append({
                    'id': i,
                    'name': dev['name'],
                    'channels': dev['max_input_channels'],
                    'sample_rate': dev['default_samplerate']
                })
        return device_list

    def set_device(self, device_id: int):
        sd.default.device = device_id

    def _audio_callback(self, indata, frames, time, status):
        if status:
            print(f"录音状态警告: {status}")
        self.recording_queue.put(indata.copy())

    def start_recording(self, device_id: Optional[int] = None):
        if self.is_recording:
            raise RuntimeError("录音已在进行中")
        
        if device_id is not None:
            self.set_device(device_id)
        
        self.is_recording = True
        self.recording_data = []
        
        self.recording_thread = threading.Thread(target=self._record_loop)
        self.recording_thread.start()
        print("开始录音...")

    def _record_loop(self):
        with sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            callback=self._audio_callback
        ):
            while self.is_recording:
                time.sleep(0.1)
        
        while not self.recording_queue.empty():
            data = self.recording_queue.get()
            self.recording_data.append(data)

    def stop_recording(self) -> np.ndarray:
        if not self.is_recording:
            raise RuntimeError("没有正在进行的录音")
        
        self.is_recording = False
        if self.recording_thread:
            self.recording_thread.join()
        
        while not self.recording_queue.empty():
            data = self.recording_queue.get()
            self.recording_data.append(data)
        
        if self.recording_data:
            audio = np.concatenate(self.recording_data, axis=0)
        else:
            audio = np.array([])
        
        print(f"录音结束，时长: {len(audio) / self.sample_rate:.2f}秒")
        return audio

    def load_audio_file(self, file_path: str) -> Tuple[np.ndarray, int]:
        audio, sr = librosa.load(file_path, sr=self.sample_rate, mono=False)
        if audio.ndim == 1:
            audio = np.vstack([audio, audio])
        audio = audio.T
        return audio, sr

    def save_temp_recording(self, audio: np.ndarray, file_path: str):
        sf.write(file_path, audio, self.sample_rate)
        print(f"临时录音已保存到: {file_path}")

    def get_audio_duration(self, audio: np.ndarray) -> float:
        return len(audio) / self.sample_rate

    def plot_waveform(self, audio: np.ndarray, output_path: Optional[str] = None):
        import matplotlib.pyplot as plt
        
        time_axis = np.linspace(0, self.get_audio_duration(audio), len(audio))
        
        plt.figure(figsize=(12, 6))
        if self.channels == 2:
            plt.subplot(2, 1, 1)
            plt.plot(time_axis, audio[:, 0])
            plt.title('左声道波形')
            plt.ylabel('振幅')
            
            plt.subplot(2, 1, 2)
            plt.plot(time_axis, audio[:, 1])
            plt.title('右声道波形')
            plt.xlabel('时间 (秒)')
            plt.ylabel('振幅')
        else:
            plt.plot(time_axis, audio[:, 0] if audio.ndim > 1 else audio)
            plt.title('音频波形')
            plt.xlabel('时间 (秒)')
            plt.ylabel('振幅')
        
        plt.tight_layout()
        if output_path:
            plt.savefig(output_path, dpi=150)
            plt.close()
            print(f"波形图已保存到: {output_path}")
        else:
            plt.show()
