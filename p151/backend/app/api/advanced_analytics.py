from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from typing import Optional, Dict, List
from datetime import datetime

from ..core.database import get_elasticsearch
from ..analytics.propagation_network import PropagationAnalyzer, RumorClassifier
from ..analytics.influence_engine import InfluenceQuantifier
from ..reports.pdf_generator import PDFReportGenerator

router = APIRouter()


@router.get("/rumor/detect")
async def detect_rumor(
    keyword: str = Query(..., description="搜索关键词"),
    days: int = Query(7, ge=1, le=30, description="分析天数"),
    es=Depends(get_elasticsearch)
):
    try:
        query = {
            "bool": {
                "must": [
                    {"range": {"created_at": {"gte": f"now-{days}d"}}},
                    {
                        "multi_match": {
                            "query": keyword,
                            "fields": ["content", "entities"]
                        }
                    }
                ]
            }
        }

        result = es.search(
            index="posts",
            query=query,
            size=500,
            _source=["id", "platform", "author", "content", "created_at",
                    "sentiment_score", "entities", "likes", "shares", "comments"]
        )

        posts = [hit["_source"] for hit in result["hits"]["hits"]]

        if len(posts) < 3:
            return {
                "status": "insufficient_data",
                "message": "数据不足，无法进行可靠的谣言检测分析",
                "posts_collected": len(posts),
                "minimum_required": 3
            }

        analyzer = PropagationAnalyzer()
        post_nodes = []
        for p in posts:
            created_at = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")) if isinstance(p.get("created_at"), str) else p.get("created_at", datetime.now())
            post_nodes.append({
                "id": p.get("id", ""),
                "platform": p.get("platform", "twitter"),
                "author": p.get("author", "anonymous"),
                "content": p.get("content", ""),
                "timestamp": created_at,
                "follower_count": p.get("follower_count", 1000),
                "likes": p.get("likes", 0),
                "shares": p.get("shares", 0),
                "comments": p.get("comments", 0),
                "sentiment_score": p.get("sentiment_score", 0.0),
                "entities": p.get("entities", [])
            })

        rumor_result = analyzer.detect_rumor_patterns(post_nodes)

        classifier = RumorClassifier()
        content_scores = []
        for p in posts:
            content_result = classifier.classify_content(p.get("content", ""))
            content_scores.append(content_result["content_rumor_score"])

        avg_content_rumor_score = sum(content_scores) / len(content_scores) if content_scores else 0

        final_rumor_score = (rumor_result.rumor_score * 0.7) + (avg_content_rumor_score * 0.3)

        risk_level = "high" if final_rumor_score >= 0.6 else "medium" if final_rumor_score >= 0.3 else "low"

        return {
            "status": "success",
            "keyword": keyword,
            "analysis_period_days": days,
            "posts_analyzed": len(posts),
            "rumor_detection": {
                "is_potential_rumor": final_rumor_score >= 0.4,
                "rumor_score": round(final_rumor_score, 3),
                "confidence": rumor_result.confidence,
                "risk_level": risk_level,
                "suspicious_patterns": rumor_result.suspicious_patterns,
                "content_based_score": round(avg_content_rumor_score, 3),
                "network_based_score": round(rumor_result.rumor_score, 3)
            },
            "propagation_metrics": {
                "propagation_speed": round(rumor_result.propagation_speed, 2),
                "viral_coefficient": round(rumor_result.viral_coefficient, 2),
                "network_metrics": rumor_result.network_metrics
            },
            "key_spreaders": rumor_result.key_spreaders
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"谣言检测分析失败: {str(e)}")


@router.get("/influence/analyze")
async def analyze_influence(
    keyword: str = Query(..., description="搜索关键词"),
    days: int = Query(7, ge=1, le=30, description="分析天数"),
    es=Depends(get_elasticsearch)
):
    try:
        query = {
            "bool": {
                "must": [
                    {"range": {"created_at": {"gte": f"now-{days}d"}}},
                    {
                        "multi_match": {
                            "query": keyword,
                            "fields": ["content", "entities"]
                        }
                    }
                ]
            }
        }

        result = es.search(
            index="posts",
            query=query,
            size=500,
            _source=["id", "platform", "author", "content", "created_at",
                    "sentiment_score", "entities", "likes", "shares", "comments", "follower_count"]
        )

        posts = [hit["_source"] for hit in result["hits"]["hits"]]

        if not posts:
            return {
                "status": "no_data",
                "message": "未找到相关帖子数据"
            }

        influencer = InfluenceQuantifier()

        for p in posts:
            p["timestamp"] = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")) if isinstance(p.get("created_at"), str) else p.get("created_at", datetime.now())

        influence_metrics = influencer.aggregate_campaign_influence(posts)

        heatmap_engine = influencer
        if hasattr(heatmap_engine, '_'):
            pass

        return {
            "status": "success",
            "keyword": keyword,
            "analysis_period_days": days,
            "posts_analyzed": len(posts),
            "influence_summary": {
                "total_reach": influence_metrics.total_reach,
                "estimated_impressions": influence_metrics.estimated_impressions,
                "engagement_rate": influence_metrics.engagement_rate,
                "virality_score": influence_metrics.virality_score,
                "influence_level": influence_metrics.influence_level
            },
            "platform_breakdown": influence_metrics.platform_breakdown,
            "top_influencers": influence_metrics.top_influencers,
            "temporal_projection": influence_metrics.temporal_projection
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"影响力分析失败: {str(e)}")


@router.get("/report/generate")
async def generate_report(
    keyword: str = Query(..., description="搜索关键词"),
    days: int = Query(7, ge=1, le=30, description="分析天数"),
    format: str = Query("pdf", description="报告格式: pdf"),
    es=Depends(get_elasticsearch)
):
    try:
        query = {
            "bool": {
                "must": [
                    {"range": {"created_at": {"gte": f"now-{days}d"}}},
                    {
                        "multi_match": {
                            "query": keyword,
                            "fields": ["content", "entities"]
                        }
                    }
                ]
            }
        }

        result = es.search(
            index="posts",
            query=query,
            size=500,
            _source=["id", "platform", "author", "content", "created_at",
                    "sentiment_score", "entities", "likes", "shares", "comments", "follower_count"]
        )

        posts = [hit["_source"] for hit in result["hits"]["hits"]]

        if not posts:
            raise HTTPException(status_code=400, detail="没有足够的数据生成报告")

        for p in posts:
            p["created_at"] = datetime.fromisoformat(p["created_at"].replace("Z", "+00:00")) if isinstance(p.get("created_at"), str) else p.get("created_at", datetime.now())

        report_gen = PDFReportGenerator()
        pdf_bytes = report_gen.generate_summary_report(posts, keyword)

        filename = f"舆情分析报告_{keyword}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename*=UTF-8''{filename.encode('utf-8').decode('latin-1')}"
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"报告生成失败: {str(e)}")


@router.get("/dashboard/summary")
async def get_dashboard_summary(
    keyword: Optional[str] = None,
    days: int = Query(7, ge=1, le=30),
    es=Depends(get_elasticsearch)
):
    try:
        base_query = {
            "bool": {
                "must": [
                    {"range": {"created_at": {"gte": f"now-{days}d"}}}
                ]
            }
        }

        if keyword:
            base_query["bool"]["must"].append({
                "multi_match": {
                    "query": keyword,
                    "fields": ["content", "entities"]
                }
            })

        result = es.search(
            index="posts",
            query=base_query,
            size=100,
            _source=["platform", "sentiment_score", "likes", "shares", "comments", "follower_count"]
        )

        posts = [hit["_source"] for hit in result["hits"]["hits"]]

        if not posts:
            return {
                "status": "no_data",
                "message": "未找到数据"
            }

        platform_counts = {}
        for p in posts:
            platform = p.get("platform", "unknown")
            platform_counts[platform] = platform_counts.get(platform, 0) + 1

        positive = sum(1 for p in posts if p.get("sentiment_score", 0) > 0.1)
        negative = sum(1 for p in posts if p.get("sentiment_score", 0) < -0.1)
        neutral = len(posts) - positive - negative

        total_engagement = sum(p.get("likes", 0) + p.get("shares", 0) + p.get("comments", 0) for p in posts)

        return {
            "status": "success",
            "total_posts": len(posts),
            "platform_distribution": platform_counts,
            "sentiment_summary": {
                "positive": positive,
                "negative": negative,
                "neutral": neutral,
                "positive_rate": round(positive / len(posts) * 100, 1),
                "negative_rate": round(negative / len(posts) * 100, 1)
            },
            "engagement_summary": {
                "total_engagement": total_engagement,
                "avg_per_post": round(total_engagement / len(posts), 1)
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取概览数据失败: {str(e)}")
