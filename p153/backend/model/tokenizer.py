import re
from collections import Counter
import pickle
import os


class SimpleTokenizer:
    def __init__(self, vocab_size=50000):
        self.vocab_size = vocab_size
        self.word2idx = {}
        self.idx2word = {}
        self.special_tokens = {
            '<pad>': 0,
            '<sos>': 1,
            '<eos>': 2,
            '<unk>': 3
        }
    
    def train(self, texts):
        words = []
        for text in texts:
            words.extend(self._tokenize(text))
        
        word_counts = Counter(words)
        most_common = word_counts.most_common(self.vocab_size - len(self.special_tokens))
        
        self.word2idx = self.special_tokens.copy()
        idx = len(self.special_tokens)
        for word, _ in most_common:
            self.word2idx[word] = idx
            idx += 1
        
        self.idx2word = {v: k for k, v in self.word2idx.items()}
    
    def _tokenize(self, text):
        text = text.lower()
        text = re.sub(r'\s+', ' ', text)
        chars = list(text)
        return chars
    
    def encode(self, text, max_length=None, truncation=False):
        tokens = self._tokenize(text)
        ids = [self.word2idx.get(token, self.special_tokens['<unk>']) for token in tokens]
        ids = [self.special_tokens['<sos>']] + ids + [self.special_tokens['<eos>']]
        
        if max_length and len(ids) > max_length:
            if truncation:
                ids = ids[:max_length-1] + [self.special_tokens['<eos>']]
        
        return ids
    
    def decode(self, ids):
        tokens = []
        for id_ in ids:
            if id_ in [self.special_tokens['<pad>'], self.special_tokens['<sos>'], self.special_tokens['<eos>']]:
                continue
            if id_ in self.idx2word:
                tokens.append(self.idx2word[id_])
        return ''.join(tokens)
    
    def save(self, path):
        with open(path, 'wb') as f:
            pickle.dump({
                'word2idx': self.word2idx,
                'idx2word': self.idx2word,
                'vocab_size': self.vocab_size,
                'special_tokens': self.special_tokens
            }, f)
    
    def load(self, path):
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.word2idx = data['word2idx']
            self.idx2word = data['idx2word']
            self.vocab_size = data['vocab_size']
            self.special_tokens = data['special_tokens']
    
    def __len__(self):
        return len(self.word2idx)


def build_tokenizers(data_pairs, save_dir='model/checkpoints'):
    os.makedirs(save_dir, exist_ok=True)
    
    ug_texts = [pair[0] for pair in data_pairs]
    zh_texts = [pair[1] for pair in data_pairs]
    
    tokenizer_ug = SimpleTokenizer(vocab_size=10000)
    tokenizer_zh = SimpleTokenizer(vocab_size=10000)
    
    tokenizer_ug.train(ug_texts)
    tokenizer_zh.train(zh_texts)
    
    tokenizer_ug.save(os.path.join(save_dir, 'tokenizer_ug.pkl'))
    tokenizer_zh.save(os.path.join(save_dir, 'tokenizer_zh.pkl'))
    
    return tokenizer_ug, tokenizer_zh
