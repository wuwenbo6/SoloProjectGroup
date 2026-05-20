import re
from typing import List, Dict, Tuple, Optional
from difflib import SequenceMatcher

COMMON_ALIASES = {
    "elon musk": ["elon", "musk", "elon reeve musk"],
    "tim cook": ["timothy cook", "tim"],
    "steve jobs": ["steven jobs", "jobs"],
    "bill gates": ["william gates", "gates"],
    "mark zuckerberg": ["zuckerberg", "mark", "zuck"],
    "apple": ["apple inc", "apple computer", "apple corporation"],
    "google": ["alphabet", "google inc"],
    "microsoft": ["ms", "msft"],
    "amazon": ["amazon com", "amazon inc"],
    "tesla": ["tesla motors", "tesla inc"],
    "facebook": ["fb", "meta"],
    "new york": ["nyc", "new york city", "ny"],
    "los angeles": ["la", "la city"],
    "san francisco": ["sf", "san fran", "bay area"],
    "washington": ["dc", "washington dc", "washingtons"],
    "london": ["london city", "greater london"],
    "paris": ["paris city"],
    "tokyo": ["tokyo city"],
    "beijing": ["peking", "beijing city"],
    "shanghai": ["shanghai city"],
}

def normalize_name(name: str) -> str:
    name = name.lower().strip()
    name = re.sub(r'[^a-z0-9\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    return name.strip()

def string_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, normalize_name(a), normalize_name(b)).ratio()

def is_alias(name1: str, name2: str, threshold: float = 0.85) -> Tuple[bool, float]:
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)
    
    if norm1 == norm2:
        return True, 1.0
    
    if norm1 in COMMON_ALIASES:
        if norm2 in COMMON_ALIASES[norm1]:
            return True, 0.95
    
    if norm2 in COMMON_ALIASES:
        if norm1 in COMMON_ALIASES[norm2]:
            return True, 0.95
    
    for canonical, aliases in COMMON_ALIASES.items():
        if norm1 in aliases and norm2 in aliases:
            return True, 0.9
        if norm1 == canonical and norm2 in aliases:
            return True, 0.95
        if norm2 == canonical and norm1 in aliases:
            return True, 0.95
    
    tokens1 = set(norm1.split())
    tokens2 = set(norm2.split())
    
    if len(tokens1) > 1 and len(tokens2) > 1:
        if tokens1.issubset(tokens2) or tokens2.issubset(tokens1):
            intersection = tokens1.intersection(tokens2)
            if len(intersection) >= 1:
                return True, 0.88
    
    similarity = string_similarity(name1, name2)
    if similarity >= threshold:
        return True, similarity
    
    return False, similarity

def find_duplicates(entities: List[str], threshold: float = 0.85) -> Dict[str, List[str]]:
    groups = {}
    processed = set()
    
    for i, entity1 in enumerate(entities):
        if entity1 in processed:
            continue
        
        canonical = entity1
        aliases = [entity1]
        processed.add(entity1)
        
        for entity2 in entities[i+1:]:
            if entity2 in processed:
                continue
            
            is_match, _ = is_alias(entity1, entity2, threshold)
            if is_match:
                aliases.append(entity2)
                processed.add(entity2)
        
        if len(aliases) > 1:
            groups[canonical] = aliases
    
    return groups

def resolve_entity(name: str, existing_entities: List[str], 
                   threshold: float = 0.85) -> Optional[str]:
    norm_name = normalize_name(name)
    
    for existing in existing_entities:
        is_match, _ = is_alias(name, existing, threshold)
        if is_match:
            return existing
    
    return None

def get_canonical_name(name: str) -> str:
    norm = normalize_name(name)
    
    for canonical, aliases in COMMON_ALIASES.items():
        if norm == canonical or norm in aliases:
            return canonical.title()
    
    return name

def add_custom_alias(canonical: str, alias: str):
    norm_canonical = normalize_name(canonical)
    norm_alias = normalize_name(alias)
    
    if norm_canonical not in COMMON_ALIASES:
        COMMON_ALIASES[norm_canonical] = []
    
    if norm_alias not in COMMON_ALIASES[norm_canonical]:
        COMMON_ALIASES[norm_canonical].append(norm_alias)
