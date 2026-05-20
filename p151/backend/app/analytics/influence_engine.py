from typing import Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta
import math
from collections import defaultdict
import numpy as np


@dataclass
class InfluenceMetrics:
    total_reach: int
    estimated_impressions: int
    engagement_rate: float
    virality_score: float
    influence_level: str
    platform_breakdown: Dict[str, Dict]
    top_influencers: List[Dict]
    temporal_projection: Dict


class InfluenceQuantifier:
    PLATFORM_WEIGHTS = {
        "twitter": {"reach_multiplier": 1.0, "engagement_weight": 1.2, "share_factor": 1.5},
        "reddit": {"reach_multiplier": 0.8, "engagement_weight": 1.5, "share_factor": 1.2},
        "telegram": {"reach_multiplier": 1.2, "engagement_weight": 0.9, "share_factor": 2.0},
    }

    ENGAGEMENT_NORMALIZATION = {
        "twitter": {"likes_per_follower": 0.01, "shares_per_follower": 0.005},
        "reddit": {"likes_per_follower": 0.02, "shares_per_follower": 0.008},
        "telegram": {"likes_per_follower": 0.005, "shares_per_follower": 0.02},
    }

    def __init__(self):
        self.decay_half_life = 24
        self.viral_threshold = 0.5

    def calculate_post_influence(self, post: Dict) -> Dict:
        platform = post.get("platform", "twitter").lower()
        weights = self.PLATFORM_WEIGHTS.get(platform, self.PLATFORM_WEIGHTS["twitter"])
        norms = self.ENGAGEMENT_NORMALIZATION.get(platform, self.ENGAGEMENT_NORMALIZATION["twitter"])

        follower_count = post.get("follower_count", 1000)
        likes = post.get("likes", 0)
        shares = post.get("shares", 0)
        comments = post.get("comments", 0)

        base_reach = follower_count * weights["reach_multiplier"]

        hours_since_post = max(1, post.get("hours_since_post", 1))
        decay_factor = math.pow(0.5, hours_since_post / self.decay_half_life)

        normalized_likes = likes / max(norms["likes_per_follower"] * follower_count, 1)
        normalized_shares = shares / max(norms["shares_per_follower"] * follower_count, 1)
        normalized_comments = comments / max(0.001 * follower_count, 1)

        engagement_score = (
            normalized_likes * 0.3 +
            normalized_shares * weights["share_factor"] * 0.5 +
            normalized_comments * 0.2
        )

        viral_boost = min(engagement_score, 3.0)

        estimated_impressions = int(base_reach * (1 + viral_boost) * decay_factor)
        total_engagement = likes + shares + comments
        engagement_rate = total_engagement / max(follower_count, 1) * 100

        secondary_reach = self._estimate_secondary_reach(shares, platform)

        return {
            "post_id": post.get("id", ""),
            "platform": platform,
            "author": post.get("author", ""),
            "follower_count": follower_count,
            "base_reach": int(base_reach),
            "estimated_impressions": estimated_impressions,
            "secondary_reach": secondary_reach,
            "total_potential_reach": estimated_impressions + secondary_reach,
            "engagement_score": engagement_score,
            "engagement_rate": engagement_rate,
            "likes": likes,
            "shares": shares,
            "comments": comments,
            "total_engagement": total_engagement,
            "decay_factor": decay_factor,
            "viral_boost": viral_boost
        }

    def _estimate_secondary_reach(self, shares: int, platform: str) -> int:
        if shares == 0:
            return 0

        avg_sharer_followers = {
            "twitter": 500,
            "reddit": 200,
            "telegram": 1000
        }.get(platform, 500)

        conversion_rate = 0.1
        return int(shares * avg_sharer_followers * conversion_rate)

    def aggregate_campaign_influence(self, posts: List[Dict]) -> InfluenceMetrics:
        if not posts:
            return InfluenceMetrics(
                total_reach=0,
                estimated_impressions=0,
                engagement_rate=0.0,
                virality_score=0.0,
                influence_level="negligible",
                platform_breakdown={},
                top_influencers=[],
                temporal_projection={}
            )

        post_metrics = [self.calculate_post_influence(post) for post in posts]

        total_reach = sum(m["total_potential_reach"] for m in post_metrics)
        total_impressions = sum(m["estimated_impressions"] for m in post_metrics)
        total_engagement = sum(m["total_engagement"] for m in post_metrics)
        total_followers = sum(p.get("follower_count", 1000) for p in posts)

        engagement_rate = total_engagement / max(total_followers, 1) * 100

        engagement_scores = [m["engagement_score"] for m in post_metrics]
        avg_engagement = np.mean(engagement_scores) if engagement_scores else 0
        viral_score = self._calculate_virality_score(post_metrics, posts)

        platform_breakdown = self._get_platform_breakdown(post_metrics)
        top_influencers = self._identify_top_influencers(post_metrics, posts)
        temporal_projection = self._project_temporal_spread(posts)

        influence_level = self._classify_influence(total_reach, viral_score)

        return InfluenceMetrics(
            total_reach=total_reach,
            estimated_impressions=total_impressions,
            engagement_rate=round(engagement_rate, 2),
            virality_score=round(viral_score, 3),
            influence_level=influence_level,
            platform_breakdown=platform_breakdown,
            top_influencers=top_influencers,
            temporal_projection=temporal_projection
        )

    def _calculate_virality_score(self, post_metrics: List[Dict], posts: List[Dict]) -> float:
        if len(post_metrics) < 2:
            return 0.0

        total_shares = sum(m["shares"] for m in post_metrics)
        total_likes = sum(m["likes"] for m in post_metrics)
        total_followers = sum(p.get("follower_count", 1000) for p in posts)

        share_rate = total_shares / max(total_followers, 1) * 1000
        like_rate = total_likes / max(total_followers, 1) * 100

        time_span = max(
            (p.get("timestamp", datetime.now()) - min(
                (pp.get("timestamp", datetime.now()) for pp in posts),
                key=lambda x: x
            )).total_seconds() / 3600
            for p in posts
        ) if len(posts) >= 2 else 1

        growth_rate = len(posts) / max(time_span, 1)

        virality = (
            min(share_rate / 10, 1.0) * 0.4 +
            min(like_rate / 50, 1.0) * 0.3 +
            min(growth_rate / 10, 1.0) * 0.3
        )

        return virality

    def _get_platform_breakdown(self, post_metrics: List[Dict]) -> Dict[str, Dict]:
        platform_data = defaultdict(lambda: {"posts": 0, "reach": 0, "engagement": 0, "influence": 0.0})

        for metric in post_metrics:
            platform = metric["platform"]
            platform_data[platform]["posts"] += 1
            platform_data[platform]["reach"] += metric["total_potential_reach"]
            platform_data[platform]["engagement"] += metric["total_engagement"]
            platform_data[platform]["influence"] += metric["engagement_score"]

        total_reach = sum(d["reach"] for d in platform_data.values())
        for platform in platform_data:
            platform_data[platform]["share"] = round(
                platform_data[platform]["reach"] / max(total_reach, 1) * 100, 1
            )

        return dict(platform_data)

    def _identify_top_influencers(self, post_metrics: List[Dict], posts: List[Dict], top_n: int = 5) -> List[Dict]:
        author_scores = defaultdict(lambda: {"total_reach": 0, "posts": 0, "avg_engagement": 0.0, "followers": 0})

        post_map = {p.get("id"): p for p in posts}

        for metric in post_metrics:
            post = post_map.get(metric["post_id"], {})
            author = metric["author"]

            author_scores[author]["total_reach"] += metric["total_potential_reach"]
            author_scores[author]["posts"] += 1
            author_scores[author]["avg_engagement"] += metric["engagement_score"]
            author_scores[author]["followers"] = max(
                author_scores[author]["followers"],
                post.get("follower_count", 1000)
            )

        for author in author_scores:
            author_scores[author]["avg_engagement"] /= max(author_scores[author]["posts"], 1)
            author_scores[author]["influence_score"] = (
                author_scores[author]["total_reach"] * 0.6 +
                author_scores[author]["avg_engagement"] * 10000 * 0.4
            )

        sorted_authors = sorted(
            [{"author": k, **v} for k, v in author_scores.items()],
            key=lambda x: x["influence_score"],
            reverse=True
        )

        return sorted_authors[:top_n]

    def _project_temporal_spread(self, posts: List[Dict], projection_hours: int = 72) -> Dict:
        if len(posts) < 2:
            return {"24h": 0, "48h": 0, "72h": 0, "growth_rate": 0}

        sorted_posts = sorted(posts, key=lambda p: p.get("timestamp", datetime.now()))
        time_span = (sorted_posts[-1]["timestamp"] - sorted_posts[0]["timestamp"]).total_seconds() / 3600
        time_span = max(time_span, 1)

        posts_per_hour = len(posts) / time_span
        current_reach = sum(p.get("follower_count", 1000) for p in posts)

        projections = {}
        for hours in [24, 48, 72]:
            decay = math.pow(0.5, hours / 48)
            projected_posts = posts_per_hour * min(hours, projection_hours) * decay
            projected_reach = current_reach * (1 + projected_posts / len(posts) * 0.5)
            projections[f"{hours}h"] = int(projected_reach)

        projections["growth_rate"] = round(posts_per_hour, 2)

        return projections

    def _classify_influence(self, total_reach: int, virality_score: float) -> str:
        if total_reach >= 1000000 or virality_score >= 0.8:
            return "global"
        elif total_reach >= 100000 or virality_score >= 0.5:
            return "national"
        elif total_reach >= 10000 or virality_score >= 0.3:
            return "regional"
        elif total_reach >= 1000 or virality_score >= 0.1:
            return "local"
        else:
            return "negligible"


class InfluenceHeatMapper:
    def __init__(self):
        self.geo_weights = {
            "north_america": 1.2,
            "europe": 1.0,
            "asia": 1.1,
            "south_america": 0.8,
            "africa": 0.7,
            "oceania": 0.9
        }

    def generate_heatmap_data(self, posts_with_location: List[Dict]) -> Dict:
        geo_distribution = defaultdict(lambda: {"count": 0, "reach": 0, "sentiment": 0.0})

        for post in posts_with_location:
            location = post.get("location", {"lat": 0, "lon": 0})
            region = self._classify_region(location)

            geo_distribution[region]["count"] += 1
            geo_distribution[region]["reach"] += post.get("follower_count", 1000)
            geo_distribution[region]["sentiment"] += post.get("sentiment_score", 0.0)

        for region in geo_distribution:
            geo_distribution[region]["avg_sentiment"] = round(
                geo_distribution[region]["sentiment"] / geo_distribution[region]["count"], 2
            )
            geo_distribution[region]["weighted_reach"] = int(
                geo_distribution[region]["reach"] * self.geo_weights.get(region, 1.0)
            )

        return dict(geo_distribution)

    def _classify_region(self, location: Dict) -> str:
        lat, lon = location.get("lat", 0), location.get("lon", 0)

        if lat > 0 and lon < -30:
            return "north_america"
        elif lat > 35 and lon > -30 and lon < 60:
            return "europe"
        elif lat > -10 and lon > 60:
            return "asia"
        elif lat < 15 and lon < -30:
            return "south_america"
        elif lat < 35 and lat > -35 and lon > -30 and lon < 60:
            return "africa"
        elif lat < 0 and lon > 100:
            return "oceania"
        else:
            return "unknown"
