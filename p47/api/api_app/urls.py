from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    MicrophoneNodeViewSet,
    AudioDetectionViewSet,
    PestLocationViewSet,
    HeatmapDataView,
    StatsView,
    NoiseStatusView,
    NoiseFilterTestView
)

router = DefaultRouter()
router.register(r'nodes', MicrophoneNodeViewSet)
router.register(r'detections', AudioDetectionViewSet)
router.register(r'locations', PestLocationViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('heatmap/', HeatmapDataView.as_view(), name='heatmap'),
    path('stats/', StatsView.as_view(), name='stats'),
    path('noise-status/', NoiseStatusView.as_view(), name='noise-status'),
    path('noise-test/', NoiseFilterTestView.as_view(), name='noise-test'),
]
