from django.db import models
from .file_utils import generate_uuid_filename


class MicrophoneNode(models.Model):
    node_id = models.CharField(max_length=50, unique=True)
    lat = models.FloatField()
    lng = models.FloatField()
    height = models.FloatField(default=0.0)
    registered_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        ordering = ['node_id']
    
    def __str__(self):
        return f"{self.node_id} ({self.lat:.4f}, {self.lng:.4f})"


class AudioDetection(models.Model):
    PEST_TYPES = [
        ('locust', '蝗虫'),
        ('cotton_bollworm', '棉铃虫'),
        ('aphid', '蚜虫'),
        ('whitefly', '粉虱'),
        ('none', '无'),
        ('unknown', '未知'),
    ]
    
    node = models.ForeignKey(MicrophoneNode, on_delete=models.CASCADE)
    event_id = models.CharField(max_length=100)
    audio_file = models.FileField(upload_to=generate_uuid_filename)
    timestamp = models.FloatField(help_text='检测时间戳（秒）')
    detected_pest = models.CharField(max_length=50, choices=PEST_TYPES, 
                                     default='unknown')
    confidence = models.FloatField(default=0.0)
    detection_details = models.JSONField(default=dict, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['event_id']),
            models.Index(fields=['detected_pest']),
        ]
    
    def __str__(self):
        return f"{self.event_id} - {self.node.node_id} - {self.detected_pest}"


class PestLocation(models.Model):
    event_id = models.CharField(max_length=100, unique=True)
    lat = models.FloatField(help_text='估算纬度')
    lng = models.FloatField(help_text='估算经度')
    error = models.FloatField(default=0.0, help_text='定位误差')
    localized_at = models.DateTimeField(auto_now_add=True)
    localization_details = models.JSONField(default=dict, blank=True)
    
    true_lat = models.FloatField(null=True, blank=True, help_text='真实纬度（用于测试）')
    true_lng = models.FloatField(null=True, blank=True, help_text='真实经度（用于测试）')
    
    class Meta:
        ordering = ['-localized_at']
    
    def __str__(self):
        return f"{self.event_id} - ({self.lat:.4f}, {self.lng:.4f})"
