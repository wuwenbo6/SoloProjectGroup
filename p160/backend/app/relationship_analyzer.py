from typing import Dict, List, Optional, Tuple
from collections import defaultdict

RELATIONSHIP_WEIGHTS = {
    "FAMILY": {
        "parent_of": 0.95,
        "child_of": 0.95,
        "sibling_of": 0.90,
        "spouse_of": 0.95,
        "married_to": 0.95,
        "related_to": 0.60,
        "aunt_uncle_of": 0.70,
        "cousin_of": 0.50,
    },
    "PROFESSIONAL": {
        "works_at": 0.75,
        "employer_of": 0.75,
        "colleague_of": 0.65,
        "founded": 0.85,
        "ceo_of": 0.80,
        "leads": 0.80,
        "manages": 0.75,
        "works_for": 0.75,
        "employee_of": 0.70,
    },
    "FRIENDSHIP": {
        "friend_of": 0.80,
        "close_friend_of": 0.90,
        "ally_of": 0.70,
        "partner_of": 0.75,
    },
    "RIVALRY": {
        "rival_of": 0.70,
        "enemy_of": 0.80,
        "competitor_of": 0.65,
        "opponent_of": 0.65,
    },
    "GEOGRAPHIC": {
        "lives_in": 0.70,
        "born_in": 0.80,
        "located_in": 0.60,
        "headquartered_in": 0.75,
    },
    "OWNERSHIP": {
        "owns": 0.85,
        "owner_of": 0.85,
        "acquired": 0.80,
        "invested_in": 0.60,
    },
    "ASSOCIATION": {
        "member_of": 0.50,
        "associated_with": 0.40,
        "mentioned_with": 0.30,
        "appears_with": 0.35,
    }
}

RELATION_TYPE_CATEGORIES = {}
for category, relations in RELATIONSHIP_WEIGHTS.items():
    for rel, weight in relations.items():
        RELATION_TYPE_CATEGORIES[rel] = category

def calculate_closeness(source_id: str, target_id: str, graph_data: Dict) -> Dict:
    all_relations = []
    for link in graph_data.get("links", []):
        all_relations.append(link)
    
    direct_relation = find_direct_relation(source_id, target_id, all_relations)
    indirect_paths = find_indirect_paths(source_id, target_id, all_relations, max_depth=3)
    
    node_map = {node["id"]: node for node in graph_data.get("nodes", [])}
    
    direct_score = calculate_direct_score(direct_relation) if direct_relation else 0
    
    indirect_score = calculate_indirect_score(indirect_paths, all_relations, node_map) if indirect_paths else 0
    
    shared_connections = calculate_shared_connections(source_id, target_id, all_relations)
    
    shared_locations = calculate_shared_locations(source_id, target_id, all_relations, node_map)
    
    final_score = calculate_final_score(direct_score, indirect_score, shared_connections, shared_locations)
    
    source_name = node_map.get(source_id, {}).get("name", source_id)
    target_name = node_map.get(target_id, {}).get("name", target_id)
    
    return {
        "source": source_id,
        "source_name": source_name,
        "target": target_id,
        "target_name": target_name,
        "closeness_score": round(final_score, 3),
        "closeness_level": get_closeness_level(final_score),
        "direct_relation": direct_relation,
        "indirect_paths": indirect_paths,
        "shared_connections_count": len(shared_connections),
        "shared_connections": shared_connections,
        "shared_locations": shared_locations,
        "breakdown": {
            "direct_score": round(direct_score, 3),
            "indirect_score": round(indirect_score, 3),
            "shared_connections_bonus": round(len(shared_connections) * 0.05, 3),
            "shared_locations_bonus": round(len(shared_locations) * 0.03, 3)
        }
    }

def find_direct_relation(source_id: str, target_id: str, relations: List[Dict]) -> Optional[Dict]:
    for rel in relations:
        if rel.get("source") == source_id and rel.get("target") == target_id:
            return {**rel, "direction": "forward"}
        if rel.get("target") == source_id and rel.get("source") == target_id:
            return {**rel, "direction": "reverse"}
    return None

def find_indirect_paths(source_id: str, target_id: str, relations: List[Dict], 
                        max_depth: int = 3) -> List[List[Dict]]:
    paths = []
    
    def dfs(current: str, target: str, path: List[Dict], visited: set, depth: int):
        if depth > max_depth:
            return
        if current == target and path:
            paths.append(path.copy())
            return
        
        for rel in relations:
            next_node = None
            if rel.get("source") == current and rel.get("target") not in visited:
                next_node = rel.get("target")
            elif rel.get("target") == current and rel.get("source") not in visited:
                next_node = rel.get("source")
            
            if next_node and next_node not in visited:
                visited.add(next_node)
                path.append(rel)
                dfs(next_node, target, path, visited, depth + 1)
                path.pop()
                visited.remove(next_node)
    
    dfs(source_id, target_id, [], {source_id}, 0)
    
    paths.sort(key=len)
    return paths[:5]

def get_relation_weight(relation_type: str) -> float:
    rel_lower = relation_type.lower().replace(" ", "_")
    for rel, weight in RELATION_TYPE_CATEGORIES.items():
        if rel in rel_lower or rel_lower in rel:
            for category, rels in RELATIONSHIP_WEIGHTS.items():
                if rel in rels:
                    return rels[rel]
    return 0.30

def calculate_direct_score(direct_relation: Dict) -> float:
    relation_type = direct_relation.get("relation", "").lower()
    weight = get_relation_weight(relation_type)
    
    properties = direct_relation.get("properties", {})
    multiplier = 1.0
    
    if properties.get("since"):
        multiplier += 0.1
    if properties.get("description"):
        multiplier += 0.05
    
    return min(weight * multiplier, 1.0)

def calculate_indirect_score(paths: List[List[Dict]], relations: List[Dict], node_map: Dict) -> float:
    if not paths:
        return 0
    
    shortest_path = paths[0]
    path_length = len(shortest_path)
    
    total_weight = 0
    for rel in shortest_path:
        rel_type = rel.get("relation", "").lower()
        total_weight += get_relation_weight(rel_type)
    
    avg_weight = total_weight / path_length if path_length > 0 else 0
    
    decay_factor = 1 / (path_length * 0.75)
    
    return min(avg_weight * decay_factor, 0.8)

def calculate_shared_connections(source_id: str, target_id: str, relations: List[Dict]) -> List[str]:
    source_connections = set()
    target_connections = set()
    
    for rel in relations:
        if rel.get("source") == source_id:
            source_connections.add(rel.get("target"))
        if rel.get("target") == source_id:
            source_connections.add(rel.get("source"))
        if rel.get("source") == target_id:
            target_connections.add(rel.get("target"))
        if rel.get("target") == target_id:
            target_connections.add(rel.get("source"))
    
    return list(source_connections & target_connections)

def calculate_shared_locations(source_id: str, target_id: str, relations: List[Dict], node_map: Dict) -> List[str]:
    source_locations = set()
    target_locations = set()
    
    for rel in relations:
        rel_type = rel.get("relation", "").lower()
        if "in" in rel_type or "located" in rel_type or "born" in rel_type:
            if rel.get("source") == source_id:
                target_node = node_map.get(rel.get("target"), {})
                if target_node.get("type") in ["GPE", "LOC"]:
                    source_locations.add(rel.get("target"))
            if rel.get("source") == target_id:
                target_node = node_map.get(rel.get("target"), {})
                if target_node.get("type") in ["GPE", "LOC"]:
                    target_locations.add(rel.get("target"))
    
    return list(source_locations & target_locations)

def calculate_final_score(direct_score: float, indirect_score: float, 
                          shared_connections: List[str], shared_locations: List[str]) -> float:
    score = 0
    
    if direct_score > 0:
        score += direct_score * 0.6
    else:
        score += indirect_score * 0.5
    
    score += len(shared_connections) * 0.05
    score += len(shared_locations) * 0.03
    
    return min(score, 1.0)

def get_closeness_level(score: float) -> str:
    if score >= 0.8:
        return "Very Close"
    elif score >= 0.6:
        return "Close"
    elif score >= 0.4:
        return "Moderate"
    elif score >= 0.2:
        return "Distant"
    else:
        return "None"

def analyze_all_relationships(graph_data: Dict) -> Dict:
    person_nodes = [node for node in graph_data.get("nodes", []) 
                    if node.get("type") == "PERSON"]
    
    results = []
    
    for i, person1 in enumerate(person_nodes):
        for person2 in person_nodes[i+1:]:
            analysis = calculate_closeness(person1["id"], person2["id"], graph_data)
            results.append(analysis)
    
    results.sort(key=lambda x: x["closeness_score"], reverse=True)
    
    return {
        "total_pairs": len(results),
        "relationships": results,
        "summary": generate_summary(results)
    }

def generate_summary(results: List[Dict]) -> Dict:
    categories = defaultdict(int)
    for r in results:
        categories[r["closeness_level"]] += 1
    
    return {
        "very_close": categories.get("Very Close", 0),
        "close": categories.get("Close", 0),
        "moderate": categories.get("Moderate", 0),
        "distant": categories.get("Distant", 0),
        "none": categories.get("None", 0)
    }
