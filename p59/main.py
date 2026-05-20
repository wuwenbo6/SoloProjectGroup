#!/usr/bin/env python3
"""
胶片转录修复工具 - 主入口文件
跨平台桌面工具，支持老式手摇放映机的USB/串口连接，
实时采集胶片视频与音频，自动去除划痕、褪色、杂音，
支持自定义转录参数，本地数据库存储管理，云端同步备份。
"""

import logging
import sys
from pathlib import Path

from hardware.projector_driver import ProjectorDriver, ProjectorModel, ConnectionType
from video.color_correction import FilmColorCorrector, FilmStock
from video.video_editor import VideoEditor, ExportOptions, ExportFormat
from restoration.scratch_removal import MultiScaleScratchDetector
from transcription.batch_processor import BatchTranscriptionProcessor, ProcessingOptions
from audio.noise_reduction import AudioNoiseReducer, AudioParams
from database.archive_manager import ArchiveManager, ProjectorConfig, TranscriptionRecord
from sync.cloud_sync import CloudSyncManager, SyncConfig, SyncStatus, SyncProvider
from utils.lazy_loader import resource_manager, optimize_startup, enable_gc_after_startup, get_memory_usage


def setup_logging():
    log_dir = Path("./logs")
    log_dir.mkdir(exist_ok=True)

    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(log_dir / "film_transcription.log", encoding='utf-8'),
            logging.StreamHandler(sys.stdout)
        ]
    )


def main():
    optimize_startup()
    setup_logging()
    logger = logging.getLogger("Main")
    logger.info("=" * 60)
    logger.info("胶片转录修复工具启动")
    logger.info("=" * 60)

    logger.info("正在初始化存档管理器...")
    archive_manager = ArchiveManager()
    stats = archive_manager.get_statistics()
    logger.info(f"系统统计: {stats}")

    logger.info("正在初始化放映机驱动...")
    projector_driver = ProjectorDriver()

    logger.info("正在检测放映机设备...")
    projectors = projector_driver.detect_projectors()
    logger.info(f"检测到 {len(projectors)} 台放映机设备")

    for i, proj in enumerate(projectors, 1):
        logger.info(f"  {i}. {proj.model_name} ({proj.connection_type})")

    logger.info("正在初始化批量转录处理器...")
    batch_processor = BatchTranscriptionProcessor()

    logger.info("正在初始化云端同步管理器...")
    sync_manager = CloudSyncManager()
    sync_status = sync_manager.get_sync_status()
    logger.info(f"同步状态: {sync_status['status']}, 设备ID: {sync_status['device_id']}")

    enable_gc_after_startup()

    logger.info("系统初始化完成")
    logger.info("=" * 60)

    memory_usage = get_memory_usage()
    logger.info(f"当前内存使用: {memory_usage:.2f} MB")

    return {
        "archive_manager": archive_manager,
        "projector_driver": projector_driver,
        "color_corrector": FilmColorCorrector(),
        "scratch_detector": MultiScaleScratchDetector(),
        "audio_reducer": AudioNoiseReducer(),
        "batch_processor": batch_processor,
        "video_editor": VideoEditor(),
        "sync_manager": sync_manager,
        "resource_manager": resource_manager
    }


if __name__ == "__main__":
    modules = main()
    print("\n系统已就绪，核心模块已加载:")
    for name, module in modules.items():
        print(f"  - {name}: {module.__class__.__name__}")

    print("\n新增功能模块:")
    print("  - 云端同步备份 (sync_manager)")
    print("  - 视频片段截取拼接 (video_editor)")
    print("  - 内存优化与懒加载 (resource_manager)")
    print("  - 档案标签分类检索 (archive_manager 增强功能)")
