#!/usr/bin/env python3
"""Test script for IUPAC degenerate base matching"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / "backend"))

from aligner.aligner import hamming_distance, base_match, IUPAC_CODES, check_pam

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
        ("ARAAAAAAAAAAAAAAAAA", "AAAAAAAAAAAAAAAAAAAA", 0, []),
        ("ARAAAAAAAAAAAAAAAAA", "AGAAAAAAAAAAAAAAAAAA", 0, []),
        ("ARAAAAAAAAAAAAAAAAA", "ATAAAAAAAAAAAAAAAAAA", 1, [1]),
        ("NNNNNNNNNNNNNNNNNNNN", "AAAAAAAAAAAAAAAAAAAA", 0, []),
        ("RYNNNNNNNNNNNNNNNNNN", "AGTCAAAAAAAAAAAAAAAA", 2, [2, 3]),
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
        ("YGG", False),
        ("NAG", True),
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
    
    print("\n" + "=" * 60)
    total_passed = passed + passed_hd + passed_pam
    total_failed = failed + failed_hd + failed_pam
    print(f"FINAL RESULTS: {total_passed} total passed, {total_failed} total failed")
    print("=" * 60)
    
    return total_failed == 0

if __name__ == "__main__":
    success = test_iupac_matching()
    sys.exit(0 if success else 1)
