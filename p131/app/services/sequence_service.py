from datetime import datetime
from typing import List, Optional, Dict, Tuple
from bson import ObjectId
from app.core.database import get_database, get_sync_database
from app.algorithms.fasta_parser import calculate_gc_content
from app.algorithms.blast import MultiBLAST


class SequenceService:
    @staticmethod
    async def create_sequence(sequence_data: dict) -> dict:
        db = await get_database()
        
        seq_data = {
            **sequence_data,
            'length': len(sequence_data['sequence']),
            'gc_content': calculate_gc_content(sequence_data['sequence']) if sequence_data['seq_type'] == 'DNA' else None,
            'created_at': datetime.utcnow()
        }
        
        result = await db.sequences.insert_one(seq_data)
        seq_data['id'] = str(result.inserted_id)
        return seq_data

    @staticmethod
    async def get_sequence(seq_id: str) -> Optional[dict]:
        db = await get_database()
        seq = await db.sequences.find_one({'seq_id': seq_id})
        if seq:
            seq['id'] = str(seq['_id'])
            del seq['_id']
        return seq

    @staticmethod
    async def get_all_sequences(skip: int = 0, limit: int = 50) -> Tuple[List[dict], int]:
        db = await get_database()
        cursor = db.sequences.find().skip(skip).limit(limit)
        sequences = []
        async for seq in cursor:
            seq['id'] = str(seq['_id'])
            del seq['_id']
            sequences.append(seq)
        
        total = await db.sequences.count_documents({})
        return sequences, total

    @staticmethod
    async def delete_sequence(seq_id: str) -> bool:
        db = await get_database()
        result = await db.sequences.delete_one({'seq_id': seq_id})
        return result.deleted_count > 0

    @staticmethod
    async def get_stats() -> dict:
        db = await get_database()
        pipeline = [
            {
                '$group': {
                    '_id': None,
                    'num_sequences': {'$sum': 1},
                    'total_length': {'$sum': '$length'},
                    'avg_length': {'$avg': '$length'}
                }
            }
        ]
        
        result = await db.sequences.aggregate(pipeline).to_list(length=1)
        stats = result[0] if result else {
            'num_sequences': 0,
            'total_length': 0,
            'avg_length': 0
        }
        
        type_pipeline = [
            {
                '$group': {
                    '_id': '$seq_type',
                    'count': {'$sum': 1}
                }
            }
        ]
        
        type_results = await db.sequences.aggregate(type_pipeline).to_list(length=10)
        seq_type_distribution = {t['_id']: t['count'] for t in type_results}
        
        return {
            'num_sequences': stats['num_sequences'],
            'total_length': stats['total_length'],
            'avg_length': stats['avg_length'],
            'seq_type_distribution': seq_type_distribution
        }

    @staticmethod
    def load_blast_instance(seq_type: str = 'DNA', batch_size: int = 100) -> MultiBLAST:
        db = get_sync_database()
        blast = MultiBLAST(seq_type)
        
        query = {'seq_type': seq_type}
        total = db.sequences.count_documents(query)
        
        for batch_start in range(0, total, batch_size):
            sequences = db.sequences.find(query).skip(batch_start).limit(batch_size)
            for seq in sequences:
                blast.add_to_database(
                    seq['seq_id'],
                    seq['sequence'],
                    {'header': seq['header']}
                )
        
        return blast

    @staticmethod
    async def create_alignment_job(job_data: dict) -> str:
        db = await get_database()
        job = {
            **job_data,
            'status': 'pending',
            'created_at': datetime.utcnow(),
            'completed_at': None
        }
        result = await db.alignment_jobs.insert_one(job)
        return str(result.inserted_id)

    @staticmethod
    async def get_alignment_job(job_id: str) -> Optional[dict]:
        db = await get_database()
        job = await db.alignment_jobs.find_one({'_id': ObjectId(job_id)})
        if job:
            job['id'] = str(job['_id'])
            del job['_id']
        return job

    @staticmethod
    async def update_alignment_job(job_id: str, update_data: dict) -> bool:
        db = await get_database()
        result = await db.alignment_jobs.update_one(
            {'_id': ObjectId(job_id)},
            {'$set': update_data}
        )
        return result.modified_count > 0
