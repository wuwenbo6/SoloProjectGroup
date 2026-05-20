from typing import Dict, List, Optional, Tuple
import json
import os

PLACE_COORDINATES = {
    "new york": {"lat": 40.7128, "lng": -74.0060, "country": "United States"},
    "new york city": {"lat": 40.7128, "lng": -74.0060, "country": "United States"},
    "los angeles": {"lat": 34.0522, "lng": -118.2437, "country": "United States"},
    "chicago": {"lat": 41.8781, "lng": -87.6298, "country": "United States"},
    "san francisco": {"lat": 37.7749, "lng": -122.4194, "country": "United States"},
    "seattle": {"lat": 47.6062, "lng": -122.3321, "country": "United States"},
    "boston": {"lat": 42.3601, "lng": -71.0589, "country": "United States"},
    "washington": {"lat": 38.9072, "lng": -77.0369, "country": "United States"},
    "washington dc": {"lat": 38.9072, "lng": -77.0369, "country": "United States"},
    "palo alto": {"lat": 37.4419, "lng": -122.1430, "country": "United States"},
    "silicon valley": {"lat": 37.3875, "lng": -122.0575, "country": "United States"},
    "austin": {"lat": 30.2672, "lng": -97.7431, "country": "United States"},
    "miami": {"lat": 25.7617, "lng": -80.1918, "country": "United States"},
    
    "london": {"lat": 51.5074, "lng": -0.1278, "country": "United Kingdom"},
    "paris": {"lat": 48.8566, "lng": 2.3522, "country": "France"},
    "berlin": {"lat": 52.5200, "lng": 13.4050, "country": "Germany"},
    "tokyo": {"lat": 35.6762, "lng": 139.6503, "country": "Japan"},
    "shanghai": {"lat": 31.2304, "lng": 121.4737, "country": "China"},
    "beijing": {"lat": 39.9042, "lng": 116.4074, "country": "China"},
    "hong kong": {"lat": 22.3193, "lng": 114.1694, "country": "China"},
    "singapore": {"lat": 1.3521, "lng": 103.8198, "country": "Singapore"},
    "sydney": {"lat": -33.8688, "lng": 151.2093, "country": "Australia"},
    "melbourne": {"lat": -37.8136, "lng": 144.9631, "country": "Australia"},
    "toronto": {"lat": 43.6532, "lng": -79.3832, "country": "Canada"},
    "vancouver": {"lat": 49.2827, "lng": -123.1207, "country": "Canada"},
    "moscow": {"lat": 55.7558, "lng": 37.6173, "country": "Russia"},
    "dubai": {"lat": 25.2048, "lng": 55.2708, "country": "UAE"},
    
    "united states": {"lat": 37.0902, "lng": -95.7129, "country": "United States"},
    "usa": {"lat": 37.0902, "lng": -95.7129, "country": "United States"},
    "america": {"lat": 37.0902, "lng": -95.7129, "country": "United States"},
    "china": {"lat": 35.8617, "lng": 104.1954, "country": "China"},
    "japan": {"lat": 36.2048, "lng": 138.2529, "country": "Japan"},
    "germany": {"lat": 51.1657, "lng": 10.4515, "country": "Germany"},
    "france": {"lat": 46.2276, "lng": 2.2137, "country": "France"},
    "united kingdom": {"lat": 55.3781, "lng": -3.4360, "country": "United Kingdom"},
    "uk": {"lat": 55.3781, "lng": -3.4360, "country": "United Kingdom"},
    "canada": {"lat": 56.1304, "lng": -106.3468, "country": "Canada"},
    "australia": {"lat": -25.2744, "lng": 133.7751, "country": "Australia"},
    "russia": {"lat": 61.5240, "lng": 105.3188, "country": "Russia"},
    "india": {"lat": 20.5937, "lng": 78.9629, "country": "India"},
    "brazil": {"lat": -14.2350, "lng": -51.9253, "country": "Brazil"},
    
    "california": {"lat": 36.7783, "lng": -119.4179, "country": "United States"},
    "texas": {"lat": 31.9686, "lng": -99.9018, "country": "United States"},
    "florida": {"lat": 27.6648, "lng": -81.5158, "country": "United States"},
    "new york state": {"lat": 43.2994, "lng": -74.2179, "country": "United States"},
    "illinois": {"lat": 40.6331, "lng": -89.3985, "country": "United States"},
    "massachusetts": {"lat": 42.4072, "lng": -71.3824, "country": "United States"},
    "washington state": {"lat": 47.7511, "lng": -120.7401, "country": "United States"},
}

def get_coordinates(place_name: str) -> Optional[Dict]:
    place_lower = place_name.lower().strip()
    
    if place_lower in PLACE_COORDINATES:
        return PLACE_COORDINATES[place_lower]
    
    for known_place, coords in PLACE_COORDINATES.items():
        if known_place in place_lower or place_lower in known_place:
            return coords
    
    return None

def map_places_to_coordinates(places: List[str]) -> Dict[str, Dict]:
    results = {}
    for place in places:
        coords = get_coordinates(place)
        if coords:
            results[place] = coords
    
    return results

def extract_locations_from_graph(graph_data: Dict) -> List[Dict]:
    locations = []
    seen_places = set()
    
    for node in graph_data.get("nodes", []):
        if node.get("type") == "GPE" or node.get("type") == "LOC":
            place_name = node["name"]
            if place_name not in seen_places:
                coords = get_coordinates(place_name)
                if coords:
                    locations.append({
                        "id": node["id"],
                        "name": place_name,
                        "type": node.get("type", "GPE"),
                        "lat": coords["lat"],
                        "lng": coords["lng"],
                        "country": coords.get("country", ""),
                        "properties": node.get("properties", {})
                    })
                    seen_places.add(place_name)
    
    return locations

def get_related_entities_for_location(graph_data: Dict, location_id: str) -> List[Dict]:
    related = []
    
    for link in graph_data.get("links", []):
        if link.get("target") == location_id or link.get("source") == location_id:
            other_id = link["source"] if link["target"] == location_id else link["target"]
            
            for node in graph_data.get("nodes", []):
                if node["id"] == other_id:
                    related.append({
                        "entity": node,
                        "relation": link.get("relation", ""),
                        "direction": "in" if link["target"] == location_id else "out"
                    })
                    break
    
    return related

def generate_geo_map_data(graph_data: Dict) -> Dict:
    locations = extract_locations_from_graph(graph_data)
    
    for loc in locations:
        loc["related_entities"] = get_related_entities_for_location(graph_data, loc["id"])
    
    return {
        "locations": locations,
        "total_locations": len(locations),
        "center": calculate_map_center(locations) if locations else {"lat": 0, "lng": 0}
    }

def calculate_map_center(locations: List[Dict]) -> Dict:
    if not locations:
        return {"lat": 0, "lng": 0}
    
    total_lat = sum(loc["lat"] for loc in locations)
    total_lng = sum(loc["lng"] for loc in locations)
    
    return {
        "lat": total_lat / len(locations),
        "lng": total_lng / len(locations)
    }
