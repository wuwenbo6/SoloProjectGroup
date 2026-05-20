from typing import List, Dict, Tuple
from collections import defaultdict
import heapq


class CDHIT:
    """
    CD-HIT algorithm for sequence clustering and redundancy removal.
    Fast sequence clustering using word counting and incremental clustering.
    """
    
    def __init__(self, threshold: float = 0.9, word_size: int = 5):
        self.threshold = threshold
        self.word_size = word_size
        self.clusters: List[Dict] = []
    
    def _get_word_frequency(self, sequence: str) -> Dict[str, int]:
        """Extract k-mers from sequence"""
        words = defaultdict(int)
        for i in range(len(sequence) - self.word_size + 1):
            word = sequence[i:i + self.word_size]
            words[word] += 1
        return dict(words)
    
    def _calculate_similarity(self, seq1: str, seq2: str) -> float:
        """Calculate sequence similarity using k-mer based comparison"""
        if len(seq1) == 0 or len(seq2) == 0:
            return 0.0
        
        words1 = set([seq1[i:i + self.word_size] for i in range(len(seq1) - self.word_size + 1)])
        words2 = set([seq2[i:i + self.word_size] for i in range(len(seq2) - self.word_size + 1)])
        
        if not words1 or not words2:
            return 0.0
        
        intersection = len(words1 & words2)
        union = len(words1 | words2)
        
        return intersection / union if union > 0 else 0.0
    
    def _calculate_identity(self, seq1: str, seq2: str) -> float:
        """Calculate exact sequence identity using alignment"""
        if len(seq1) == 0 or len(seq2) == 0:
            return 0.0
        
        if len(seq1) > len(seq2):
            seq1, seq2 = seq2, seq1
        
        matches = 0
        for i in range(len(seq1)):
            if seq1[i] == seq2[i]:
                matches += 1
        
        return matches / max(len(seq1), len(seq2))
    
    def cluster(self, sequences: List[Dict[str, str]]) -> List[Dict]:
        """
        Cluster sequences using CD-HIT algorithm
        sequences: list of dicts with 'seq_id' and 'sequence' keys
        """
        if not sequences:
            return []
        
        sorted_seqs = sorted(sequences, key=lambda x: len(x['sequence']), reverse=True)
        
        clusters = []
        
        for seq in sorted_seqs:
            seq_words = self._get_word_frequency(seq['sequence'])
            seq_len = len(seq['sequence'])
            
            matched = False
            best_cluster_idx = -1
            best_similarity = 0.0
            
            for i, cluster in enumerate(clusters):
                representative = cluster['representative']
                
                similarity = self._calculate_similarity(seq['sequence'], representative['sequence'])
                
                if similarity >= self.threshold:
                    identity = self._calculate_identity(seq['sequence'], representative['sequence'])
                    if identity >= self.threshold:
                        cluster['members'].append({
                            'seq_id': seq['seq_id'],
                            'sequence': seq['sequence'],
                            'header': seq.get('header', seq['seq_id']),
                            'identity_to_representative': identity,
                            'length': seq_len
                        })
                        cluster['size'] += 1
                        matched = True
                        break
            
            if not matched:
                clusters.append({
                    'cluster_id': len(clusters),
                    'representative': {
                        'seq_id': seq['seq_id'],
                        'sequence': seq['sequence'],
                        'header': seq.get('header', seq['seq_id']),
                        'length': seq_len
                    },
                    'members': [],
                    'size': 1,
                    'avg_length': seq_len
                })
        
        for cluster in clusters:
            if cluster['members']:
                total_len = cluster['representative']['length'] + sum(m['length'] for m in cluster['members'])
                cluster['avg_length'] = total_len / cluster['size']
        
        self.clusters = clusters
        return clusters
    
    def get_representative_sequences(self) -> List[Dict]:
        """Get representative sequences from each cluster"""
        return [cluster['representative'] for cluster in self.clusters]
    
    def get_cluster_stats(self) -> Dict:
        """Get clustering statistics"""
        if not self.clusters:
            return {}
        
        total_sequences = sum(cluster['size'] for cluster in self.clusters)
        avg_cluster_size = total_sequences / len(self.clusters) if self.clusters else 0
        
        return {
            'num_clusters': len(self.clusters),
            'total_sequences': total_sequences,
            'avg_cluster_size': avg_cluster_size,
            'threshold': self.threshold,
            'word_size': self.word_size,
            'redundancy_removed': (total_sequences - len(self.clusters)) / max(total_sequences, 1)
        }


def cluster_sequences(sequences: List[Dict[str, str]], threshold: float = 0.9) -> Tuple[List[Dict], Dict]:
    """
    Convenience function to cluster sequences using CD-HIT
    Returns: (clusters, statistics)
    """
    cdhit = CDHIT(threshold=threshold)
    clusters = cdhit.cluster(sequences)
    stats = cdhit.get_cluster_stats()
    return clusters, stats
