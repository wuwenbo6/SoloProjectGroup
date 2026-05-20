from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from app.core.database import get_batch_db
from app.core.load_balancer import (
    get_load_balancer, get_circuit_breaker, BackendServer
)
from app.core.performance_monitor import (
    get_performance_metrics, get_auto_recovery,
    get_pool_manager, get_query_optimizer
)
from app.utils.quality_grading_v2 import quality_engine_v2

router = APIRouter(prefix="/api/v1/performance", tags=["性能监控"])


@router.get("/overview", summary="获取系统性能概览")
async def get_performance_overview():
    metrics = get_performance_metrics()
    all_stats = metrics.get_all_stats()
    total_requests = sum(s["total_requests"] for s in all_stats)
    avg_response_time = sum(s["avg_response_time"] for s in all_stats) / len(all_stats) if all_stats else 0
    error_rate = sum(s["error_count"] for s in all_stats) / total_requests if total_requests > 0 else 0

    return {
        "timestamp": datetime.utcnow(),
        "total_endpoints": len(all_stats),
        "total_requests": total_requests,
        "avg_response_time_ms": round(avg_response_time * 1000, 2),
        "error_rate": round(error_rate, 4),
        "slow_endpoints": [
            s for s in all_stats if s["avg_response_time"] > 1.0
        ][:10]
    }


@router.get("/endpoints", summary="获取所有接口性能统计")
async def get_endpoint_performance(
    endpoint: Optional[str] = None
):
    metrics = get_performance_metrics()
    if endpoint:
        return metrics.get_endpoint_stats(endpoint)
    return metrics.get_all_stats()


@router.get("/load-balancer", summary="获取负载均衡器状态")
async def get_load_balancer_status():
    lb = get_load_balancer()
    return lb.get_statistics()


@router.post("/load-balancer/servers", summary="添加后端服务器")
async def add_backend_server(
    server_id: str,
    host: str,
    port: int,
    weight: int = 100
):
    lb = get_load_balancer()
    server = lb.add_server(server_id, host, port, weight)
    return {
        "message": "服务器添加成功",
        "server": {
            "server_id": server.server_id,
            "host": server.host,
            "port": server.port,
            "weight": server.weight
        }
    }


@router.delete("/load-balancer/servers/{server_id}", summary="移除后端服务器")
async def remove_backend_server(server_id: str):
    lb = get_load_balancer()
    lb.remove_server(server_id)
    return {"message": "服务器移除成功"}


@router.put("/load-balancer/servers/{server_id}/health", summary="更新服务器健康状态")
async def update_server_health(server_id: str, is_healthy: bool):
    lb = get_load_balancer()
    lb.update_server_health(server_id, is_healthy)
    return {"message": "服务器健康状态已更新"}


@router.get("/circuit-breaker", summary="获取熔断器状态")
async def get_circuit_breaker_status(
    component: Optional[str] = None
):
    cb = get_circuit_breaker()
    if component:
        return {
            "component": component,
            "state": cb.get_state(component)
        }
    return {
        "message": "熔断器运行正常",
        "monitored_components": list(cb.states.keys()) if hasattr(cb, 'states') else []
    }


@router.get("/auto-recovery", summary="获取自动恢复机制状态")
async def get_auto_recovery_status():
    ar = get_auto_recovery()
    return ar.get_recovery_stats()


@router.post("/auto-recovery/register", summary="注册自动恢复动作")
async def register_recovery_action(component: str):
    ar = get_auto_recovery()

    async def recovery_action():
        print(f"执行组件 {component} 的自动恢复...")

    ar.register_recovery_action(component, recovery_action)
    return {"message": f"组件 {component} 的恢复动作已注册"}


@router.get("/connection-pool", summary="获取数据库连接池状态")
async def get_connection_pool_status():
    pm = get_pool_manager()
    return pm.get_pool_stats()


@router.get("/query-optimizer", summary="获取查询优化器状态")
async def get_query_optimizer_status():
    qo = get_query_optimizer()
    return {
        "slow_queries_count": len(qo.slow_queries) if hasattr(qo, 'slow_queries') else 0,
        "cache_info": {
            "size": len(qo.query_cache) if hasattr(qo, 'query_cache') else 0
        }
    }


@router.get("/slow-queries", summary="获取慢查询列表")
async def get_slow_queries(
    min_time: float = 1.0,
    limit: int = 50
):
    qo = get_query_optimizer()
    slow_queries = qo.get_slow_queries(min_time)
    return {
        "total": len(slow_queries),
        "slow_queries": slow_queries[:limit]
    }


@router.get("/quality-engine", summary="获取品质分级引擎状态")
async def get_quality_engine_status():
    cache_stats = quality_engine_v2.get_cache_stats()
    return {
        "engine_version": "v2",
        "cache": cache_stats
    }


@router.post("/quality-engine/batch-test", summary="批量品质分级测试")
async def batch_quality_test(batches: List[Dict]):
    start_time = datetime.utcnow()
    results = quality_engine_v2.batch_calculate_grades(batches)
    elapsed = (datetime.utcnow() - start_time).total_seconds()
    return {
        "batch_size": len(batches),
        "processing_time_seconds": round(elapsed, 4),
        "avg_per_batch_ms": round(elapsed / len(batches) * 1000, 2) if batches else 0,
        "results": results
    }


@router.get("/health", summary="系统健康检查")
async def health_check():
    lb = get_load_balancer()
    lb_stats = lb.get_statistics()

    return {
        "status": "healthy",
        "timestamp": datetime.utcnow(),
        "load_balancer": {
            "healthy_servers": lb_stats["healthy_servers"],
            "total_servers": lb_stats["total_servers"]
        }
    }


@router.get("/metrics", summary="获取Prometheus格式指标")
async def get_prometheus_metrics():
    metrics = get_performance_metrics()
    all_stats = metrics.get_all_stats()
    total_requests = sum(s["total_requests"] for s in all_stats)
    avg_response_time = sum(s["avg_response_time"] for s in all_stats) / len(all_stats) if all_stats else 0
    error_count = sum(s["error_count"] for s in all_stats)

    prometheus_data = f"""# HELP api_requests_total Total number of API requests
# TYPE api_requests_total counter
api_requests_total {total_requests}

# HELP api_response_time_seconds Average API response time
# TYPE api_response_time_seconds gauge
api_response_time_seconds {avg_response_time}

# HELP api_errors_total Total number of API errors
# TYPE api_errors_total counter
api_errors_total {error_count}
"""
    return {"metrics": prometheus_data}


@router.post("/cache/clear", summary="清除所有缓存")
async def clear_all_caches():
    quality_engine_v2.cache.cache.clear()
    quality_engine_v2.cache.hits = 0
    quality_engine_v2.cache.misses = 0
    return {"message": "所有缓存已清除"}


@router.get("/recommendations", summary="获取性能优化建议")
async def get_performance_recommendations():
    metrics = get_performance_metrics()
    all_stats = metrics.get_all_stats()
    recommendations = []

    slow_endpoints = [s for s in all_stats if s["avg_response_time"] > 1.0]
    if slow_endpoints:
        recommendations.append({
            "type": "performance",
            "priority": "high",
            "message": f"发现 {len(slow_endpoints)} 个慢响应接口，建议优化",
            "details": slow_endpoints[:5]
        })

    high_error_endpoints = [s for s in all_stats if s["error_rate"] > 0.1]
    if high_error_endpoints:
        recommendations.append({
            "type": "stability",
            "priority": "high",
            "message": f"发现 {len(high_error_endpoints)} 个高错误率接口",
            "details": high_error_endpoints[:5]
        })

    return {
        "recommendations": recommendations,
        "total_issues": len(recommendations)
    }
