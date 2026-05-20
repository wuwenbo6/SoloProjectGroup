from neo4j import GraphDatabase
from typing import List, Dict, Any, Optional, Tuple
import os
from dotenv import load_dotenv
from . import entity_resolver
from . import conflict_detector

load_dotenv()

class Neo4jDatabase:
    def __init__(self):
        self.uri = os.getenv("NEO4J_URI", "bolt://localhost:7687")
        self.user = os.getenv("NEO4J_USER", "neo4j")
        self.password = os.getenv("NEO4J_PASSWORD", "password")
        self.driver = None
        self._connect()
    
    def _connect(self):
        try:
            self.driver = GraphDatabase.driver(self.uri, auth=(self.user, self.password))
            self.driver.verify_connectivity()
        except Exception as e:
            print(f"Failed to connect to Neo4j: {e}")
            self.driver = None
    
    def close(self):
        if self.driver:
            self.driver.close()
    
    def is_connected(self) -> bool:
        return self.driver is not None
    
    def add_entity(self, name: str, entity_type: str, properties: Optional[Dict] = None):
        if not self.driver:
            return None
        
        if properties is None:
            properties = {}
        
        entity_type = entity_type.upper().replace(" ", "_")
        
        with self.driver.session() as session:
            result = session.execute_write(
                self._create_entity, name, entity_type, properties
            )
            return result
    
    @staticmethod
    def _create_entity(tx, name: str, entity_type: str, properties: Dict):
        props_str = ", ".join([f"{k}: ${k}" for k in properties.keys()])
        if props_str:
            props_str = ", " + props_str
        
        query = f"""
        MERGE (e:{entity_type} {{name: $name}})
        SET e += {{{props_str.replace('$', '')}}}
        RETURN e, elementId(e) as id
        """
        result = tx.run(query, name=name, **properties)
        record = result.single()
        if record:
            return {"id": record["id"], "name": name, "type": entity_type}
        return None
    
    def add_relationship(self, source: str, source_type: str, relation: str, 
                         target: str, target_type: str, properties: Optional[Dict] = None):
        if not self.driver:
            return None
        
        if properties is None:
            properties = {}
        
        source_type = source_type.upper().replace(" ", "_")
        target_type = target_type.upper().replace(" ", "_")
        relation = relation.upper().replace(" ", "_")
        
        with self.driver.session() as session:
            result = session.execute_write(
                self._create_relationship, source, source_type, 
                relation, target, target_type, properties
            )
            return result
    
    @staticmethod
    def _create_relationship(tx, source: str, source_type: str, relation: str,
                             target: str, target_type: str, properties: Dict):
        props_str = ", ".join([f"{k}: ${k}" for k in properties.keys()])
        set_clause = f"SET r += {{{props_str.replace('$', '')}}}" if props_str else ""
        
        query = f"""
        MERGE (s:{source_type} {{name: $source}})
        MERGE (t:{target_type} {{name: $target}})
        MERGE (s)-[r:{relation}]->(t)
        {set_clause}
        RETURN s, r, t, elementId(r) as rel_id
        """
        result = tx.run(query, source=source, target=target, **properties)
        record = result.single()
        if record:
            return {
                "source": source,
                "relation": relation,
                "target": target,
                "id": record["rel_id"]
            }
        return None
    
    def add_world_setting(self, setting_name: str, description: str, 
                          properties: Optional[Dict] = None):
        if not self.driver:
            return None
        
        if properties is None:
            properties = {}
        
        with self.driver.session() as session:
            result = session.execute_write(
                self._create_world_setting, setting_name, description, properties
            )
            return result
    
    @staticmethod
    def _create_world_setting(tx, setting_name: str, description: str, properties: Dict):
        props_str = ", ".join([f"{k}: ${k}" for k in properties.keys()])
        if props_str:
            props_str = ", " + props_str
        
        query = f"""
        MERGE (w:WORLD_SETTING {{name: $setting_name}})
        SET w.description = $description, w += {{{props_str.replace('$', '')}}}
        RETURN w, elementId(w) as id
        """
        result = tx.run(query, setting_name=setting_name, description=description, **properties)
        record = result.single()
        if record:
            return {"id": record["id"], "name": setting_name, "description": description}
        return None
    
    def get_all_graph_data(self) -> Dict[str, List[Dict]]:
        if not self.driver:
            return {"nodes": [], "links": []}
        
        with self.driver.session() as session:
            result = session.execute_read(self._get_all_graph_data)
            return result
    
    @staticmethod
    def _get_all_graph_data(tx):
        nodes_query = """
        MATCH (n)
        RETURN elementId(n) as id, n.name as name, labels(n) as labels, properties(n) as props
        """
        nodes_result = tx.run(nodes_query)
        nodes = []
        for record in nodes_result:
            label = record["labels"][0] if record["labels"] else "UNKNOWN"
            nodes.append({
                "id": record["id"],
                "name": record["name"],
                "group": label,
                "properties": record["props"]
            })
        
        links_query = """
        MATCH (s)-[r]->(t)
        RETURN elementId(r) as id, elementId(s) as source, elementId(t) as target, 
               type(r) as relation, properties(r) as props
        """
        links_result = tx.run(links_query)
        links = []
        for record in links_result:
            links.append({
                "id": record["id"],
                "source": record["source"],
                "target": record["target"],
                "relation": record["relation"],
                "properties": record["props"]
            })
        
        return {"nodes": nodes, "links": links}
    
    def get_world_settings(self) -> List[Dict]:
        if not self.driver:
            return []
        
        with self.driver.session() as session:
            result = session.execute_read(self._get_world_settings)
            return result
    
    @staticmethod
    def _get_world_settings(tx):
        query = """
        MATCH (w:WORLD_SETTING)
        RETURN elementId(w) as id, w.name as name, w.description as description, properties(w) as props
        ORDER BY w.name
        """
        result = tx.run(query)
        settings = []
        for record in result:
            settings.append({
                "id": record["id"],
                "name": record["name"],
                "description": record["description"],
                "properties": record["props"]
            })
        return settings
    
    def clear_database(self):
        if not self.driver:
            return False
        
        with self.driver.session() as session:
            session.execute_write(self._clear_database)
            return True
    
    @staticmethod
    def _clear_database(tx):
        tx.run("MATCH (n) DETACH DELETE n")
    
    def delete_entity(self, entity_id: str):
        if not self.driver:
            return False
        
        with self.driver.session() as session:
            session.execute_write(self._delete_entity, entity_id)
            return True
    
    @staticmethod
    def _delete_entity(tx, entity_id: str):
        tx.run("MATCH (n) WHERE elementId(n) = $id DETACH DELETE n", id=entity_id)
    
    def delete_relationship(self, rel_id: str):
        if not self.driver:
            return False
        
        with self.driver.session() as session:
            session.execute_write(self._delete_relationship, rel_id)
            return True
    
    @staticmethod
    def _delete_relationship(tx, rel_id: str):
        tx.run("MATCH ()-[r]->() WHERE elementId(r) = $id DELETE r", id=rel_id)
    
    def find_similar_entity(self, name: str, entity_type: str = None) -> Optional[Dict]:
        if not self.driver:
            return None
        
        with self.driver.session() as session:
            result = session.execute_read(
                self._find_similar_entity, name, entity_type
            )
            return result
    
    @staticmethod
    def _find_similar_entity(tx, name: str, entity_type: str = None):
        type_filter = ""
        params = {"name": name}
        
        if entity_type:
            type_filter = f":{entity_type.upper()}"
        
        query = f"""
        MATCH (n{type_filter})
        RETURN elementId(n) as id, n.name as name, labels(n) as labels, properties(n) as props
        """
        result = tx.run(query, **params)
        
        for record in result:
            existing_name = record["name"]
            is_match, similarity = entity_resolver.is_alias(name, existing_name)
            if is_match:
                return {
                    "id": record["id"],
                    "name": existing_name,
                    "group": record["labels"][0] if record["labels"] else "UNKNOWN",
                    "properties": record["props"],
                    "similarity": similarity
                }
        
        return None
    
    def add_entity_with_resolution(self, name: str, entity_type: str, 
                                    properties: Optional[Dict] = None,
                                    auto_merge: bool = True) -> Dict:
        if properties is None:
            properties = {}
        
        similar = self.find_similar_entity(name, entity_type)
        canonical_name = entity_resolver.get_canonical_name(name)
        
        result = {
            "name": name,
            "canonical_name": canonical_name,
            "is_duplicate": False,
            "similar_entity": similar,
            "merged": False,
            "entity": None
        }
        
        if similar and auto_merge:
            aliases = properties.get("aliases", [])
            if isinstance(aliases, str):
                aliases = [aliases]
            if name not in aliases:
                aliases.append(name)
            
            updated_props = dict(similar.get("properties", {}))
            updated_props["aliases"] = aliases
            
            self.update_entity_properties(similar["id"], updated_props)
            result["merged"] = True
            result["entity"] = similar
            result["is_duplicate"] = True
            return result
        
        entity = self.add_entity(canonical_name if similar is None and canonical_name != name else name, 
                                 entity_type, properties)
        result["entity"] = entity
        return result
    
    def update_entity_properties(self, entity_id: str, properties: Dict):
        if not self.driver:
            return None
        
        with self.driver.session() as session:
            result = session.execute_write(
                self._update_entity_properties, entity_id, properties
            )
            return result
    
    @staticmethod
    def _update_entity_properties(tx, entity_id: str, properties: Dict):
        props_str = ", ".join([f"n.{k} = ${k}" for k in properties.keys()])
        
        query = f"""
        MATCH (n) WHERE elementId(n) = $id
        SET {props_str}
        RETURN n, elementId(n) as id
        """
        result = tx.run(query, id=entity_id, **properties)
        record = result.single()
        if record:
            return {"id": record["id"], "properties": properties}
        return None
    
    def merge_entities(self, primary_id: str, duplicate_id: str) -> Dict:
        if not self.driver:
            return {"success": False, "error": "No database connection"}
        
        with self.driver.session() as session:
            result = session.execute_write(
                self._merge_entities, primary_id, duplicate_id
            )
            return result
    
    @staticmethod
    def _merge_entities(tx, primary_id: str, duplicate_id: str):
        query = """
        MATCH (primary), (duplicate)
        WHERE elementId(primary) = $primary_id AND elementId(duplicate) = $duplicate_id
        WITH primary, duplicate, properties(duplicate) as dup_props
        MATCH (duplicate)-[r]->(target)
        MERGE (primary)-[new_r:RELATIONSHIP]->(target)
        SET new_r = properties(r)
        WITH primary, duplicate, dup_props
        MATCH (source)-[r]->(duplicate)
        MERGE (source)-[new_r:RELATIONSHIP]->(primary)
        SET new_r = properties(r)
        WITH primary, duplicate, dup_props
        SET primary.aliases = COALESCE(primary.aliases, []) + [duplicate.name]
        SET primary += dup_props
        DETACH DELETE duplicate
        RETURN primary, elementId(primary) as id
        """
        result = tx.run(query, primary_id=primary_id, duplicate_id=duplicate_id)
        record = result.single()
        if record:
            return {"success": True, "primary_id": record["id"]}
        return {"success": False, "error": "Merge failed"}
    
    def check_relationship_conflicts(self, source: str, source_type: str, 
                                       relation: str, target: str, 
                                       target_type: str) -> Dict:
        if not self.driver:
            return {"has_conflict": False, "conflicts": []}
        
        graph_data = self.get_all_graph_data()
        entity_names = {node["id"]: node["name"] for node in graph_data["nodes"]}
        
        existing_rels = []
        for link in graph_data["links"]:
            existing_rels.append({
                "source_name": entity_names.get(link["source"], ""),
                "relation": link["relation"],
                "target_name": entity_names.get(link["target"], "")
            })
        
        has_conflict, conflicts = conflict_detector.check_relationship_conflict(
            source, relation, target, existing_rels, entity_resolver
        )
        
        return {
            "has_conflict": has_conflict,
            "conflicts": conflicts,
            "severity": "high" if len(conflicts) > 1 else "medium" if conflicts else "low"
        }
    
    def check_world_setting_conflicts(self, description: str) -> Dict:
        existing_settings = self.get_world_settings()
        return conflict_detector.analyze_world_setting_consistency(
            {"description": description}, existing_settings
        )
    
    def get_entity_aliases(self, entity_id: str) -> List[str]:
        if not self.driver:
            return []
        
        with self.driver.session() as session:
            result = session.execute_read(
                self._get_entity_aliases, entity_id
            )
            return result or []
    
    @staticmethod
    def _get_entity_aliases(tx, entity_id: str):
        query = """
        MATCH (n) WHERE elementId(n) = $id
        RETURN COALESCE(n.aliases, []) as aliases
        """
        result = tx.run(query, id=entity_id)
        record = result.single()
        return record["aliases"] if record else []

db = Neo4jDatabase()
