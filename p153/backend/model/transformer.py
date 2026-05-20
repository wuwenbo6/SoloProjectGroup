import torch
import torch.nn as nn
import math
from torch.utils.data import Dataset, DataLoader


class RoPEPositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=10000, dropout=0.1, base=10000.0):
        super().__init__()
        self.d_model = d_model
        self.max_len = max_len
        self.dropout = nn.Dropout(p=dropout)
        self.base = base
        
        self.register_buffer("inv_freq", 
            torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(base) / d_model)))
        
    def _get_rotary_matrix(self, seq_len, device):
        t = torch.arange(seq_len, device=device).type_as(self.inv_freq)
        freqs = torch.einsum("i,j->ij", t, self.inv_freq)
        freqs_cos = freqs.cos()
        freqs_sin = freqs.sin()
        return freqs_cos, freqs_sin
    
    def _apply_rotary_pos_emb(self, x, freqs_cos, freqs_sin):
        x_reshaped = x.reshape(*x.shape[:-1], -1, 2)
        x1, x2 = x_reshaped.unbind(dim=-1)
        x_rotated = torch.stack((-x2, x1), dim=-1).flatten(-2)
        freqs_cos = freqs_cos.view(1, freqs_cos.shape[0], freqs_cos.shape[1])
        freqs_sin = freqs_sin.view(1, freqs_sin.shape[0], freqs_sin.shape[1])
        return x * freqs_cos + x_rotated * freqs_sin
    
    def forward(self, x):
        seq_len = x.size(1)
        freqs_cos, freqs_sin = self._get_rotary_matrix(seq_len, x.device)
        x = self._apply_rotary_pos_emb(x, freqs_cos, freqs_sin)
        return self.dropout(x)


class SinusoidalPositionalEncoding(nn.Module):
    def __init__(self, d_model, max_len=10000, dropout=0.1):
        super().__init__()
        self.dropout = nn.Dropout(p=dropout)
        self.d_model = d_model
        
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model))
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)
        self.register_buffer('pe', pe)
    
    def forward(self, x):
        seq_len = x.size(1)
        if seq_len > self.pe.size(1):
            self._extend_pe(seq_len, x.device)
        x = x + self.pe[:, :seq_len]
        return self.dropout(x)
    
    def _extend_pe(self, new_len, device):
        old_pe = self.pe.to(device)
        old_len = old_pe.size(1)
        
        pe = torch.zeros(1, new_len, self.d_model, device=device)
        pe[:, :old_len] = old_pe
        
        position = torch.arange(old_len, new_len, dtype=torch.float, device=device).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, self.d_model, 2, device=device).float() * (-math.log(10000.0) / self.d_model))
        pe[:, old_len:, 0::2] = torch.sin(position * div_term)
        pe[:, old_len:, 1::2] = torch.cos(position * div_term)
        
        self.pe = pe


class TransformerTranslator(nn.Module):
    def __init__(self, vocab_size_ug, vocab_size_zh, d_model=512, nhead=8, 
                 num_encoder_layers=6, num_decoder_layers=6, dim_feedforward=2048, dropout=0.1,
                 use_rope=True):
        super().__init__()
        self.d_model = d_model
        self.vocab_size_ug = vocab_size_ug
        self.vocab_size_zh = vocab_size_zh
        self.use_rope = use_rope
        
        self.embedding_ug = nn.Embedding(vocab_size_ug, d_model)
        self.embedding_zh = nn.Embedding(vocab_size_zh, d_model)
        
        if use_rope:
            self.pos_encoder = RoPEPositionalEncoding(d_model, dropout=dropout)
            self.pos_decoder = RoPEPositionalEncoding(d_model, dropout=dropout)
        else:
            self.pos_encoder = SinusoidalPositionalEncoding(d_model, dropout=dropout)
            self.pos_decoder = SinusoidalPositionalEncoding(d_model, dropout=dropout)
        
        self.transformer = nn.Transformer(
            d_model=d_model,
            nhead=nhead,
            num_encoder_layers=num_encoder_layers,
            num_decoder_layers=num_decoder_layers,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            batch_first=True
        )
        
        self.fc = nn.Linear(d_model, vocab_size_zh)
        self._init_weights()
    
    def _init_weights(self):
        initrange = 0.1
        self.embedding_ug.weight.data.uniform_(-initrange, initrange)
        self.embedding_zh.weight.data.uniform_(-initrange, initrange)
        self.fc.bias.data.zero_()
        self.fc.weight.data.uniform_(-initrange, initrange)
    
    def forward(self, src, tgt, src_mask=None, tgt_mask=None, 
                src_padding_mask=None, tgt_padding_mask=None, memory_key_padding_mask=None):
        src = self.embedding_ug(src) * math.sqrt(self.d_model)
        src = self.pos_encoder(src)
        
        tgt = self.embedding_zh(tgt) * math.sqrt(self.d_model)
        tgt = self.pos_decoder(tgt)
        
        output = self.transformer(
            src, tgt,
            src_mask=src_mask,
            tgt_mask=tgt_mask,
            src_key_padding_mask=src_padding_mask,
            tgt_key_padding_mask=tgt_padding_mask,
            memory_key_padding_mask=memory_key_padding_mask
        )
        
        return self.fc(output)
    
    def generate_square_subsequent_mask(self, sz):
        return self.transformer.generate_square_subsequent_mask(sz)
    
    def apply_repetition_penalty(self, logits, generated_tokens, penalty=1.2):
        if penalty == 1.0 or len(generated_tokens) == 0:
            return logits
        
        for token_id in set(generated_tokens):
            if logits.dim() == 2:
                logits[:, token_id] /= penalty
            else:
                logits[token_id] /= penalty
        
        return logits
    
    def apply_length_penalty(self, scores, current_len, alpha=0.6):
        return scores / ((5 + current_len) ** alpha / (5 + 1) ** alpha)


class TranslationDataset(Dataset):
    def __init__(self, data, tokenizer_ug, tokenizer_zh, max_len=128):
        self.data = data
        self.tokenizer_ug = tokenizer_ug
        self.tokenizer_zh = tokenizer_zh
        self.max_len = max_len
    
    def __len__(self):
        return len(self.data)
    
    def __getitem__(self, idx):
        ug_text, zh_text = self.data[idx]
        
        ug_encoded = self.tokenizer_ug.encode(ug_text, max_length=self.max_len, truncation=True)
        zh_encoded = self.tokenizer_zh.encode(zh_text, max_length=self.max_len, truncation=True)
        
        return {
            'ug_ids': torch.tensor(ug_encoded, dtype=torch.long),
            'zh_ids': torch.tensor(zh_encoded, dtype=torch.long)
        }


def collate_fn(batch, pad_idx=0):
    ug_ids = [item['ug_ids'] for item in batch]
    zh_ids = [item['zh_ids'] for item in batch]
    
    ug_ids = nn.utils.rnn.pad_sequence(ug_ids, batch_first=True, padding_value=pad_idx)
    zh_ids = nn.utils.rnn.pad_sequence(zh_ids, batch_first=True, padding_value=pad_idx)
    
    return {
        'ug_ids': ug_ids,
        'zh_ids': zh_ids,
        'src_padding_mask': (ug_ids == pad_idx),
        'tgt_padding_mask': (zh_ids == pad_idx)
    }
