#!/usr/bin/env python3

from app.algorithms.bwt_index import BWTIndex, SequenceIndex
from app.algorithms.blast import BLASTAlignment
from app.algorithms.fasta_parser import parse_fasta, validate_dna, guess_sequence_type

def test_bwt_index():
    print("Testing BWT Index...")
    
    sequence = "ATCGATCGATCGTAGCTAGCTAGCTAGCTAGCTA"
    index = BWTIndex(sequence + "$")
    
    pattern = "ATCG"
    positions = index.find_pattern(pattern)
    
    print(f"  Sequence: {sequence}")
    print(f"  Pattern: {pattern}")
    print(f"  Found at positions: {positions}")
    
    assert len(positions) > 0, "BWT search failed"
    print("  ✅ BWT Index test passed")

def test_sequence_index():
    print("\nTesting Sequence Index...")
    
    seq_index = SequenceIndex()
    seq_index.add_sequence("seq1", "ATCGATCGATCG")
    seq_index.add_sequence("seq2", "TAGCTAGCTAGC")
    
    results = seq_index.search_pattern("ATCG")
    
    print(f"  Found {len(results)} sequences with pattern")
    for r in results:
        print(f"    - {r['seq_id']}: {len(r['positions'])} matches")
    
    print("  ✅ Sequence Index test passed")

def test_fasta_parser():
    print("\nTesting FASTA Parser...")
    
    fasta_content = """>seq1 Homo sapiens gene A
ATCGATCGATCGATCGATCG
>seq2 Mus musculus gene B
TAGCTAGCTAGCTAGCTA"""
    
    sequences = parse_fasta(fasta_content)
    print(f"  Parsed {len(sequences)} sequences")
    
    for seq in sequences:
        print(f"    - {seq['header'][:30]}...: {len(seq['sequence'])} bp")
        assert validate_dna(seq['sequence']), f"Invalid DNA: {seq['header']}"
        assert guess_sequence_type(seq['sequence']) == 'DNA', "Wrong sequence type"
    
    print("  ✅ FASTA Parser test passed")

def test_blast_alignment():
    print("\nTesting BLAST Alignment...")
    
    seq_index = SequenceIndex()
    seq_index.add_sequence("ref1", "ATCGATCGATCGATCGATCGATCGATCGATCG")
    seq_index.add_sequence("ref2", "TAGCTAGCTAGCTAGCTAGCTAGCTAGCTA")
    
    blast = BLASTAlignment(seq_index, seq_type='DNA')
    
    query = "ATCGATCG"
    results = blast.align_sequence(query, evalue_threshold=1000.0)
    
    print(f"  Query: {query}")
    print(f"  Found {len(results)} alignments")
    
    for hit in results:
        print(f"    - Hit {hit['seq_id']}: score={hit['score']:.1f}, identity={hit['identity']*100:.1f}%")
    
    print("  ✅ BLAST Alignment test passed")

def main():
    print("=" * 50)
    print("🧬 Gene Sequence Alignment System - Algorithm Tests")
    print("=" * 50)
    
    try:
        test_bwt_index()
        test_sequence_index()
        test_fasta_parser()
        test_blast_alignment()
        
        print("\n" + "=" * 50)
        print("✅ All algorithm tests passed!")
        print("=" * 50)
        return 0
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    exit(main())
