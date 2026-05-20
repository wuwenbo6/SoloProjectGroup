from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from contextlib import asynccontextmanager
from .core.database import get_elasticsearch, init_indices
from .api import auth, posts, crawlers, analytics, alerts, advanced_analytics
from dotenv import load_dotenv

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    es = get_elasticsearch()
    init_indices(es)
    yield


app = FastAPI(title="舆情监控系统", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(posts.router, prefix="/api/posts", tags=["帖子"])
app.include_router(crawlers.router, prefix="/api/crawlers", tags=["爬虫"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["分析"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["报警"])
app.include_router(advanced_analytics.router, prefix="/api/advanced", tags=["高级分析"])

import os
static_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")
templates = Jinja2Templates(directory=static_dir)

from fastapi.responses import HTMLResponse
from fastapi import Request

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard(request: Request):
    with open(os.path.join(static_dir, "index.html"), "r", encoding="utf-8") as f:
        return f.read()


@app.get("/")
async def root():
    return {"message": "舆情监控系统 API"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
