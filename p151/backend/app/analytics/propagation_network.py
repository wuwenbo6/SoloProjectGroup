from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass
from collections import defaultdict
import math
from datetime import datetime, timedelta
import networkx as nx
import numpy as np


@dataclass
class PostNode:
    id: str
    platform: str
    author: str
    content: str
    timestamp: datetime
    follower_count: int = 0
    likes: int = 0
    shares: int = 0
    comments: int = 0
    sentiment_score: float = 0.0
    entities: List[str] = None


@dataclass
class RumorDetectionResult:
    is_rumor: bool
    rumor_score: float
    confidence: str
    propagation_speed: float
    viral_coefficient: float
    suspicious_patterns: List[str]
    key_spreaders: List[Dict]
    network_metrics: Dict


class PropagationAnalyzer:
    def __init__(self):
        self.G = nx.DiGraph()
        self.content_clusters = defaultdict(list)

    def build_network(self, posts: List[PostNode]) -> nx.DiGraph:
        self.G.clear()

        for post in posts:
            self.G.add_node(
                post.id,
                platform=post.platform,
                author=post.author,
                timestamp=post.timestamp,
                followers=post.follower_count,
                engagement=post.likes + post.shares + post.comments,
                sentiment=post.sentiment_score,
                entities=post.entities or []
            )

        for i, post1 in enumerate(posts):
            for post2 in posts[i + 1:]:
                if self._has_propagation_link(post1, post2):
                    weight = self._calculate_link_weight(post1, post2)
                    self.G.add_edge(post1.id, post2.id, weight=weight)

        self._build_content_clusters(posts)
        return self.G

    def _has_propagation_link(self, post1: PostNode, post2: PostNode) -> bool:
        time_diff = abs((post2.timestamp - post1.timestamp).total_seconds() / 3600)
        if time_diff > 48:
            return False

        entities1 = set(post1.entities or [])
        entities2 = set(post2.entities or [])
        common_entities = entities1.intersection(entities2)

        if len(common_entities) >= 2:
            return True

        content1 = post1.content.lower()
        content2 = post2.content.lower()
        words1 = set(content1.split())
        words2 = set(content2.split())
        common_words = words1.intersection(words2)

        if len(common_words) >= 3:
            return True

        return False

    def _calculate_link_weight(self, post1: PostNode, post2: PostNode) -> float:
        time_diff = abs((post2.timestamp - post1.timestamp).total_seconds() / 3600)
        time_weight = max(0, 1 - time_diff / 48)

        entities1 = set(post1.entities or [])
        entities2 = set(post2.entities or [])
        jaccard = len(entities1.intersection(entities2)) / max(len(entities1.union(entities2)), 1)

        follower_factor = math.log1p(min(post1.follower_count, post2.follower_count)) / 10

        return (time_weight * 0.4 + jaccard * 0.4 + follower_factor * 0.2)

    def _build_content_clusters(self, posts: List[PostNode]):
        self.content_clusters.clear()
        for post in posts:
            if post.entities:
                for entity in post.entities[:3]:
                    self.content_clusters[entity].append(post.id)

    def calculate_propagation_metrics(self) -> Dict:
        if self.G.number_of_nodes() == 0:
            return {}

        degrees = [d for n, d in self.G.degree()]
        in_degrees = [d for n, d in self.G.in_degree()]
        out_degrees = [d for n, d in self.G.out_degree()]

        try:
            betweenness = nx.betweenness_centrality(self.G, k=min(50, self.G.number_of_nodes()))
            eigenvector = nx.eigenvector_centrality_numpy(self.G, max_iter=1000)
        except:
            betweenness = {}
            eigenvector = {}

        clustering_coeff = nx.average_clustering(self.G.to_undirected()) if self.G.number_of_nodes() > 0 else 0

        return {
            "total_nodes": self.G.number_of_nodes(),
            "total_edges": self.G.number_of_edges(),
            "avg_degree": np.mean(degrees) if degrees else 0,
            "max_degree": max(degrees) if degrees else 0,
            "density": nx.density(self.G),
            "clustering_coefficient": clustering_coeff,
            "num_connected_components": nx.number_connected_components(self.G.to_undirected()),
            "avg_betweenness": np.mean(list(betweenness.values())) if betweenness else 0,
            "avg_eigenvector": np.mean(list(eigenvector.values())) if eigenvector else 0,
        }

    def detect_rumor_patterns(self, posts: List[PostNode]) -> RumorDetectionResult:
        if len(posts) < 3:
            return RumorDetectionResult(
                is_rumor=False,
                rumor_score=0.0,
                confidence="low",
                propagation_speed=0.0,
                viral_coefficient=0.0,
                suspicious_patterns=["insufficient_data"],
                key_spreaders=[],
                network_metrics={}
            )

        self.build_network(posts)
        metrics = self.calculate_propagation_metrics()

        suspicious_patterns = []
        rumor_score = 0.0

        time_span = max((p.timestamp for p in posts), default=datetime.now()) - min((p.timestamp for p in posts), default=datetime.now())
        posts_per_hour = len(posts) / max(time_span.total_seconds() / 3600, 1)
        propagation_speed = posts_per_hour

        if posts_per_hour > 10:
            suspicious_patterns.append("explosive_growth")
            rumor_score += 0.2

        sentiment_scores = [p.sentiment_score for p in posts]
        sentiment_controversy = np.std(sentiment_scores) if sentiment_scores else 0
        if sentiment_controversy > 0.5:
            suspicious_patterns.append("high_sentiment_controversy")
            rumor_score += 0.15

        if metrics.get("density", 0) < 0.1 and metrics.get("total_edges", 0) > 5:
            suspicious_patterns.append("unnatural_network_structure")
            rumor_score += 0.1

        platforms = defaultdict(int)
        for post in posts:
            platforms[post.platform] += 1

        if len(platforms) >= 2 and max(platforms.values()) / len(posts) < 0.7:
            suspicious_patterns.append("cross_platform_spread")
            rumor_score += 0.15

        total_engagement = sum(p.likes + p.shares + p.comments for p in posts)
        engagement_rate = total_engagement / len(posts) if posts else 0
        viral_coefficient = engagement_rate * posts_per_hour / 100

        if viral_coefficient > 50:
            suspicious_patterns.append("extreme_viral_growth")
            rumor_score += 0.2

        content_similarity = self._calculate_content_similarity(posts)
        if content_similarity > 0.7:
            suspicious_patterns.append("coordinated_content")
            rumor_score += 0.15

        timed_posts = sorted(posts, key=lambda x: x.timestamp)
        early_adopters = timed_posts[:max(3, len(posts) // 5)]
        early_followers = sum(p.follower_count for p in early_adopters)
        if early_followers > 1000000:
            suspicious_patterns.append("influencer_seeded")
            rumor_score += 0.1

        key_spreaders = self._identify_key_spreaders(posts)

        is_rumor = rumor_score >= 0.4
        confidence = "high" if rumor_score >= 0.6 else "medium" if rumor_score >= 0.4 else "low"

        return RumorDetectionResult(
            is_rumor=is_rumor,
            rumor_score=min(rumor_score, 1.0),
            confidence=confidence,
            propagation_speed=propagation_speed,
            viral_coefficient=viral_coefficient,
            suspicious_patterns=suspicious_patterns,
            key_spreaders=key_spreaders,
            network_metrics=metrics
        )

    def _calculate_content_similarity(self, posts: List[PostNode]) -> float:
        if len(posts) < 2:
            return 0.0

        all_words = []
        for post in posts:
            words = set(post.content.lower().split())
            all_words.append(words)

        pairwise_similarities = []
        for i in range(len(all_words)):
            for j in range(i + 1, len(all_words)):
                intersection = len(all_words[i].intersection(all_words[j]))
                union = len(all_words[i].union(all_words[j]))
                if union > 0:
                    pairwise_similarities.append(intersection / union)

        return np.mean(pairwise_similarities) if pairwise_similarities else 0

    def _identify_key_spreaders(self, posts: List[PostNode], top_n: int = 5) -> List[Dict]:
        node_scores = {}
        for post in posts:
            influence_score = post.follower_count * 0.5 + (post.likes + post.shares * 2 + post.comments) * 0.5
            node_scores[post.id] = {
                "post_id": post.id,
                "author": post.author,
                "platform": post.platform,
                "follower_count": post.follower_count,
                "engagement": post.likes + post.shares + post.comments,
                "influence_score": influence_score,
                "content_preview": post.content[:100]
            }

        sorted_spreaders = sorted(node_scores.values(), key=lambda x: x["influence_score"], reverse=True)
        return sorted_spreaders[:top_n]


class RumorClassifier:
    def __init__(self):
        self.rumor_keywords = {
            "breaking", "urgent", "shocking", "unbelievable",
            "you won't believe", "secret", "exposed", "leaked",
            "they don't want you to know", "truth about", "hidden",
            "bombshell", "explosive", "shocking revelation"
        }
        self.emotional_intensifiers = {
            "absolutely", "completely", "totally", "literally",
            "100%", "fact", "truth", "verified"
        }

    def classify_content(self, content: str) -> Dict:
        content_lower = content.lower()
        score = 0.0
        flags = []

        keyword_matches = sum(1 for kw in self.rumor_keywords if kw in content_lower)
        if keyword_matches >= 1:
            score += keyword_matches * 0.1
            flags.append("sensationalist_language")

        intensifier_matches = sum(1 for kw in self.emotional_intensifiers if kw in content_lower)
        if intensifier_matches >= 2:
            score += 0.1
            flags.append("emotional_intensifiers")

        all_caps_words = sum(1 for word in content.split() if word.isupper() and len(word) >= 3)
        if all_caps_words >= 3:
            score += 0.15
            flags.append("excessive_capitalization")

        exclamation_count = content.count("!")
        if exclamation_count >= 3:
            score += 0.1
            flags.append("excessive_punctuation")

        question_count = content.count("?")
        if question_count >= 2 and exclamation_count >= 2:
            score += 0.1
            flags.append("provocative_formatting")

        source_indicators = ["according to", "sources say", "reportedly", "rumor has it", "allegedly"]
        if any(ind in content_lower for ind in source_indicators):
            score += 0.05
            flags.append("vague_sourcing")

        denial_indicators = ["not true", "fake news", "debunked", "false", "misinformation"]
        if any(ind in content_lower for ind in denial_indicators):
            score -= 0.2
            flags.append("contains_debunking_references")

        return {
            "content_rumor_score": min(score, 1.0),
            "classification_flags": flags,
            "risk_level": "high" if score >= 0.3 else "medium" if score >= 0.15 else "low"
        }
