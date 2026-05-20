import numpy as np
from collections import defaultdict
from typing import Dict, List, Tuple, Optional


class BWTIndex:
    def __init__(self, sequence: str, suffix_array_samples: int = 32):
        self.original_sequence = sequence
        self.suffix_array_samples = suffix_array_samples
        self.bwt, self.sa = self._build_bwt(sequence)
        self.c_table = self._build_c_table()
        self.occurrence_table = self._build_occurrence_table()
        self.sampled_sa = self._build_sampled_sa()

    def _build_bwt(self, sequence: str) -> Tuple[str, List[int]]:
        n = len(sequence)
        cyclic_rotations = [(sequence[i:] + sequence[:i], i) for i in range(n)]
        cyclic_rotations.sort(key=lambda x: x[0])
        sa = [r[1] for r in cyclic_rotations]
        bwt = ''.join([sequence[(r[1] - 1) % n] for r in cyclic_rotations])
        return bwt, sa

    def _build_c_table(self) -> Dict[str, int]:
        c_table = defaultdict(int)
        sorted_chars = sorted(set(self.bwt))
        count = 0
        for char in sorted_chars:
            c_table[char] = count
            count += self.bwt.count(char)
        return dict(c_table)

    def _build_occurrence_table(self) -> Dict[str, np.ndarray]:
        chars = set(self.bwt)
        n = len(self.bwt)
        occ_table = {}
        for char in chars:
            arr = np.zeros(n + 1, dtype=np.int32)
            count = 0
            for i in range(n):
                if self.bwt[i] == char:
                    count += 1
                arr[i + 1] = count
            occ_table[char] = arr
        return occ_table

    def _build_sampled_sa(self) -> Dict[int, int]:
        sampled = {}
        for i, pos in enumerate(self.sa):
            if pos % self.suffix_array_samples == 0:
                sampled[i] = pos
        return sampled

    def _get_occurrence(self, char: str, position: int) -> int:
        if char not in self.occurrence_table:
            return 0
        return self.occurrence_table[char][position]

    def _get_suffix_array_value(self, index: int) -> int:
        if index in self.sampled_sa:
            return self.sampled_sa[index]
        steps = 0
        current = index
        while current not in self.sampled_sa:
            char = self.bwt[current]
            current = self.c_table[char] + self._get_occurrence(char, current)
            steps += 1
        return (self.sampled_sa[current] + steps) % len(self.original_sequence)

    def find_pattern(self, pattern: str) -> List[int]:
        if not pattern:
            return []
        left = 0
        right = len(self.bwt) - 1
        for i in range(len(pattern) - 1, -1, -1):
            char = pattern[i]
            if char not in self.c_table:
                return []
            left = self.c_table[char] + self._get_occurrence(char, left)
            right = self.c_table[char] + self._get_occurrence(char, right + 1) - 1
            if left > right:
                return []
        positions = []
        for i in range(left, right + 1):
            pos = self._get_suffix_array_value(i)
            positions.append(pos)
        return sorted(positions)


class SequenceIndex:
    def __init__(self):
        self.indices: Dict[str, BWTIndex] = {}
        self.sequence_info: Dict[str, dict] = {}

    def add_sequence(self, seq_id: str, sequence: str, metadata: dict = None):
        self.indices[seq_id] = BWTIndex(sequence + '$')
        self.sequence_info[seq_id] = {
            'sequence': sequence,
            'length': len(sequence),
            'metadata': metadata or {}
        }

    def search_pattern(self, pattern: str, seq_id: str = None) -> List[dict]:
        results = []
        target_ids = [seq_id] if seq_id else list(self.indices.keys())
        for target_id in target_ids:
            if target_id in self.indices:
                positions = self.indices[target_id].find_pattern(pattern)
                if positions:
                    results.append({
                        'seq_id': target_id,
                        'positions': positions,
                        'pattern_length': len(pattern),
                        'sequence_length': self.sequence_info[target_id]['length']
                    })
        return results

    def get_sequence(self, seq_id: str) -> Optional[str]:
        if seq_id in self.sequence_info:
            return self.sequence_info[seq_id]['sequence']
        return None

    def get_all_seq_ids(self) -> List[str]:
        return list(self.indices.keys())
