from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import json

from .entity_extractor import extract_entities, extract_relationships
from .neo4j_db import db
from .gpt_generator import generate_relationships, generate_events, expand_world_setting, autocomplete_relation
from .exporter import export_to_json, export_to_markdown, export_entities_to_markdown
from . import entity_resolver
from . import conflict_detector
from .timeline_generator import extract_events_from_text, generate_timeline_from_graph, detect_event_order
from .geo_mapper import generate_geo_map_data, get_coordinates, map_places_to_coordinates
from .relationship_analyzer import calculate_closeness, analyze_all_relationships

app = FastAPI(title="Knowledge Graph API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TextInput(BaseModel):
    text: str

class EntityInput(BaseModel):
    name: str
    type: str
    properties: Optional[Dict] = None

class RelationshipInput(BaseModel):
    source: str
    source_type: str
    relation: str
    target: str
    target_type: str
    properties: Optional[Dict] = None

class WorldSettingInput(BaseModel):
    name: str
    description: str
    properties: Optional[Dict] = None

class GenerateRelationsInput(BaseModel):
    entities: Dict[str, List[str]]
    context: Optional[str] = ""

class GenerateEventsInput(BaseModel):
    entities: Dict[str, List[str]]
    world_setting: Optional[str] = ""
    num_events: Optional[int] = 3

class ExpandWorldSettingInput(BaseModel):
    current_setting: str
    focus_area: Optional[str] = ""

class AutocompleteRelationInput(BaseModel):
    source: str
    target: str
    context: Optional[str] = ""

class DeleteIdInput(BaseModel):
    id: str

class EntityWithResolutionInput(BaseModel):
    name: str
    type: str
    properties: Optional[Dict] = None
    auto_merge: Optional[bool] = True

class MergeEntitiesInput(BaseModel):
    primary_id: str
    duplicate_id: str

class CheckConflictInput(BaseModel):
    source: str
    source_type: str
    relation: str
    target: str
    target_type: str

class CheckWorldSettingInput(BaseModel):
    description: str

class AddAliasInput(BaseModel):
    canonical: str
    alias: str

class CalculateClosenessInput(BaseModel):
    source_id: str
    target_id: str

class MapPlacesInput(BaseModel):
    places: List[str]

@app.get("/")
async def root():
    return {"message": "Knowledge Graph API is running"}

@app.get("/health")
async def health_check():
    return {
        "neo4j_connected": db.is_connected()
    }

@app.post("/extract/entities")
async def api_extract_entities(input: TextInput):
    entities = extract_entities(input.text)
    return {"entities": entities}

@app.post("/extract/relationships")
async def api_extract_relationships(input: TextInput):
    relationships = extract_relationships(input.text)
    return {"relationships": relationships}

@app.post("/extract/all")
async def api_extract_all(input: TextInput):
    entities = extract_entities(input.text)
    relationships = extract_relationships(input.text)
    return {
        "entities": entities,
        "relationships": relationships
    }

@app.post("/entities")
async def add_entity(input: EntityInput):
    result = db.add_entity(input.name, input.type, input.properties)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to add entity")
    return result

@app.delete("/entities")
async def remove_entity(input: DeleteIdInput):
    success = db.delete_entity(input.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete entity")
    return {"success": True}

@app.post("/relationships")
async def add_relationship(input: RelationshipInput):
    result = db.add_relationship(
        input.source, input.source_type,
        input.relation,
        input.target, input.target_type,
        input.properties
    )
    if not result:
        raise HTTPException(status_code=500, detail="Failed to add relationship")
    return result

@app.delete("/relationships")
async def remove_relationship(input: DeleteIdInput):
    success = db.delete_relationship(input.id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete relationship")
    return {"success": True}

@app.get("/graph")
async def get_graph():
    return db.get_all_graph_data()

@app.post("/world-settings")
async def add_world_setting(input: WorldSettingInput):
    result = db.add_world_setting(input.name, input.description, input.properties)
    if not result:
        raise HTTPException(status_code=500, detail="Failed to add world setting")
    return result

@app.get("/world-settings")
async def get_world_settings():
    return {"settings": db.get_world_settings()}

@app.post("/generate/relationships")
async def api_generate_relationships(input: GenerateRelationsInput):
    graph_data = db.get_all_graph_data()
    existing_knowledge = []
    entity_names = {node["id"]: node["name"] for node in graph_data["nodes"]}
    
    for link in graph_data["links"]:
        source_name = entity_names.get(link["source"], "")
        target_name = entity_names.get(link["target"], "")
        if source_name and target_name:
            existing_knowledge.append(f"{source_name} -{link['relation']}-> {target_name}")
    
    existing_knowledge_str = "\n".join(existing_knowledge)
    
    relationships = generate_relationships(input.entities, input.context, existing_knowledge_str)
    return {"relationships": relationships}

@app.post("/generate/events")
async def api_generate_events(input: GenerateEventsInput):
    events = generate_events(input.entities, input.world_setting, input.num_events)
    return {"events": events}

@app.post("/generate/expand-world")
async def api_expand_world(input: ExpandWorldSettingInput):
    expanded = expand_world_setting(input.current_setting, input.focus_area)
    return {"expanded_setting": expanded}

@app.post("/generate/autocomplete-relation")
async def api_autocomplete_relation(input: AutocompleteRelationInput):
    relation = autocomplete_relation(input.source, input.target, input.context)
    return {"relation": relation}

@app.get("/export/json")
async def export_json():
    graph_data = db.get_all_graph_data()
    world_settings = db.get_world_settings()
    json_data = export_to_json(graph_data, world_settings)
    return {"data": json_data}

@app.get("/export/markdown")
async def export_markdown():
    graph_data = db.get_all_graph_data()
    world_settings = db.get_world_settings()
    markdown = export_to_markdown(graph_data, world_settings)
    return {"markdown": markdown}

@app.post("/export/entities/markdown")
async def export_entities_md(input: TextInput):
    entities = extract_entities(input.text)
    markdown = export_entities_to_markdown(entities)
    return {"markdown": markdown}

@app.delete("/database")
async def clear_database():
    success = db.clear_database()
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear database")
    return {"success": True}

@app.post("/import/json")
async def import_json(data: Dict):
    try:
        graph_data = data.get("graph", {})
        for node in graph_data.get("nodes", []):
            db.add_entity(node["name"], node["group"], node.get("properties", {}))
        
        entity_id_map = {}
        current_graph = db.get_all_graph_data()
        for node in current_graph["nodes"]:
            entity_id_map[node["name"]] = {"id": node["id"], "type": node["group"]}
        
        for link in graph_data.get("links", []):
            source_node = next((n for n in graph_data["nodes"] if n["id"] == link["source"]), None)
            target_node = next((n for n in graph_data["nodes"] if n["id"] == link["target"]), None)
            if source_node and target_node:
                db.add_relationship(
                    source_node["name"], source_node["group"],
                    link["relation"],
                    target_node["name"], target_node["group"],
                    link.get("properties", {})
                )
        
        for setting in data.get("world_settings", []):
            db.add_world_setting(setting["name"], setting["description"], setting.get("properties", {}))
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Import failed: {str(e)}")

@app.post("/entities/with-resolution")
async def add_entity_with_resolution(input: EntityWithResolutionInput):
    result = db.add_entity_with_resolution(
        input.name, input.type, input.properties, input.auto_merge
    )
    return result

@app.post("/entities/merge")
async def merge_entities(input: MergeEntitiesInput):
    result = db.merge_entities(input.primary_id, input.duplicate_id)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Merge failed"))
    return result

@app.get("/entities/{entity_id}/aliases")
async def get_entity_aliases(entity_id: str):
    aliases = db.get_entity_aliases(entity_id)
    return {"aliases": aliases}

@app.post("/entities/find-similar")
async def find_similar_entity(input: EntityInput):
    similar = db.find_similar_entity(input.name, input.type)
    return {"similar": similar}

@app.post("/check-conflict/relationship")
async def check_relationship_conflict(input: CheckConflictInput):
    result = db.check_relationship_conflicts(
        input.source, input.source_type,
        input.relation,
        input.target, input.target_type
    )
    return result

@app.post("/check-conflict/world-setting")
async def check_world_setting_conflict(input: CheckWorldSettingInput):
    result = db.check_world_setting_conflicts(input.description)
    return result

@app.post("/aliases/add")
async def add_custom_alias(input: AddAliasInput):
    entity_resolver.add_custom_alias(input.canonical, input.alias)
    return {"success": True}

@app.post("/resolve/entities")
async def resolve_entities_list(input: TextInput):
    entities = extract_entities(input.text)
    all_entities = []
    for ent_type, names in entities.items():
        for name in names:
            all_entities.append({"name": name, "type": ent_type})
    
    resolved = []
    for ent in all_entities:
        similar = db.find_similar_entity(ent["name"], ent["type"])
        resolved.append({
            "original": ent["name"],
            "type": ent["type"],
            "canonical": entity_resolver.get_canonical_name(ent["name"]),
            "similar_entity": similar
        })
    
    return {"resolved_entities": resolved}

@app.post("/timeline/extract")
async def extract_timeline(input: TextInput):
    events = extract_events_from_text(input.text)
    ordered_events = detect_event_order(events)
    return {"events": ordered_events}

@app.get("/timeline")
async def get_timeline():
    graph_data = db.get_all_graph_data()
    events = generate_timeline_from_graph(graph_data)
    ordered_events = detect_event_order(events)
    return {"events": ordered_events}

@app.get("/geo/map")
async def get_geo_map():
    graph_data = db.get_all_graph_data()
    map_data = generate_geo_map_data(graph_data)
    return map_data

@app.post("/geo/coordinates")
async def get_place_coordinates(input: MapPlacesInput):
    coordinates = map_places_to_coordinates(input.places)
    return {"coordinates": coordinates}

@app.post("/closeness")
async def calculate_pair_closeness(input: CalculateClosenessInput):
    graph_data = db.get_all_graph_data()
    result = calculate_closeness(input.source_id, input.target_id, graph_data)
    return result

@app.get("/closeness/all")
async def get_all_closeness():
    graph_data = db.get_all_graph_data()
    result = analyze_all_relationships(graph_data)
    return result

@app.on_event("shutdown")
async def shutdown_event():
    db.close()
