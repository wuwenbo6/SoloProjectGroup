import spacy
import re
from datetime import datetime
from typing import List, Dict, Optional, Tuple
import json

nlp = spacy.load("en_core_web_sm")

MONTHS = {
    'january': 1, 'jan': 1,
    'february': 2, 'feb': 2,
    'march': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'may': 5,
    'june': 6, 'jun': 6,
    'july': 7, 'jul': 7,
    'august': 8, 'aug': 8,
    'september': 9, 'sep': 9, 'sept': 9,
    'october': 10, 'oct': 10,
    'november': 11, 'nov': 11,
    'december': 12, 'dec': 12
}

RELATIVE_TIME_PATTERNS = [
    (r'in (\d+) days', 'days', 1),
    (r'in (\d+) weeks', 'weeks', 1),
    (r'in (\d+) months', 'months', 1),
    (r'in (\d+) years', 'years', 1),
    (r'(\d+) days ago', 'days', -1),
    (r'(\d+) weeks ago', 'weeks', -1),
    (r'(\d+) months ago', 'months', -1),
    (r'(\d+) years ago', 'years', -1),
]

def parse_date_string(date_str: str) -> Optional[str]:
    date_str = date_str.lower().strip()
    
    year_match = re.search(r'\b(19|20)\d{2}\b', date_str)
    month_match = None
    day_match = None
    
    for month_name, month_num in MONTHS.items():
        if month_name in date_str:
            month_match = month_num
            break
    
    day_match_result = re.search(r'\b(\d{1,2})(?:st|nd|rd|th)?\b', date_str)
    if day_match_result:
        day = int(day_match_result.group(1))
        if 1 <= day <= 31:
            day_match = day
    
    if year_match:
        year = int(year_match.group())
        if month_match and day_match:
            return f"{year}-{month_match:02d}-{day_match:02d}"
        elif month_match:
            return f"{year}-{month_match:02d}-01"
        else:
            return f"{year}-01-01"
    
    return None

def extract_events_from_text(text: str) -> List[Dict]:
    doc = nlp(text)
    events = []
    
    date_entities = []
    event_entities = []
    person_entities = []
    org_entities = []
    gpe_entities = []
    
    for ent in doc.ents:
        if ent.label_ == "DATE":
            parsed_date = parse_date_string(ent.text)
            if parsed_date:
                date_entities.append({
                    "text": ent.text,
                    "parsed_date": parsed_date,
                    "start": ent.start_char,
                    "end": ent.end_char
                })
        elif ent.label_ == "EVENT":
            event_entities.append({
                "text": ent.text,
                "start": ent.start_char,
                "end": ent.end_char
            })
        elif ent.label_ == "PERSON":
            person_entities.append(ent.text)
        elif ent.label_ == "ORG":
            org_entities.append(ent.text)
        elif ent.label_ == "GPE":
            gpe_entities.append(ent.text)
    
    sentences = list(doc.sents)
    
    for i, sent in enumerate(sentences):
        sent_text = sent.text
        sent_start = sent.start_char
        
        dates_in_sent = [d for d in date_entities 
                        if d["start"] >= sent_start and d["end"] <= sent_start + len(sent_text)]
        
        if dates_in_sent:
            event_name = extract_event_name(sent_text)
            event_date = dates_in_sent[0]["parsed_date"]
            
            involved_people = [p for p in person_entities if p in sent_text]
            involved_orgs = [o for o in org_entities if o in sent_text]
            involved_places = [g for g in gpe_entities if g in sent_text]
            
            events.append({
                "name": event_name,
                "description": sent_text.strip(),
                "date": event_date,
                "raw_date_text": dates_in_sent[0]["text"],
                "involved_entities": list(set(involved_people + involved_orgs)),
                "location": involved_places[0] if involved_places else None,
                "importance": calculate_importance(sent_text, involved_people, involved_orgs)
            })
    
    events.sort(key=lambda x: x["date"])
    
    return events

def extract_event_name(sentence: str) -> str:
    doc = nlp(sentence)
    
    for token in doc:
        if token.pos_ == "VERB":
            verb_phrase = token.lemma_
            for child in token.children:
                if child.dep_ in ["dobj", "pobj", "attr"]:
                    noun_phrase = child.text
                    return f"{verb_phrase.capitalize()} {noun_phrase}"
    
    words = sentence.split()
    if len(words) > 5:
        return " ".join(words[:5]) + "..."
    return sentence[:30] + "..." if len(sentence) > 30 else sentence

def calculate_importance(text: str, people: List[str], orgs: List[str]) -> int:
    score = 50
    
    score += len(people) * 10
    score += len(orgs) * 5
    
    important_words = ['announced', 'signed', 'launched', 'founded', 'acquired', 
                       'merged', 'released', 'published', 'died', 'born', 'married']
    for word in important_words:
        if word in text.lower():
            score += 10
    
    return min(score, 100)

def generate_timeline_from_graph(graph_data: Dict) -> List[Dict]:
    events = []
    
    for node in graph_data.get("nodes", []):
        if node.get("properties", {}).get("date"):
            events.append({
                "name": node["name"],
                "date": node["properties"]["date"],
                "description": node.get("properties", {}).get("description", ""),
                "type": node.get("type", "EVENT"),
                "importance": node.get("properties", {}).get("importance", 50)
            })
    
    for link in graph_data.get("links", []):
        if link.get("properties", {}).get("date"):
            events.append({
                "name": f"{link.get('source_label', '')} {link['relation']} {link.get('target_label', '')}",
                "date": link["properties"]["date"],
                "description": link.get("properties", {}).get("description", ""),
                "type": "RELATION",
                "importance": 40
            })
    
    events.sort(key=lambda x: x["date"])
    
    return events

def detect_event_order(events: List[Dict]) -> List[Dict]:
    sorted_events = sorted(events, key=lambda x: x["date"])
    
    for i, event in enumerate(sorted_events):
        event["order"] = i + 1
        if i > 0:
            prev_event = sorted_events[i - 1]
            try:
                date1 = datetime.strptime(prev_event["date"][:10], "%Y-%m-%d")
                date2 = datetime.strptime(event["date"][:10], "%Y-%m-%d")
                days_diff = (date2 - date1).days
                event["days_after_previous"] = days_diff
            except:
                event["days_after_previous"] = None
    
    return sorted_events
