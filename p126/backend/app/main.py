from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import upload, detection, classification, prediction, batch
from app.api import weathering_trend, multi_period_compare, repair_estimate, model_slice

app = FastAPI(title="纸张显微图像分析系统", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api/upload", tags=["上传"])
app.include_router(detection.router, prefix="/api/detection", tags=["污渍检测"])
app.include_router(classification.router, prefix="/api/classification", tags=["类型分类"])
app.include_router(prediction.router, prefix="/api/prediction", tags=["破损预测"])
app.include_router(batch.router, prefix="/api/batch", tags=["批量推理"])
app.include_router(weathering_trend.router, prefix="/api/weathering-trend", tags=["风化趋势预测"])
app.include_router(multi_period_compare.router, prefix="/api/multi-period-compare", tags=["多期图像对比"])
app.include_router(repair_estimate.router, prefix="/api/repair-estimate", tags=["维修量估算"])
app.include_router(model_slice.router, prefix="/api/model-slice", tags=["模型切片分析"])

@app.get("/")
async def root():
    return {"message": "纸张显微图像分析系统 API"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
