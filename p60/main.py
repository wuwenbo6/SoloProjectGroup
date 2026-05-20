from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine
from app import models
from app.routers import auth, structures, analysis, simulation, third_party

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="榫卯结构分析 API",
    description="用于榫卯结构参数录入、受力分析、装配模拟的纯后端 API 服务",
    version="1.0.0",
    contact={
        "name": "API Support",
        "email": "support@mortise-tenon.example.com"
    },
    license_info={
        "name": "MIT License"
    }
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(structures.router)
app.include_router(analysis.router)
app.include_router(simulation.router)
app.include_router(third_party.router)


@app.get("/")
def root():
    return {
        "message": "榫卯结构分析 API 服务",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "mortise-tenon-api"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
