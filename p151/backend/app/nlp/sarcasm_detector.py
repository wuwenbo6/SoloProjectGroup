import re
from typing import Dict, List, Tuple
from collections import defaultdict
import nltk
from nltk.tokenize import word_tokenize
from nltk.tag import pos_tag


class SarcasmDetector:
    def __init__(self):
        self.sarcastic_patterns = [
            r"yeah\s+right\b",
            r"sure\s*\.{2,}",
            r"obviously\s*\.{2,}",
            r"like\s+that's\s+ever\s+going\s+to\s+happen",
            r"as\s+if\b",
            r"right\s*\.{2,}",
            r"totally\s*\.{2,}",
            r"wow\s*\.{2,}",
            r"really\s*\?{2,}",
            r"great\s*\.{2,}\s*not",
            r"good\s*job\s*\.{2,}",
            r"nice\s*\.{2,}\s*not",
        ]

        self.contrast_words = {
            "but", "however", "yet", "still", "though",
            "although", "nevertheless", "nonetheless"
        }

        self.intensifiers = {
            "totally", "completely", "absolutely", "literally",
            "seriously", "really", "so", "such", "very"
        }

        self.positive_words = {
            "great", "amazing", "wonderful", "fantastic", "excellent",
            "perfect", "brilliant", "awesome", "nice", "good", "love",
            "best", "happy", "joy", "excited", "beautiful", "superb"
        }

        self.negative_words = {
            "bad", "terrible", "awful", "horrible", "worst", "hate",
            "disappointed", "angry", "sad", "upset", "poor", "failed",
            "problem", "issue", "wrong", "annoying", "frustrating"
        }

    def detect_pattern_based(self, text: str) -> Tuple[float, List[str]]:
        text_lower = text.lower()
        matches = []
        score = 0.0

        for pattern in self.sarcastic_patterns:
            if re.search(pattern, text_lower, re.IGNORECASE):
                matches.append(pattern)
                score += 0.15

        exclamation_count = text.count('!')
        if exclamation_count >= 3:
            score += 0.1
            matches.append("multiple_exclamation")

        question_count = text.count('?')
        if question_count >= 2:
            score += 0.08
            matches.append("multiple_question")

        uppercase_ratio = sum(1 for c in text if c.isupper()) / max(len(text), 1)
        if uppercase_ratio > 0.5 and len(text) > 10:
            score += 0.12
            matches.append("excessive_uppercase")

        emoji_patterns = ["🙄", "😒", "😏", "😐", "💀"]
        for emoji in emoji_patterns:
            if emoji in text:
                score += 0.1
                matches.append(f"sarcastic_emoji_{emoji}")

        return min(score, 1.0), matches

    def detect_contrast_based(self, text: str) -> Tuple[float, List[str]]:
        text_lower = text.lower()
        words = word_tokenize(text_lower)
        score = 0.0
        matches = []

        has_contrast = any(word in self.contrast_words for word in words)
        if has_contrast:
            score += 0.15
            matches.append("contrast_conjunction")

        pos_tags = pos_tag(words)
        adjectives = [word for word, tag in pos_tags if tag.startswith('JJ')]

        has_positive = any(word in self.positive_words for word in adjectives)
        has_negative = any(word in self.negative_words for word in adjectives)

        if has_positive and has_negative:
            score += 0.2
            matches.append("sentiment_mix")

        has_intensifier = any(word in self.intensifiers for word in words)
        if has_intensifier and has_positive:
            score += 0.1
            matches.append("intensified_positive")

        quotes = re.findall(r"[\"'](.*?)[\"']", text)
        if quotes:
            score += 0.08
            matches.append("quoted_text")

        return min(score, 1.0), matches

    def detect_situational(self, text: str) -> Tuple[float, List[str]]:
        text_lower = text.lower()
        score = 0.0
        matches = []

        if re.search(r"\bi\s+love\s+it\s+when\b", text_lower):
            score += 0.25
            matches.append("love_it_when")

        if re.search(r"\bthanks\s+a?\s*lot\b", text_lower) and len(text) < 50:
            score += 0.15
            matches.append("thanks_a_lot")

        if re.search(r"\bway\s+to\s+go\b", text_lower) and len(text) < 40:
            score += 0.15
            matches.append("way_to_go")

        if re.search(r"\boh\s+please\b", text_lower):
            score += 0.25
            matches.append("oh_please")

        if re.search(r"\bgive\s+me\s+a\s+break\b", text_lower):
            score += 0.3
            matches.append("give_me_a_break")

        return min(score, 1.0), matches

    def detect_sarcasm(self, text: str) -> Dict:
        pattern_score, pattern_matches = self.detect_pattern_based(text)
        contrast_score, contrast_matches = self.detect_contrast_based(text)
        situational_score, situational_matches = self.detect_situational_based(text)

        weights = {
            "pattern": 0.35,
            "contrast": 0.35,
            "situational": 0.30,
        }

        final_score = (
            pattern_score * weights["pattern"] +
            contrast_score * weights["contrast"] +
            situational_score * weights["situational"]
        )

        all_matches = pattern_matches + contrast_matches + situational_matches

        is_sarcastic = final_score >= 0.3
        confidence = "high" if final_score >= 0.5 else "medium" if final_score >= 0.3 else "low"

        return {
            "is_sarcastic": is_sarcastic,
            "score": final_score,
            "confidence": confidence,
            "indicators": all_matches,
            "component_scores": {
                "pattern": pattern_score,
                "contrast": contrast_score,
                "situational": situational_score
            }
        }

    def adjust_sentiment_for_sarcasm(self, sentiment_score: float, sarcasm_result: Dict) -> float:
        if not sarcasm_result["is_sarcastic"]:
            return sentiment_score

        sarcasm_strength = sarcasm_result["score"]
        adjustment = sentiment_score * (-1) * sarcasm_strength * 0.8

        return max(-1.0, min(1.0, sentiment_score + adjustment))
