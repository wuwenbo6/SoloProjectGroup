import spacy
from typing import List, Dict, Tuple
import re

nlp = None

def load_spacy_model():
    global nlp
    if nlp is None:
        try:
            nlp = spacy.load("en_core_web_sm")
        except:
            import subprocess
            subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"])
            nlp = spacy.load("en_core_web_sm")
    return nlp

def extract_entities(text: str) -> Dict[str, List[str]]:
    nlp = load_spacy_model()
    doc = nlp(text)
    
    entities = {
        "PERSON": [],
        "GPE": [],
        "ORG": [],
        "EVENT": [],
        "WORK_OF_ART": [],
        "PRODUCT": []
    }
    
    for ent in doc.ents:
        if ent.label_ in entities:
            clean_entity = clean_entity_text(ent.text)
            if clean_entity and clean_entity not in entities[ent.label_]:
                entities[ent.label_].append(clean_entity)
    
    return entities

def clean_entity_text(text: str) -> str:
    text = re.sub(r'^[\s\'".,!?;:]+|[\s\'".,!?;:]+$', '', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def extract_relationships(text: str) -> List[Tuple[str, str, str]]:
    nlp = load_spacy_model()
    doc = nlp(text)
    
    relationships = []
    
    for sent in doc.sents:
        sent_doc = sent.as_doc()
        persons = [ent for ent in sent_doc.ents if ent.label_ == "PERSON"]
        orgs = [ent for ent in sent_doc.ents if ent.label_ == "ORG"]
        gpes = [ent for ent in sent_doc.ents if ent.label_ == "GPE"]
        
        all_entities = persons + orgs + gpes
        
        if len(all_entities) >= 2:
            for i, ent1 in enumerate(all_entities):
                for ent2 in all_entities[i+1:]:
                    relation = infer_relationship(sent_doc, ent1, ent2)
                    if relation:
                        relationships.append((
                            clean_entity_text(ent1.text),
                            relation,
                            clean_entity_text(ent2.text)
                        ))
    
    return relationships

def infer_relationship(sent_doc, ent1, ent2) -> str:
    start = min(ent1.end, ent2.end)
    end = max(ent1.start, ent2.start)
    
    if start >= end:
        return None
    
    between_tokens = [token for token in sent_doc if start <= token.i < end]
    verbs = [token.lemma_ for token in between_tokens if token.pos_ == "VERB"]
    
    if verbs:
        return verbs[0]
    
    return "related_to"
