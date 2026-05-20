import random
import torch
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.transformer import TransformerTranslator
from model.tokenizer import SimpleTokenizer


class BackTranslator:
    def __init__(self, forward_model, backward_model, tokenizer_ug, tokenizer_zh, device='cpu'):
        self.forward_model = forward_model
        self.backward_model = backward_model
        self.tokenizer_ug = tokenizer_ug
        self.tokenizer_zh = tokenizer_zh
        self.device = device
        
        self.forward_model.to(device)
        self.backward_model.to(device)
        self.forward_model.eval()
        self.backward_model.eval()
    
    def translate_ug_to_zh(self, text, max_len=128):
        src_ids = self.tokenizer_ug.encode(text, max_length=max_len)
        src = torch.tensor([src_ids], dtype=torch.long).to(self.device)
        src_padding_mask = (src == self.tokenizer_ug.special_tokens['<pad>']).to(self.device)
        
        tgt_ids = [self.tokenizer_zh.special_tokens['<sos>']]
        
        with torch.no_grad():
            for _ in range(max_len):
                tgt = torch.tensor([tgt_ids], dtype=torch.long).to(self.device)
                tgt_mask = self.forward_model.generate_square_subsequent_mask(len(tgt_ids)).to(self.device)
                
                output = self.forward_model(
                    src, tgt,
                    tgt_mask=tgt_mask,
                    src_padding_mask=src_padding_mask
                )
                
                next_token = output[0, -1, :].argmax().item()
                tgt_ids.append(next_token)
                
                if next_token == self.tokenizer_zh.special_tokens['<eos>']:
                    break
        
        return self.tokenizer_zh.decode(tgt_ids)
    
    def translate_zh_to_ug(self, text, max_len=128):
        src_ids = self.tokenizer_zh.encode(text, max_length=max_len)
        src = torch.tensor([src_ids], dtype=torch.long).to(self.device)
        src_padding_mask = (src == self.tokenizer_zh.special_tokens['<pad>']).to(self.device)
        
        tgt_ids = [self.tokenizer_ug.special_tokens['<sos>']]
        
        with torch.no_grad():
            for _ in range(max_len):
                tgt = torch.tensor([tgt_ids], dtype=torch.long).to(self.device)
                tgt_mask = self.backward_model.generate_square_subsequent_mask(len(tgt_ids)).to(self.device)
                
                output = self.backward_model(
                    src, tgt,
                    tgt_mask=tgt_mask,
                    src_padding_mask=src_padding_mask
                )
                
                next_token = output[0, -1, :].argmax().item()
                tgt_ids.append(next_token)
                
                if next_token == self.tokenizer_ug.special_tokens['<eos>']:
                    break
        
        return self.tokenizer_ug.decode(tgt_ids)
    
    def augment(self, ug_text, zh_text, num_augments=2):
        augmented_pairs = [(ug_text, zh_text)]
        
        for _ in range(num_augments):
            zh_generated = self.translate_ug_to_zh(ug_text)
            ug_back = self.translate_zh_to_ug(zh_generated)
            if ug_back and zh_generated:
                augmented_pairs.append((ug_back, zh_generated))
            
            ug_generated = self.translate_zh_to_ug(zh_text)
            zh_back = self.translate_ug_to_zh(ug_generated)
            if ug_generated and zh_back:
                augmented_pairs.append((ug_generated, zh_back))
        
        augmented_pairs = list(set(augmented_pairs))
        return augmented_pairs


class SimpleDataAugmenter:
    def __init__(self):
        self.ug_chars = [
            'ا', 'ب', 'پ', 'ت', 'ث', 'ج', 'چ', 'ح', 'خ', 'د',
            'ذ', 'ر', 'ز', 'ژ', 'س', 'ش', 'ص', 'ض', 'ط', 'ظ',
            'ع', 'غ', 'ف', 'ق', 'ك', 'گ', 'ل', 'م', 'ن', 'و',
            'ھ', 'ۈ', 'ۇ', 'ۆ', 'ې', 'ى', 'ي', 'ئ', '؟', '!',
            '.', ',', '،', '؛', ':', '«', '»', ' ', '\n'
        ]
        
        self.zh_chars = [
            '的', '一', '是', '在', '不', '了', '有', '和', '人', '这',
            '中', '大', '为', '上', '个', '我', '以', '要', '他', '时',
            '来', '用', '们', '生', '到', '作', '地', '于', '出', '就',
            '分', '对', '成', '会', '可', '主', '发', '年', '动', '同',
            '工', '也', '能', '下', '过', '子', '说', '产', '种', '面',
            '而', '后', '多', '定', '行', '学', '法', '所', '民', '得',
            '经', '十', '三', '之', '进', '着', '等', '部', '度', '家',
            '电', '力', '里', '如', '水', '化', '高', '自', '二', '理',
            '起', '小', '物', '现', '实', '加', '量', '都', '两', '体',
            '制', '机', '当', '使', '点', '从', '业', '本', '去', '把',
            '性', '好', '应', '开', '它', '合', '还', '因', '由', '其',
            '？', '！', '。', '，', '、', '；', '：', '“', '”', ' ', '\n'
        ]
    
    def random_delete(self, text, prob=0.1):
        chars = list(text)
        chars = [c for c in chars if random.random() > prob]
        return ''.join(chars)
    
    def random_insert(self, text, char_set, prob=0.05):
        chars = list(text)
        new_chars = []
        for c in chars:
            new_chars.append(c)
            if random.random() < prob:
                new_chars.append(random.choice(char_set))
        return ''.join(new_chars)
    
    def random_swap(self, text, prob=0.05):
        chars = list(text)
        for i in range(len(chars) - 1):
            if random.random() < prob:
                chars[i], chars[i + 1] = chars[i + 1], chars[i]
        return ''.join(chars)
    
    def augment(self, ug_text, zh_text, num_augments=3):
        augmented = [(ug_text, zh_text)]
        
        for _ in range(num_augments):
            aug_ug = ug_text
            aug_zh = zh_text
            
            if random.random() < 0.3:
                aug_ug = self.random_delete(aug_ug, prob=0.05)
                aug_zh = self.random_delete(aug_zh, prob=0.05)
            
            if random.random() < 0.3:
                aug_ug = self.random_insert(aug_ug, self.ug_chars, prob=0.03)
                aug_zh = self.random_insert(aug_zh, self.zh_chars, prob=0.03)
            
            if random.random() < 0.3:
                aug_ug = self.random_swap(aug_ug, prob=0.03)
                aug_zh = self.random_swap(aug_zh, prob=0.03)
            
            if aug_ug and aug_zh:
                augmented.append((aug_ug, aug_zh))
        
        augmented = list(set(augmented))
        return augmented


def augment_dataset(data_pairs, augmenter, num_augments=2):
    augmented_data = []
    for ug, zh in data_pairs:
        aug_pairs = augmenter.augment(ug, zh, num_augments)
        augmented_data.extend(aug_pairs)
    return augmented_data


if __name__ == '__main__':
    sample_data = [
        ("سالام", "你好"),
        ("رەھمەت", "谢谢"),
        ("خەيرلىك بولسۇن", "再见"),
    ]
    
    augmenter = SimpleDataAugmenter()
    augmented = augment_dataset(sample_data, augmenter, num_augments=2)
    
    print(f"Original: {len(sample_data)} pairs")
    print(f"Augmented: {len(augmented)} pairs")
    print("\nExamples:")
    for i, (ug, zh) in enumerate(augmented[:6]):
        print(f"{i+1}. {ug} -> {zh}")
