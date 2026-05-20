from typing import Dict, List
import json

def export_to_json(graph_data: Dict[str, List[Dict]], 
                   world_settings: List[Dict] = None,
                   events: List[Dict] = None) -> str:
    export_data = {
        "version": "1.0",
        "graph": graph_data,
        "world_settings": world_settings or [],
        "events": events or []
    }
    return json.dumps(export_data, indent=2, ensure_ascii=False)

def export_to_markdown(graph_data: Dict[str, List[Dict]],
                       world_settings: List[Dict] = None,
                       events: List[Dict] = None) -> str:
    lines = []
    
    lines.append("# Knowledge Graph Export")
    lines.append("")
    lines.append(f"*Exported with {len(graph_data.get('nodes', []))} entities and {len(graph_data.get('links', []))} relationships*")
    lines.append("")
    
    if world_settings:
        lines.append("## World Settings")
        lines.append("")
        for setting in world_settings:
            lines.append(f"### {setting.get('name', 'Unnamed Setting')}")
            lines.append("")
            lines.append(setting.get('description', ''))
            lines.append("")
    
    lines.append("## Entities")
    lines.append("")
    
    entities_by_type = {}
    for node in graph_data.get('nodes', []):
        ent_type = node.get('group', 'UNKNOWN')
        if ent_type not in entities_by_type:
            entities_by_type[ent_type] = []
        entities_by_type[ent_type].append(node)
    
    for ent_type, entities in entities_by_type.items():
        lines.append(f"### {ent_type}")
        lines.append("")
        for entity in entities:
            lines.append(f"- **{entity.get('name', 'Unnamed')}**")
            props = entity.get('properties', {})
            if props:
                for key, value in props.items():
                    if key != 'name':
                        lines.append(f"  - {key}: {value}")
        lines.append("")
    
    lines.append("## Relationships")
    lines.append("")
    
    entity_names = {node.get('id'): node.get('name', 'Unknown') 
                    for node in graph_data.get('nodes', [])}
    
    for link in graph_data.get('links', []):
        source_name = entity_names.get(link.get('source'), 'Unknown')
        target_name = entity_names.get(link.get('target'), 'Unknown')
        relation = link.get('relation', 'related_to').replace('_', ' ')
        lines.append(f"- {source_name} **{relation}** {target_name}")
    
    lines.append("")
    
    if events:
        lines.append("## Events")
        lines.append("")
        for event in events:
            lines.append(f"### {event.get('name', 'Unnamed Event')}")
            lines.append("")
            lines.append(event.get('description', ''))
            lines.append("")
            if event.get('entities_involved'):
                lines.append(f"**Entities involved:** {', '.join(event['entities_involved'])}")
            if event.get('impact'):
                lines.append(f"**Impact:** {event['impact']}")
            lines.append("")
    
    return "\n".join(lines)

def export_entities_to_markdown(entities: Dict[str, List[str]]) -> str:
    lines = []
    lines.append("# Extracted Entities")
    lines.append("")
    
    for ent_type, ents in entities.items():
        if ents:
            lines.append(f"## {ent_type}")
            lines.append("")
            for ent in ents:
                lines.append(f"- {ent}")
            lines.append("")
    
    return "\n".join(lines)
