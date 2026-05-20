from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
from datetime import datetime
import os

Base = declarative_base()


class TypewriterModel(Base):
    __tablename__ = 'typewriter_models'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    brand = Column(String(100))
    model_type = Column(String(50))
    font_type = Column(String(100))
    year = Column(Integer)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    documents = relationship("Document", back_populates="typewriter")
    
    def __repr__(self):
        return f"<TypewriterModel {self.name}>"


class Document(Base):
    __tablename__ = 'documents'
    
    id = Column(Integer, primary_key=True)
    title = Column(String(200), nullable=False)
    typewriter_id = Column(Integer, ForeignKey('typewriter_models.id'))
    font_type = Column(String(100))
    character_count = Column(Integer, default=0)
    corrected_count = Column(Integer, default=0)
    average_confidence = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    category = Column(String(100))
    notes = Column(Text)
    
    typewriter = relationship("TypewriterModel", back_populates="documents")
    characters = relationship("Character", back_populates="document", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Document {self.title}>"


class Character(Base):
    __tablename__ = 'characters'
    
    id = Column(Integer, primary_key=True)
    document_id = Column(Integer, ForeignKey('documents.id'))
    position = Column(Integer, nullable=False)
    character = Column(String(1), nullable=False)
    original_char = Column(String(1))
    font_type = Column(String(100))
    confidence = Column(Float, default=0.0)
    is_corrected = Column(Boolean, default=False)
    timestamp = Column(DateTime)
    style_features = Column(Text)
    
    document = relationship("Document", back_populates="characters")
    
    def __repr__(self):
        return f"<Character {self.character} @ {self.position}>"


class ArchiveCategory(Base):
    __tablename__ = 'archive_categories'
    
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.now)
    
    def __repr__(self):
        return f"<ArchiveCategory {self.name}>"


class DatabaseManager:
    def __init__(self, db_path: str = None):
        if db_path is None:
            home_dir = os.path.expanduser("~")
            app_dir = os.path.join(home_dir, ".typewriter_digitizer")
            os.makedirs(app_dir, exist_ok=True)
            db_path = os.path.join(app_dir, "typewriter.db")
            
        self.engine = create_engine(f'sqlite:///{db_path}')
        Base.metadata.create_all(self.engine)
        Session = sessionmaker(bind=self.engine)
        self.session = Session()
        
    def add_typewriter(self, name: str, brand: str = "", model_type: str = "", 
                      font_type: str = "", year: int = None, description: str = "") -> TypewriterModel:
        typewriter = TypewriterModel(
            name=name,
            brand=brand,
            model_type=model_type,
            font_type=font_type,
            year=year,
            description=description
        )
        self.session.add(typewriter)
        self.session.commit()
        return typewriter
        
    def get_all_typewriters(self) -> list:
        return self.session.query(TypewriterModel).all()
        
    def add_document(self, title: str, typewriter_id: int = None, 
                    font_type: str = "", category: str = "", notes: str = "") -> Document:
        document = Document(
            title=title,
            typewriter_id=typewriter_id,
            font_type=font_type,
            category=category,
            notes=notes
        )
        self.session.add(document)
        self.session.commit()
        return document
        
    def add_characters_to_document(self, document_id: int, characters: list):
        sorted_chars = sorted(characters, key=lambda x: x.get("sequence", 0))
        
        for idx, char_data in enumerate(sorted_chars):
            char = Character(
                document_id=document_id,
                position=idx,
                character=char_data.get("character", ""),
                original_char=char_data.get("original_char", ""),
                font_type=char_data.get("font_type", ""),
                confidence=float(char_data.get("confidence", 0.0)),
                is_corrected=bool(char_data.get("is_corrected", False)),
                style_features=str(char_data.get("style_features", {}))
            )
            self.session.add(char)
            
        doc = self.session.query(Document).get(document_id)
        if doc:
            doc.character_count = len(sorted_chars)
            doc.corrected_count = sum(1 for c in sorted_chars if c.get("is_corrected", False))
            
        self.session.commit()
        
    def get_all_documents(self) -> list:
        return self.session.query(Document).order_by(Document.created_at.desc()).all()
        
    def get_document_by_id(self, document_id: int) -> Document:
        return self.session.query(Document).get(document_id)
        
    def get_characters_by_document(self, document_id: int) -> list:
        chars = self.session.query(Character).filter_by(document_id=document_id).order_by(Character.position).all()
        
        result = []
        for char in chars:
            result.append({
                "sequence": char.position,
                "character": char.character,
                "original_char": char.original_char,
                "font_type": char.font_type,
                "confidence": char.confidence,
                "is_corrected": char.is_corrected,
                "style_features": char.style_features
            })
        return result
        
    def delete_document(self, document_id: int):
        doc = self.session.query(Document).get(document_id)
        if doc:
            self.session.delete(doc)
            self.session.commit()
            
    def add_category(self, name: str, description: str = "") -> ArchiveCategory:
        category = ArchiveCategory(name=name, description=description)
        self.session.add(category)
        self.session.commit()
        return category
        
    def get_all_categories(self) -> list:
        return self.session.query(ArchiveCategory).all()
        
    def search_documents(self, keyword: str) -> list:
        return self.session.query(Document).filter(
            Document.title.contains(keyword) | 
            Document.notes.contains(keyword)
        ).all()
        
    def get_statistics(self) -> dict:
        total_docs = self.session.query(Document).count()
        total_chars = self.session.query(Character).count()
        total_typewriters = self.session.query(TypewriterModel).count()
        
        return {
            "total_documents": total_docs,
            "total_characters": total_chars,
            "total_typewriters": total_typewriters
        }
        
    def close(self):
        self.session.close()
