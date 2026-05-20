from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import audio, synthesis, knowledge_base, repair, annotation, dialect_db
import uvicorn

app = FastAPI(
    title="方言语音合成系统API",
    description="小众方言保护项目 - 方言语音合成、语调矫正、情感适配、语料库管理、增量训练一体化服务",
    version="1.2.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(audio.router, prefix="/api/audio", tags=["语音采集与处理"])
app.include_router(synthesis.router, prefix="/api/synthesis", tags=["语音合成"])
app.include_router(knowledge_base.router, prefix="/api/knowledge", tags=["方言知识库"])
app.include_router(repair.router, prefix="/api/repair", tags=["语音修复"])
app.include_router(annotation.router, prefix="/api/annotation", tags=["语料标注"])
app.include_router(dialect_db.router, prefix="/api", tags=["方言保护数据库"])

from services.performance_optimizer import ResourceManager
resource_manager = ResourceManager()

@app.get("/api/performance/status", tags=["性能监控"])
async def get_performance_status():
    return resource_manager.get_system_status()

@app.post("/api/performance/cleanup", tags=["性能监控"])
async def cleanup_resources():
    resource_manager.cleanup()
    return {"success": True, "message": "资源清理完成"}

@app.get("/")
async def root():
    return {"message": "方言语音合成系统服务已启动", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
