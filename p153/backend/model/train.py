import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
import os
import sys
import random

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.transformer import TransformerTranslator, TranslationDataset, collate_fn
from model.tokenizer import SimpleTokenizer, build_tokenizers


class Trainer:
    def __init__(self, model, tokenizer_ug, tokenizer_zh, device='cuda' if torch.cuda.is_available() else 'cpu'):
        self.model = model
        self.tokenizer_ug = tokenizer_ug
        self.tokenizer_zh = tokenizer_zh
        self.device = device
        self.model.to(device)
    
    def train_epoch(self, dataloader, optimizer, criterion):
        self.model.train()
        total_loss = 0
        
        for batch in dataloader:
            src = batch['ug_ids'].to(self.device)
            tgt = batch['zh_ids'].to(self.device)
            src_padding_mask = batch['src_padding_mask'].to(self.device)
            tgt_padding_mask = batch['tgt_padding_mask'].to(self.device)
            
            tgt_input = tgt[:, :-1]
            tgt_output = tgt[:, 1:]
            
            tgt_mask = self.model.generate_square_subsequent_mask(tgt_input.size(1)).to(self.device)
            
            optimizer.zero_grad()
            
            output = self.model(
                src, tgt_input,
                tgt_mask=tgt_mask,
                src_padding_mask=src_padding_mask,
                tgt_padding_mask=tgt_padding_mask[:, :-1]
            )
            
            loss = criterion(output.reshape(-1, output.size(-1)), tgt_output.reshape(-1))
            loss.backward()
            
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            optimizer.step()
            
            total_loss += loss.item()
        
        return total_loss / len(dataloader)
    
    def train(self, train_data, val_data, epochs=30, batch_size=32, lr=0.0001, save_dir='model/checkpoints'):
        os.makedirs(save_dir, exist_ok=True)
        
        train_dataset = TranslationDataset(train_data, self.tokenizer_ug, self.tokenizer_zh)
        val_dataset = TranslationDataset(val_data, self.tokenizer_ug, self.tokenizer_zh)
        
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, collate_fn=collate_fn)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, collate_fn=collate_fn)
        
        criterion = nn.CrossEntropyLoss(ignore_index=self.tokenizer_zh.special_tokens['<pad>'])
        optimizer = optim.Adam(self.model.parameters(), lr=lr, betas=(0.9, 0.98), eps=1e-9)
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, factor=0.1, patience=3)
        
        best_val_loss = float('inf')
        
        for epoch in range(epochs):
            train_loss = self.train_epoch(train_loader, optimizer, criterion)
            val_loss = self.evaluate(val_loader, criterion)
            
            scheduler.step(val_loss)
            
            print(f'Epoch {epoch+1}/{epochs}, Train Loss: {train_loss:.4f}, Val Loss: {val_loss:.4f}')
            
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                torch.save({
                    'epoch': epoch,
                    'model_state_dict': self.model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'val_loss': val_loss,
                }, os.path.join(save_dir, 'best_model.pth'))
        
        torch.save({
            'epoch': epochs,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': optimizer.state_dict(),
            'val_loss': val_loss,
        }, os.path.join(save_dir, 'last_model.pth'))
    
    def evaluate(self, dataloader, criterion):
        self.model.eval()
        total_loss = 0
        
        with torch.no_grad():
            for batch in dataloader:
                src = batch['ug_ids'].to(self.device)
                tgt = batch['zh_ids'].to(self.device)
                src_padding_mask = batch['src_padding_mask'].to(self.device)
                tgt_padding_mask = batch['tgt_padding_mask'].to(self.device)
                
                tgt_input = tgt[:, :-1]
                tgt_output = tgt[:, 1:]
                
                tgt_mask = self.model.generate_square_subsequent_mask(tgt_input.size(1)).to(self.device)
                
                output = self.model(
                    src, tgt_input,
                    tgt_mask=tgt_mask,
                    src_padding_mask=src_padding_mask,
                    tgt_padding_mask=tgt_padding_mask[:, :-1]
                )
                
                loss = criterion(output.reshape(-1, output.size(-1)), tgt_output.reshape(-1))
                total_loss += loss.item()
        
        return total_loss / len(dataloader)
    
    def translate(self, text, max_len=256, repetition_penalty=1.2, temperature=0.8, top_k=50):
        self.model.eval()
        
        src_ids = self.tokenizer_ug.encode(text, max_length=max_len)
        src = torch.tensor([src_ids], dtype=torch.long).to(self.device)
        src_padding_mask = (src == self.tokenizer_ug.special_tokens['<pad>']).to(self.device)
        
        tgt_ids = [self.tokenizer_zh.special_tokens['<sos>']]
        
        with torch.no_grad():
            for i in range(max_len):
                tgt = torch.tensor([tgt_ids], dtype=torch.long).to(self.device)
                tgt_mask = self.model.generate_square_subsequent_mask(len(tgt_ids)).to(self.device)
                
                output = self.model(
                    src, tgt,
                    tgt_mask=tgt_mask,
                    src_padding_mask=src_padding_mask
                )
                
                logits = output[0, -1, :] / temperature
                
                logits = self.model.apply_repetition_penalty(logits, tgt_ids, repetition_penalty)
                
                if top_k > 0:
                    indices_to_remove = logits < torch.topk(logits, top_k)[0][..., -1, None]
                    logits[indices_to_remove] = float('-inf')
                
                probs = torch.softmax(logits, dim=-1)
                next_token = torch.multinomial(probs, 1).item()
                
                tgt_ids.append(next_token)
                
                if next_token == self.tokenizer_zh.special_tokens['<eos>']:
                    break
        
        return self.tokenizer_zh.decode(tgt_ids)


def load_sample_data():
    data = [
        ("سالام", "你好"),
        ("نېمىسىڭىز؟", "你好吗？"),
        ("رەھمەت", "谢谢"),
        ("خەيرلىك بولسۇن", "再见"),
        ("مەن ئۇيغۇر", "我是维吾尔族"),
        ("بۇ بىر كىتاب", "这是一本书"),
        ("سىزگە رەھمەت", "谢谢你"),
        ("ئەتە كەچ", "明天见"),
        ("تۆمۈر يولى", "铁路"),
        ("مەكتەپ", "学校"),
        ("ئوغۇل", "儿子"),
        ("قىز", "女儿"),
        ("ئانا", "妈妈"),
        ("ئاتا", "爸爸"),
        ("دوست", "朋友"),
        ("تۇغۇلغان كۈن", "生日"),
        ("يېمەك", "吃"),
        ("ئىچمەك", "喝"),
        ("كېتەك", "去"),
        ("كېلىمەن", "来"),
        ("ئوقۇمەن", "学习"),
        ("ئىشلىمەن", "工作"),
        ("خۇشال", "高兴"),
        ("غملى", "难过"),
        ("چوڭ", "大"),
        ("كىچىك", "小"),
        ("ياخشى", "好"),
        ("پاسىق", "坏"),
        ("ئۇزۇن", "长"),
        ("قىسقا", "短"),
    ]
    
    augmented_data = []
    for ug, zh in data:
        augmented_data.append((ug, zh))
        augmented_data.append((ug + "؟", zh + "？"))
        augmented_data.append((ug + "!", zh + "！"))
    
    return augmented_data


if __name__ == '__main__':
    data = load_sample_data()
    random.shuffle(data)
    
    split = int(0.9 * len(data))
    train_data = data[:split]
    val_data = data[split:]
    
    tokenizer_ug, tokenizer_zh = build_tokenizers(data, save_dir='model/checkpoints')
    
    model = TransformerTranslator(
        vocab_size_ug=len(tokenizer_ug),
        vocab_size_zh=len(tokenizer_zh),
        d_model=256,
        nhead=4,
        num_encoder_layers=3,
        num_decoder_layers=3,
        dim_feedforward=512
    )
    
    trainer = Trainer(model, tokenizer_ug, tokenizer_zh)
    trainer.train(train_data, val_data, epochs=10, batch_size=8, lr=0.0001)
    
    print("Translation test:")
    test_texts = ["سالام", "رەھمەت", "مەكتەپ"]
    for text in test_texts:
        result = trainer.translate(text)
        print(f'{text} -> {result}')
