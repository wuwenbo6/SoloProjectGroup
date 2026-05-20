from typing import List, Dict, Any, Optional, Tuple
import re
from difflib import SequenceMatcher

CONFLICT_PATTERNS = {
    "location": [
        (r"lives in (.+)", r"lives in (.+)"),
        (r"resides in (.+)", r"resides in (.+)"),
        (r"based in (.+)", r"based in (.+)"),
        (r"headquartered in (.+)", r"headquartered in (.+)"),
    ],
    "position": [
        (r"is (?:the )?(.+) of", r"is (?:the )?(.+) of"),
        (r"serves as (.+)", r"serves as (.+)"),
        (r"works as (.+)", r"works as (.+)"),
    ],
    "organization": [
        (r"works at (.+)", r"works at (.+)"),
        (r"employed by (.+)", r"employed by (.+)"),
        (r"founder of (.+)", r"founder of (.+)"),
        (r"ceo of (.+)", r"ceo of (.+)"),
    ],
    "relationship": [
        (r"married to (.+)", r"married to (.+)"),
        (r"parent of (.+)", r"parent of (.+)"),
        (r"child of (.+)", r"child of (.+)"),
    ],
}

NEGATION_WORDS = {"not", "never", "no", "isn't", "aren't", "wasn't", "weren't", "don't", "doesn't", "didn't", "cannot", "can't", "won't", "wouldn't"}

OPPOSITE_RELATIONS = {
    "LIVES_IN": {"DIED_IN"},
    "WORKS_FOR": {"FOUNDED", "OWNS"},
    "FOUNDED": {"WORKS_FOR"},
    "MARRIED_TO": set(),
    "PARENT_OF": {"CHILD_OF"},
    "CHILD_OF": {"PARENT_OF"},
    "LOCATED_IN": set(),
}

def normalize_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_facts(description: str) -> List[Dict[str, str]]:
    facts = []
    desc_lower = description.lower()
    
    for category, patterns in CONFLICT_PATTERNS.items():
        for pattern1, _ in patterns:
            matches = re.findall(pattern1, desc_lower)
            for match in matches:
                if isinstance(match, tuple):
                    match = match[0]
                facts.append({
                    "category": category,
                    "value": match.strip(),
                    "source": description
                })
    
    return facts

def has_negation(text: str) -> bool:
    words = set(normalize_text(text).split())
    return bool(words & NEGATION_WORDS)

def check_statement_conflict(new_statement: str, existing_statements: List[str]) -> Tuple[bool, List[str]]:
    conflicts = []
    new_facts = extract_facts(new_statement)
    new_normalized = normalize_text(new_statement)
    new_has_negation = has_negation(new_statement)
    
    for existing in existing_statements:
        existing_normalized = normalize_text(existing)
        existing_has_negation = has_negation(existing)
        
        if new_has_negation != existing_has_negation:
            clean_new = re.sub(r'\b(' + '|'.join(NEGATION_WORDS) + r')\b', '', new_normalized).strip()
            clean_existing = re.sub(r'\b(' + '|'.join(NEGATION_WORDS) + r')\b', '', existing_normalized).strip()
            
            similarity = SequenceMatcher(None, clean_new, clean_existing).ratio()
            if similarity > 0.7:
                conflicts.append(f"Contradiction with existing statement: '{existing}'")
                continue
        
        existing_facts = extract_facts(existing)
        
        for new_fact in new_facts:
            for existing_fact in existing_facts:
                if new_fact["category"] == existing_fact["category"]:
                    new_val = new_fact["value"]
                    existing_val = existing_fact["value"]
                    
                    if new_val != existing_val:
                        similarity = SequenceMatcher(None, new_val, existing_val).ratio()
                        if similarity < 0.6:
                            conflicts.append(
                                f"Conflict in {new_fact['category']}: new says '{new_val}' "
                                f"but existing says '{existing_val}'"
                            )
    
    return len(conflicts) > 0, conflicts

def check_relationship_conflict(
    new_source: str, new_relation: str, new_target: str,
    existing_relationships: List[Dict[str, Any]],
    entity_resolver = None
) -> Tuple[bool, List[str]]:
    conflicts = []
    new_relation_upper = new_relation.upper()
    
    for rel in existing_relationships:
        existing_source = rel.get("source_name", rel.get("source", ""))
        existing_relation = rel.get("relation", "").upper()
        existing_target = rel.get("target_name", rel.get("target", ""))
        
        source_match = new_source == existing_source
        target_match = new_target == existing_target
        
        if entity_resolver:
            source_match = source_match or entity_resolver.is_alias(new_source, existing_source)[0]
            target_match = target_match or entity_resolver.is_alias(new_target, existing_target)[0]
        
        if source_match and target_match:
            if existing_relation in OPPOSITE_RELATIONS.get(new_relation_upper, set()):
                conflicts.append(
                    f"Opposite relationship: '{new_relation}' conflicts with existing '{existing_relation}' "
                    f"between {new_source} and {new_target}"
                )
            elif new_relation_upper != existing_relation:
                conflicts.append(
                    f"Relationship mismatch: {new_source} -{new_relation}-> {new_target} "
                    f"vs existing -{existing_relation}->"
                )
        
        if source_match and existing_relation == new_relation_upper:
            if not target_match:
                if new_relation_upper in {"LIVES_IN", "BASED_IN", "HEADQUARTERED_IN"}:
                    conflicts.append(
                        f"Location conflict: {new_source} is said to be in '{new_target}' "
                        f"but already in '{existing_target}'"
                    )
    
    return len(conflicts) > 0, conflicts

def check_entity_property_conflict(
    entity_name: str,
    new_properties: Dict[str, Any],
    existing_properties: Dict[str, Any]
) -> Tuple[bool, List[str]]:
    conflicts = []
    
    for key, new_value in new_properties.items():
        if key not in existing_properties:
            continue
        
        existing_value = existing_properties[key]
        
        if isinstance(new_value, str) and isinstance(existing_value, str):
            new_norm = normalize_text(new_value)
            existing_norm = normalize_text(existing_value)
            
            if new_norm != existing_norm:
                similarity = SequenceMatcher(None, new_norm, existing_norm).ratio()
                if similarity < 0.7:
                    conflicts.append(
                        f"Property '{key}' conflict: new value '{new_value}' "
                        f"vs existing '{existing_value}'"
                    )
        elif new_value != existing_value:
            conflicts.append(
                f"Property '{key}' conflict: new value {new_value} "
                f"vs existing {existing_value}"
            )
    
    return len(conflicts) > 0, conflicts

def analyze_world_setting_consistency(
    new_setting: Dict[str, str],
    existing_settings: List[Dict[str, Any]]
) -> Dict[str, Any]:
    all_descriptions = [s.get("description", "") for s in existing_settings]
    all_descriptions_str = " ".join(all_descriptions)
    
    has_conflict, conflicts = check_statement_conflict(
        new_setting.get("description", ""),
        all_descriptions
    )
    
    return {
        "has_conflict": has_conflict,
        "conflicts": conflicts,
        "severity": "high" if len(conflicts) > 2 else "medium" if conflicts else "low",
        "suggestion": "Review the conflicts before adding" if conflicts else "No conflicts detected"
    }
