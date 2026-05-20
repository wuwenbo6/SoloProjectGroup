from celery import group, chain
from datetime import datetime
from app.tasks.celery_config import celery_app
from app.services.sequence_service import SequenceService
from app.algorithms.fasta_parser import parse_fasta


@celery_app.task(bind=True)
def align_single_sequence(self, sequence: str, seq_type: str = 'DNA', evalue_threshold: float = 10.0):
    try:
        blast = SequenceService.load_blast_instance(seq_type)
        results = blast.align_single(sequence, evalue_threshold)
        
        return {
            'query_length': len(sequence),
            'seq_type': seq_type,
            'results': results
        }
    except Exception as e:
        return {
            'error': str(e),
            'query_length': len(sequence),
            'seq_type': seq_type,
            'results': []
        }


@celery_app.task(bind=True)
def align_multiple_sequences(self, fasta_content: str, seq_type: str = 'DNA', evalue_threshold: float = 10.0):
    try:
        sequences = parse_fasta(fasta_content)
        
        tasks = group(
            align_single_sequence.s(
                seq['sequence'],
                seq_type,
                evalue_threshold
            ) for seq in sequences
        )
        
        job = tasks.apply_async()
        
        return {
            'job_id': job.id,
            'num_sequences': len(sequences),
            'seq_type': seq_type
        }
    except Exception as e:
        return {
            'error': str(e),
            'num_sequences': 0,
            'results': []
        }


@celery_app.task(bind=True)
def align_sequence_with_job(self, job_id: str, sequence: str, seq_type: str = 'DNA', evalue_threshold: float = 10.0):
    import asyncio
    
    async def update_job():
        await SequenceService.update_alignment_job(job_id, {'status': 'processing'})
        
        blast = SequenceService.load_blast_instance(seq_type)
        results = blast.align_single(sequence, evalue_threshold)
        
        await SequenceService.update_alignment_job(job_id, {
            'status': 'completed',
            'query_length': len(sequence),
            'results': results,
            'completed_at': datetime.utcnow()
        })
        
        return results
    
    loop = asyncio.get_event_loop()
    if loop.is_closed():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    return loop.run_until_complete(update_job())


@celery_app.task(bind=True)
def build_index_task(self, seq_type: str = 'DNA'):
    try:
        blast = SequenceService.load_blast_instance(seq_type)
        stats = blast.get_db_stats()
        
        return {
            'status': 'success',
            'stats': stats
        }
    except Exception as e:
        return {
            'status': 'error',
            'error': str(e)
        }


def get_task_status(task_id: str):
    result = celery_app.AsyncResult(task_id)
    
    status_info = {
        'task_id': task_id,
        'status': result.status
    }
    
    if result.state == 'SUCCESS':
        status_info['result'] = result.result
    elif result.state == 'FAILURE':
        status_info['error'] = str(result.info)
    
    return status_info
