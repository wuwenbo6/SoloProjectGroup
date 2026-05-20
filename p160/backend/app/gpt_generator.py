import openai
from typing import List, Dict, Tuple, Optional
import os
from dotenv import load_dotenv
import json

load_dotenv()

client = None

def get_openai_client():
    global client
    if client is None:
        api_key = os.getenv("OPENAI_API_KEY")
        if api_key:
            client = openai.OpenAI(api_key=api_key)
    return client

def generate_relationships(entities: Dict[str, List[str]], context: str = "", 
                            existing_knowledge: str = "") -> List[Dict]:
    client = get_openai_client()
    if not client:
        return []
    
    all_entities = []
    for ent_type, ents in entities.items():
        for ent in ents:
            all_entities.append({"name": ent, "type": ent_type})
    
    if len(all_entities) < 2:
        return []
    
    existing_knowledge_prompt = ""
    if existing_knowledge:
        existing_knowledge_prompt = f"""
    IMPORTANT - Existing Knowledge (avoid contradictions):
    {existing_knowledge}
    
    Ensure all generated relationships are CONSISTENT with the existing knowledge above.
    Do NOT create relationships that directly contradict established facts.
    """
    
    prompt = f"""
    Based on the following entities extracted from text, generate plausible relationships between them.
    Consider the context if provided.
    {existing_knowledge_prompt}

    Entities:
    {json.dumps(all_entities, indent=2)}

    Context: {context if context else "No additional context"}

    Generate 5-10 meaningful relationships. Return ONLY a JSON array with this format:
    [
        {{
            "source": "entity_name",
            "source_type": "PERSON/GPE/ORG",
            "relation": "relationship_verb",
            "target": "entity_name",
            "target_type": "PERSON/GPE/ORG",
            "description": "brief description"
        }}
    ]
    """
    
    try:
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a knowledge graph expert. Generate meaningful, CONSISTENT relationships between entities. Avoid contradictions with established facts."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=500
        )
        
        content = response.choices[0].message.content
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        
        relationships = json.loads(content.strip())
        return relationships
    except Exception as e:
        print(f"Error generating relationships: {e}")
        return []

def generate_events(entities: Dict[str, List[str]], world_setting: str = "", 
                   num_events: int = 3) -> List[Dict]:
    client = get_openai_client()
    if not client:
        return []
    
    prompt = f"""
    Generate {num_events} interesting events based on the following entities and world setting.

    Entities:
    {json.dumps(entities, indent=2)}

    World Setting: {world_setting if world_setting else "Generic modern world"}

    For each event, include:
    - Event name/title
    - Event description
    - Key entities involved
    - Impact on relationships

    Return ONLY a JSON array with this format:
    [
        {{
            "name": "Event name",
            "description": "Detailed description",
            "entities_involved": ["entity1", "entity2"],
            "impact": "How this affects relationships"
        }}
    ]
    """
    
    try:
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a creative world-building expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=800
        )
        
        content = response.choices[0].message.content
        content = content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        
        events = json.loads(content.strip())
        return events
    except Exception as e:
        print(f"Error generating events: {e}")
        return []

def expand_world_setting(current_setting: str, focus_area: str = "") -> str:
    client = get_openai_client()
    if not client:
        return current_setting
    
    prompt = f"""
    Expand and enrich the following world setting. Focus on {focus_area if focus_area else "all aspects"}.

    Current setting:
    {current_setting}

    Provide a detailed, expanded version that includes:
    - Political structure
    - Cultural elements
    - Key locations and their significance
    - Power dynamics
    - Historical context

    Return as formatted text.
    """
    
    try:
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a creative world-building and storytelling expert."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=1000
        )
        
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error expanding world setting: {e}")
        return current_setting

def autocomplete_relation(source: str, target: str, context: str = "") -> str:
    client = get_openai_client()
    if not client:
        return "related_to"
    
    prompt = f"""
    Suggest a meaningful relationship verb between "{source}" and "{target}".
    
    Context: {context if context else "No additional context"}
    
    Return ONLY a single verb or short phrase that describes the relationship (e.g., "works_for", "lives_in", "founded").
    """
    
    try:
        model = os.getenv("OPENAI_MODEL", "gpt-3.5-turbo")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": "You are a relationship expert for knowledge graphs."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.5,
            max_tokens=50
        )
        
        relation = response.choices[0].message.content.strip().lower().replace(" ", "_")
        return relation if relation else "related_to"
    except Exception as e:
        print(f"Error autocompleting relation: {e}")
        return "related_to"
