import re
from typing import List, Dict
from textblob import TextBlob
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import word_tokenize
from nltk.sentiment import SentimentIntensityAnalyzer
from .sarcasm_detector import SarcasmDetector
import logging

logger = logging.getLogger(__name__)

try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
    nltk.data.find('sentiment/vader_lexicon')
    nltk.data.find('taggers/averaged_perceptron_tagger')
except LookupError:
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('vader_lexicon')
    nltk.download('averaged_perceptron_tagger')


class EnsembleSentimentAnalyzer:
    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()
        self.sarcasm_detector = SarcasmDetector()

    def analyze_vader(self, text: str) -> Dict:
        scores = self.vader.polarity_scores(text)
        return {
            "score": scores["compound"],
            "positive": scores["pos"],
            "negative": scores["neg"],
            "neutral": scores["neu"],
            "label": self._get_label(scores["compound"])
        }

    def analyze_textblob(self, text: str) -> Dict:
        blob = TextBlob(text)
        polarity = blob.sentiment.polarity
        return {
            "score": polarity,
            "subjectivity": blob.sentiment.subjectivity,
            "label": self._get_label(polarity)
        }

    def _get_label(self, score: float) -> str:
        if score > 0.1:
            return "positive"
        elif score < -0.1:
            return "negative"
        else:
            return "neutral"

    def analyze(self, text: str, use_sarcasm_detection: bool = True) -> Dict:
        vader_result = self.analyze_vader(text)
        textblob_result = self.analyze_textblob(text)

        sarcasm_result = None
        if use_sarcasm_detection:
            sarcasm_result = self.sarcasm_detector.detect_sarcasm(text)

        vader_score = vader_result["score"]
        textblob_score = textblob_result["score"]

        if use_sarcasm_detection and sarcasm_result and sarcasm_result["is_sarcastic"]:
            logger.debug(f"Sarcasm detected (score: {sarcasm_result['score']:.2f}): {text[:50]}...")
            vader_score = self.sarcasm_detector.adjust_sentiment_for_sarcasm(vader_score, sarcasm_result)
            textblob_score = self.sarcasm_detector.adjust_sentiment_for_sarcasm(textblob_score, sarcasm_result)

        weights = {"vader": 0.6, "textblob": 0.4}
        ensemble_score = vader_score * weights["vader"] + textblob_score * weights["textblob"]

        agreement = vader_result["label"] == textblob_result["label"]
        confidence = "high" if agreement and abs(ensemble_score) > 0.3 else \
                     "medium" if abs(ensemble_score) > 0.1 else "low"

        final_label = self._get_label(ensemble_score)

        if sarcasm_result and sarcasm_result["is_sarcastic"] and final_label == "positive":
            final_label = "negative"
            ensemble_score = -abs(ensemble_score) * 0.7

        return {
            "score": float(ensemble_score),
            "label": final_label,
            "confidence": confidence,
            "agreement": agreement,
            "vader": vader_result,
            "textblob": textblob_result,
            "sarcasm": sarcasm_result
        }


class NLPProcessor:
    def __init__(self):
        self.stop_words = set(stopwords.words('english'))
        self.entity_patterns = {
            'hashtag': r'#\w+',
            'mention': r'@\w+',
            'url': r'https?://\S+',
            'email': r'\S+@\S+\.\S+',
        }
        self.sentiment_analyzer = EnsembleSentimentAnalyzer()

    def extract_entities(self, text: str) -> List[str]:
        entities = []

        for pattern in self.entity_patterns.values():
            matches = re.findall(pattern, text)
            entities.extend(matches)

        blob = TextBlob(text)
        for np in blob.noun_phrases:
            if len(np) > 2 and np.lower() not in self.stop_words:
                entities.append(np)

        words = word_tokenize(text)
        important_words = [
            word for word in words
            if word.isalnum()
            and word.lower() not in self.stop_words
            and len(word) > 3
        ]
        entities.extend(important_words[:10])

        return list(set(entities))

    def analyze_sentiment(self, text: str, use_sarcasm_detection: bool = True) -> dict:
        result = self.sentiment_analyzer.analyze(text, use_sarcasm_detection)

        output = {
            "score": result["score"],
            "label": result["label"],
            "confidence": result["confidence"],
            "subjectivity": result["textblob"]["subjectivity"],
        }

        if result["sarcasm"] and result["sarcasm"]["is_sarcastic"]:
            output["is_sarcastic"] = True
            output["sarcasm_score"] = result["sarcasm"]["score"]
            output["sarcasm_indicators"] = result["sarcasm"]["indicators"]

        return output

    def extract_keywords(self, text: str, top_n: int = 10) -> List[str]:
        entities = self.extract_entities(text)
        return entities[:top_n]

    def batch_analyze_sentiment(self, texts: List[str]) -> List[dict]:
        return [self.analyze_sentiment(text) for text in texts]
