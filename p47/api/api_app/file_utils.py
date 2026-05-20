import uuid
import os
import io
import numpy as np
import librosa
import soundfile as sf


def generate_uuid_filename(instance, filename):
    """
    生成UUID文件名，避免并发上传时的文件名冲突
    
    使用方式：
    audio_file = models.FileField(upload_to=generate_uuid_filename)
    """
    ext = os.path.splitext(filename)[1].lower()
    new_filename = f"{uuid.uuid4().hex}{ext}"
    return os.path.join('audio_uploads', new_filename)


class InMemoryAudioLoader:
    """
    内存音频加载器 - 避免临时文件写入磁盘
    支持直接从UploadedFile对象读取音频数据
    """
    
    @staticmethod
    def load_from_uploadedfile(uploaded_file, sr=22050):
        """
        直接从Django UploadedFile对象加载音频
        
        Args:
            uploaded_file: Django UploadedFile对象
            sr: 目标采样率
            
        Returns:
            (y, sr): 音频数据和采样率
        """
        file_bytes = uploaded_file.read()
        uploaded_file.seek(0)
        
        return InMemoryAudioLoader.load_from_bytes(file_bytes, sr=sr)
    
    @staticmethod
    def load_from_bytes(file_bytes, sr=22050):
        """
        直接从字节数据加载音频
        
        Args:
            file_bytes: 音频字节数据
            sr: 目标采样率
            
        Returns:
            (y, sr): 音频数据和采样率
        """
        byte_io = io.BytesIO(file_bytes)
        y, loaded_sr = sf.read(byte_io)
        
        if sr is not None and loaded_sr != sr:
            y = librosa.resample(y, orig_sr=loaded_sr, target_sr=sr)
            loaded_sr = sr
        
        return y, loaded_sr


def safe_tempfile_process(uploaded_file, process_func, *args, **kwargs):
    """
    安全的临时文件处理包装器
    使用UUID命名临时文件，处理后自动删除
    
    Args:
        uploaded_file: Django UploadedFile对象
        process_func: 处理函数，接收文件路径作为参数
    
    Returns:
        process_func的返回值
    """
    import tempfile
    
    ext = os.path.splitext(uploaded_file.name)[1].lower()
    temp_filename = os.path.join(
        tempfile.gettempdir(),
        f"audio_{uuid.uuid4().hex}{ext}"
    )
    
    try:
        with open(temp_filename, 'wb') as f:
            for chunk in uploaded_file.chunks():
                f.write(chunk)
        
        result = process_func(temp_filename, *args, **kwargs)
        
        return result
    finally:
        try:
            if os.path.exists(temp_filename):
                os.unlink(temp_filename)
        except:
            pass
