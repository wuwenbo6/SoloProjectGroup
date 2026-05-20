import numpy as np
import math
from typing import List, Dict, Tuple, Optional
from collections import defaultdict
from app.algorithms.bwt_index import SequenceIndex


class ScoringMatrix:
    DNA = {
        ('A', 'A'): 1, ('A', 'T'): -1, ('A', 'G'): -1, ('A', 'C'): -1, ('A', 'N'): 0,
        ('T', 'A'): -1, ('T', 'T'): 1, ('T', 'G'): -1, ('T', 'C'): -1, ('T', 'N'): 0,
        ('G', 'A'): -1, ('G', 'T'): -1, ('G', 'G'): 1, ('G', 'C'): -1, ('G', 'N'): 0,
        ('C', 'A'): -1, ('C', 'T'): -1, ('C', 'G'): -1, ('C', 'C'): 1, ('C', 'N'): 0,
        ('N', 'A'): 0, ('N', 'T'): 0, ('N', 'G'): 0, ('N', 'C'): 0, ('N', 'N'): 0
    }

    BLOSUM62 = {
        ('A', 'A'): 4, ('A', 'R'): -1, ('A', 'N'): -2, ('A', 'D'): -2, ('A', 'C'): 0,
        ('A', 'Q'): -1, ('A', 'E'): -1, ('A', 'G'): 0, ('A', 'H'): -2, ('A', 'I'): -1,
        ('A', 'L'): -1, ('A', 'K'): -1, ('A', 'M'): -1, ('A', 'F'): -2, ('A', 'P'): -1,
        ('A', 'S'): 1, ('A', 'T'): 0, ('A', 'W'): -3, ('A', 'Y'): -2, ('A', 'V'): 0,
        ('R', 'A'): -1, ('R', 'R'): 5, ('R', 'N'): 0, ('R', 'D'): -2, ('R', 'C'): -3,
        ('R', 'Q'): 1, ('R', 'E'): 0, ('R', 'G'): -2, ('R', 'H'): 0, ('R', 'I'): -3,
        ('R', 'L'): -2, ('R', 'K'): 2, ('R', 'M'): -1, ('R', 'F'): -3, ('R', 'P'): -2,
        ('R', 'S'): -1, ('R', 'T'): -1, ('R', 'W'): -3, ('R', 'Y'): -2, ('R', 'V'): -3,
        ('N', 'A'): -2, ('N', 'R'): 0, ('N', 'N'): 6, ('N', 'D'): 1, ('N', 'C'): -3,
        ('N', 'Q'): 0, ('N', 'E'): 0, ('N', 'G'): 0, ('N', 'H'): 1, ('N', 'I'): -3,
        ('N', 'L'): -3, ('N', 'K'): 0, ('N', 'M'): -2, ('N', 'F'): -3, ('N', 'P'): -2,
        ('N', 'S'): 1, ('N', 'T'): 0, ('N', 'W'): -4, ('N', 'Y'): -2, ('N', 'V'): -3,
    }

    @staticmethod
    def get_score(a: str, b: str, matrix_type: str = 'DNA') -> int:
        if matrix_type == 'DNA':
            return ScoringMatrix.DNA.get((a.upper(), b.upper()), -1)
        else:
            return ScoringMatrix.BLOSUM62.get((a.upper(), b.upper()), -1)


class BLASTAlignment:
    def __init__(self, sequence_index: SequenceIndex, seq_type: str = 'DNA'):
        self.sequence_index = sequence_index
        self.seq_type = seq_type.upper()
        self.word_size = 11 if self.seq_type == 'DNA' else 3
        self.gap_open = -10
        self.gap_extend = -1
        self.threshold = 11 if self.seq_type == 'DNA' else 11
        self.db_size = self._calculate_db_size()

    def _calculate_db_size(self) -> int:
        total = 0
        for seq_id in self.sequence_index.get_all_seq_ids():
            seq = self.sequence_index.get_sequence(seq_id)
            if seq:
                total += len(seq)
        return total if total > 0 else 1

    def _generate_words(self, sequence: str) -> List[Tuple[str, int]]:
        words = []
        n = len(sequence)
        for i in range(n - self.word_size + 1):
            word = sequence[i:i + self.word_size]
            words.append((word, i))
        return words

    def _calculate_bit_score(self, raw_score: float) -> float:
        lam = 0.318
        k = 0.134
        return (lam * raw_score - math.log(k)) / math.log(2)

    def _calculate_evalue(self, raw_score: float, query_length: int) -> float:
        lam = 0.318
        k = 0.134
        effective_db_size = self.db_size - query_length * len(self.sequence_index.get_all_seq_ids())
        if effective_db_size <= 0:
            effective_db_size = self.db_size
        return k * effective_db_size * query_length * math.exp(-lam * raw_score)

    def _extend_hit(self, query: str, subject: str, q_pos: int, s_pos: int) -> Dict:
        best_score = 0
        best_q_start = q_pos
        best_q_end = q_pos + self.word_size
        best_s_start = s_pos
        best_s_end = s_pos + self.word_size

        score = 0
        i, j = q_pos - 1, s_pos - 1
        while i >= 0 and j >= 0:
            score += ScoringMatrix.get_score(query[i], subject[j], self.seq_type)
            if score > best_score:
                best_score = score
                best_q_start = i
                best_s_start = j
            elif score < best_score - 20:
                break
            i -= 1
            j -= 1

        score = best_score
        i, j = q_pos + self.word_size, s_pos + self.word_size
        while i < len(query) and j < len(subject):
            score += ScoringMatrix.get_score(query[i], subject[j], self.seq_type)
            if score > best_score:
                best_score = score
                best_q_end = i + 1
                best_s_end = j + 1
            elif score < best_score - 20:
                break
            i += 1
            j += 1

        aligned_query = query[best_q_start:best_q_end]
        aligned_subject = subject[best_s_start:best_s_end]

        matches = sum(1 for a, b in zip(aligned_query, aligned_subject) if a == b)
        identity = matches / len(aligned_query) if aligned_query else 0

        return {
            'query_start': best_q_start,
            'query_end': best_q_end,
            'subject_start': best_s_start,
            'subject_end': best_s_end,
            'aligned_query': aligned_query,
            'aligned_subject': aligned_subject,
            'score': best_score,
            'bit_score': self._calculate_bit_score(best_score),
            'identity': identity,
            'evalue': self._calculate_evalue(best_score, len(query))
        }

    def align_sequence(self, query: str, evalue_threshold: float = 10.0) -> List[Dict]:
        query = query.upper()
        words = self._generate_words(query)
        hits = defaultdict(list)

        for word, q_pos in words:
            search_results = self.sequence_index.search_pattern(word)
            for result in search_results:
                seq_id = result['seq_id']
                for s_pos in result['positions']:
                    hits[seq_id].append((q_pos, s_pos))

        alignments = []
        for seq_id, hit_list in hits.items():
            subject = self.sequence_index.get_sequence(seq_id)
            if not subject:
                continue

            seen_extensions = set()
            for q_pos, s_pos in hit_list:
                key = (q_pos // 10, s_pos // 10)
                if key in seen_extensions:
                    continue
                seen_extensions.add(key)

                alignment = self._extend_hit(query, subject, q_pos, s_pos)
                if alignment['evalue'] <= evalue_threshold and alignment['score'] > 0:
                    alignment['seq_id'] = seq_id
                    alignments.append(alignment)

        alignments.sort(key=lambda x: (x['evalue'], -x['score']))
        return alignments


class MultiBLAST:
    def __init__(self, seq_type: str = 'DNA'):
        self.sequence_index = SequenceIndex()
        self.seq_type = seq_type

    def add_to_database(self, seq_id: str, sequence: str, metadata: dict = None):
        self.sequence_index.add_sequence(seq_id, sequence.upper(), metadata)

    def align_single(self, query: str, evalue_threshold: float = 10.0) -> List[Dict]:
        blast = BLASTAlignment(self.sequence_index, self.seq_type)
        return blast.align_sequence(query, evalue_threshold)

    def get_db_stats(self) -> Dict:
        seq_ids = self.sequence_index.get_all_seq_ids()
        total_length = sum(
            len(self.sequence_index.get_sequence(sid))
            for sid in seq_ids
            if self.sequence_index.get_sequence(sid)
        )
        return {
            'num_sequences': len(seq_ids),
            'total_length': total_length,
            'seq_type': self.seq_type
        }
