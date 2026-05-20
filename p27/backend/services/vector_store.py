import uuid
import faiss
import numpy as np
from typing import List, Dict
from loguru import logger
from datetime import datetime
from elasticsearch import Elasticsearch
from elasticsearch.helpers import bulk
from sentence_transformers import SentenceTransformer

from config import settings
from schemas.models import Entity, DocumentInfo, Source


class VectorStore:
    def __init__(self):
        self.es = Elasticsearch(
            settings.elasticsearch_host,
            basic_auth=(settings.elasticsearch_user, settings.elasticsearch_password),
            verify_certs=False
        )

        self.embedding_model = SentenceTransformer(settings.embedding_model_name)
        self.embedding_dim = settings.embedding_dimension

        self.index_name = "documents"
        self.chunk_index_name = "document_chunks"

        self.vector_index_path = "data/faiss_index.bin"
        self.vector_index = None
        self.vector_mapping = {}

        self._init_elasticsearch()
        self._init_vector_index()

        logger.info("向量存储模块初始化完成")

    def _init_elasticsearch(self):
        try:
            if not self.es.indices.exists(index=self.index_name):
                doc_index_mapping = {
                    "mappings": {
                        "properties": {
                            "document_id": {"type": "keyword"},
                            "filename": {"type": "text"},
                            "file_path": {"type": "keyword"},
                            "upload_time": {"type": "date"},
                            "entities": {
                                "type": "nested",
                                "properties": {
                                    "type": {"type": "keyword"},
                                    "value": {"type": "text"},
                                    "confidence": {"type": "float"},
                                    "bbox": {"type": "float"}
                                }
                            },
                            "page_count": {"type": "integer"}
                        }
                    }
                }
                self.es.indices.create(index=self.index_name, body=doc_index_mapping)
                logger.info("文档索引创建完成")

            if not self.es.indices.exists(index=self.chunk_index_name):
                chunk_index_mapping = {
                    "mappings": {
                        "properties": {
                            "chunk_id": {"type": "keyword"},
                            "document_id": {"type": "keyword"},
                            "filename": {"type": "text"},
                            "page_num": {"type": "integer"},
                            "content": {"type": "text"},
                            "embedding": {
                                "type": "dense_vector",
                                "dims": self.embedding_dim,
                                "index": True,
                                "similarity": "cosine"
                            }
                        }
                    }
                }
                self.es.indices.create(index=self.chunk_index_name, body=chunk_index_mapping)
                logger.info("文档块索引创建完成")

        except Exception as e:
            logger.error(f"Elasticsearch初始化失败: {str(e)}")
            raise

    def _init_vector_index(self):
        try:
            import os
            os.makedirs("data", exist_ok=True)

            if os.path.exists(self.vector_index_path):
                self.vector_index = faiss.read_index(self.vector_index_path)
                logger.info("FAISS索引加载完成")
            else:
                self.vector_index = faiss.IndexFlatL2(self.embedding_dim)
                logger.info("新建FAISS索引")
        except Exception as e:
            logger.error(f"FAISS索引初始化失败: {str(e)}")
            raise

    async def store_document(
        self,
        filename: str,
        file_path: str,
        ocr_results: List[Dict],
        entities: List[Entity]
    ) -> str:
        document_id = str(uuid.uuid4())

        doc_data = {
            "document_id": document_id,
            "filename": filename,
            "file_path": file_path,
            "upload_time": datetime.now(),
            "entities": [e.dict() for e in entities],
            "ocr_results": ocr_results,
            "page_count": len(ocr_results)
        }

        self.es.index(index=self.index_name, id=document_id, body=doc_data)
        logger.info(f"文档元数据已存储: {document_id}")

        await self._store_chunks(document_id, filename, ocr_results)
        return document_id

    async def _store_chunks(self, document_id: str, filename: str, ocr_results: List[Dict]):
        chunks = []
        for page_num, ocr_result in enumerate(ocr_results):
            text = ocr_result['text']
            text_chunks = self._split_text(text, chunk_size=512, overlap=50)

            for chunk_idx, chunk_content in enumerate(text_chunks):
                chunk_id = f"{document_id}_{page_num}_{chunk_idx}"

                embedding = self.embedding_model.encode(chunk_content)

                chunk_data = {
                    "chunk_id": chunk_id,
                    "document_id": document_id,
                    "filename": filename,
                    "page_num": page_num,
                    "content": chunk_content,
                    "embedding": embedding.tolist()
                }
                chunks.append(chunk_data)

        if chunks:
            actions = [
                {
                    "_index": self.chunk_index_name,
                    "_id": chunk["chunk_id"],
                    "_source": chunk
                }
                for chunk in chunks
            ]
            bulk(self.es, actions)
            logger.info(f"文档块存储完成，共 {len(chunks)} 块")

            embeddings = np.array([c["embedding"] for c in chunks])
            self.vector_index.add(embeddings.astype('float32'))

            idx = len(self.vector_mapping)
            for chunk in chunks:
                self.vector_mapping[idx] = chunk
                idx += 1

            faiss.write_index(self.vector_index, self.vector_index_path)
            logger.info("FAISS索引更新完成")

    def _split_text(self, text: str, chunk_size: int = 512, overlap: int = 50) -> List[str]:
        if len(text) <= chunk_size:
            return [text]

        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunk = text[start:end]
            chunks.append(chunk)
            start = end - overlap

        return chunks

    async def search_similar(self, query: str, document_id: str = None, top_k: int = 5) -> List[Source]:
        query_embedding = self.embedding_model.encode(query)

        search_query = {
            "knn": {
                "field": "embedding",
                "query_vector": query_embedding.tolist(),
                "k": top_k,
                "num_candidates": top_k * 10
            },
            "_source": ["document_id", "filename", "content", "page_num"]
        }

        if document_id:
            search_query["query"] = {
                "term": {
                    "document_id": document_id
                }
            }

        response = self.es.search(index=self.chunk_index_name, body=search_query)

        sources = []
        for hit in response['hits']['hits']:
            source = hit['_source']
            sources.append(Source(
                document_id=source['document_id'],
                filename=source['filename'],
                content=source['content'],
                page_num=source['page_num'],
                score=hit['_score']
            ))

        return sources

    async def list_documents(self) -> List[DocumentInfo]:
        query = {
            "query": {"match_all": {}},
            "sort": [{"upload_time": {"order": "desc"}}]
        }

        response = self.es.search(index=self.index_name, body=query)

        documents = []
        for hit in response['hits']['hits']:
            source = hit['_source']
            documents.append(DocumentInfo(
                document_id=source['document_id'],
                filename=source['filename'],
                upload_time=datetime.fromisoformat(source['upload_time'].replace('Z', '+00:00')),
                entities=[Entity(**e) for e in source['entities']],
                page_count=source['page_count']
            ))

        return documents

    async def delete_document(self, document_id: str):
        self.es.delete(index=self.index_name, id=document_id)

        delete_query = {
            "query": {
                "term": {
                    "document_id": document_id
                }
            }
        }
        self.es.delete_by_query(index=self.chunk_index_name, body=delete_query)

        logger.info(f"文档删除完成: {document_id}")

    async def get_document_full(self, document_id: str) -> Optional[Dict]:
        try:
            response = self.es.get(index=self.index_name, id=document_id)
            source = response['_source']
            return {
                'document_id': source['document_id'],
                'filename': source['filename'],
                'file_path': source.get('file_path', ''),
                'upload_time': source['upload_time'],
                'entities': [Entity(**e) for e in source['entities']],
                'ocr_results': source.get('ocr_results', []),
                'page_count': source.get('page_count', 0)
            }
        except Exception as e:
            logger.error(f"获取文档失败 {document_id}: {str(e)}")
            return None
