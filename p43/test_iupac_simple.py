#!/usr/bin/env python3
"""Test script for IUPAC degenerate base matching - standalone version"""

IUPAC_CODES = {
    'A': {'A'},
    'T': {'T'},
    'G': {'G'},
    'C': {'C'},
    'R': {'A', 'G'},
    'Y': {'C', 'T'},
    'S': {'G', 'C'},
    'W': {'A', 'T'},
    'K': {'G', 'T'},
    'M': {'A', 'C'},
    'B': {'C', 'G', 'T'},
    'D': {'A', 'G', 'T'},
    'H': {'A', 'C', 'T'},
    'V': {'A', 'C', 'G'},
    'N': {'A', 'T', 'G', 'C'}
}

PAM_SEQUENCE = 'NGG'

def base_match(base1: str, base2: str) -> bool:
    b1 = base1.upper()
    b2 = base2.upper()
    
    set1 = IUPAC_CODES.get(b1, {b1})
    set2 = IUPAC_CODES.get(b2, {b2})
    
    return len(set1 & set2) > 0

def hamming_distance(s1: str, s2: str):
    if len(s1) != len(s2):
        raise ValueError("Sequences must have the same length")
    mismatches = []
    distance = 0
    for i, (a, b) in enumerate(zip(s1.upper(), s2.upper())):
        if not base_match(a, b):
            distance += 1
            mismatches.append(i)
    return distance, mismatches

def check_pam(pam_sequence: str) -> bool:
    for i, pam_base in enumerate(PAM_SEQUENCE.upper()):
        if i >= len(pam_sequence):
            return False
        seq_base = pam_sequence[i].upper()
        if not base_match(pam_base, seq_base):
            return False
    return True

def test_iupac_matching():
    print("=" * 60)
    print("Testing IUPAC Degenerate Base Matching")
    print("=" * 60)
    
    print("\n1. Testing single base matches:")
    print("-" * 40)
    
    test_cases = [
        ('A', 'A', True),
        ('A', 'R', True),
        ('R', 'A', True),
        ('R', 'G', True),
        ('R', 'T', False),
        ('Y', 'C', True),
        ('Y', 'T', True),
        ('N', 'A', True),
        ('N', 'T', True),
        ('N', 'G', True),
        ('N', 'C', True),
        ('B', 'C', True),
        ('B', 'G', True),
        ('B', 'T', True),
        ('B', 'A', False),
        ('V', 'A', True),
        ('V', 'C', True),
        ('V', 'G', True),
        ('V', 'T', False),
    ]
    
    passed = 0
    failed = 0
    
    for b1, b2, expected in test_cases:
        result = base_match(b1, b2)
        status = "✓ PASS" if result == expected else "✗ FAIL"
        if result == expected:
            passed += 1
        else:
            failed += 1
        print(f"  {b1} vs {b2}: {result} (expected: {expected}) - {status}")
    
    print(f"\n  Results: {passed} passed, {failed} failed")
    
    print("\n2. Testing Hamming distance with IUPAC codes:")
    print("-" * 40)
    
    grna_tests = [
        ("AAAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA", 0, []),
        ("ARAAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA", 0, []),
        ("ARAAAAAAAAAAAAAAAAAA", "AGAAAAAAAAAAAAAAAAAA", 0, []),
        ("ARAAAAAAAAAAAAAAAAAA", "ATAAAAAAAAAAAAAAAAAA", 1, [1]),
        ("NNNNNNNNNNNNNNNNNNNN", "AAAAAAAAAAAAAAAAAAAA", 0, []),
        ("RYNNNNNNNNNNNNNNNNNN", "AGNNNNNNNNNNNNNNNNNN", 1, [1]),
    ]
    
    passed_hd = 0
    failed_hd = 0
    
    for s1, s2, exp_dist, exp_mismatches in grna_tests:
        dist, mismatches = hamming_distance(s1, s2)
        correct_dist = (dist == exp_dist)
        correct_mm = (mismatches == exp_mismatches)
        status = "✓ PASS" if correct_dist and correct_mm else "✗ FAIL"
        if correct_dist and correct_mm:
            passed_hd += 1
        else:
            failed_hd += 1
        print(f"  {s1[:8]}... vs {s2[:8]}...: dist={dist}, mismatches={mismatches} - {status}")
    
    print(f"\n  Results: {passed_hd} passed, {failed_hd} failed")
    
    print("\n3. Testing PAM validation with IUPAC codes:")
    print("-" * 40)
    
    pam_tests = [
        ("AGG", True),
        ("NGG", True),
        ("RGG", True),
        ("YGG", True),
        ("NAG", False),
        ("NNN", True),
        ("RYY", False),
    ]
    
    passed_pam = 0
    failed_pam = 0
    
    for pam_seq, expected in pam_tests:
        result = check_pam(pam_seq)
        status = "✓ PASS" if result == expected else "✗ FAIL"
        if result == expected:
            passed_pam += 1
        else:
            failed_pam += 1
        print(f"  PAM '{pam_seq}': matches? {result} (expected: {expected}) - {status}")
    
    print(f"\n  Results: {passed_pam} passed, {failed_pam} failed")
    
    print("\n4. IUPAC Code Reference:")
    print("-" * 40)
    for code, bases in sorted(IUPAC_CODES.items()):
        print(f"  {code}: {sorted(list(bases))}")
    
    print("\n" + "=" * 60)
    total_passed = passed + passed_hd + passed_pam
    total_failed = failed + failed_hd + failed_pam
    print(f"FINAL RESULTS: {total_passed} total passed, {total_failed} total failed")
    print("=" * 60)
    
    return total_failed == 0

if __name__ == "__main__":
    success = test_iupac_matching()
    exit(0 if success else 1)
