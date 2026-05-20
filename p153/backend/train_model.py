#!/usr/bin/env python3
import os
import sys
import torch
import random

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from model.transformer import TransformerTranslator
from model.tokenizer import SimpleTokenizer, build_tokenizers
from model.back_translation import SimpleDataAugmenter, augment_dataset

def main():
    sample_data = [
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

    print("原始数据量:", len(sample_data))
    
    augmenter = SimpleDataAugmenter()
    augmented_data = augment_dataset(sample_data, augmenter, num_augments=2)
    
    print("增强后数据量:", len(augmented_data))
    
    random.shuffle(augmented_data)
    
    split = int(0.9 * len(augmented_data))
    train_data = augmented_data[:split]
    val_data = augmented_data[split:]
    
    print(f"训练集: {len(train_data)}, 验证集: {len(val_data)}")
    
    os.makedirs('model/checkpoints', exist_ok=True)
    tokenizer_ug, tokenizer_zh = build_tokenizers(augmented_data, save_dir='model/checkpoints')
    
    print(f"维吾尔语词汇表大小: {len(tokenizer_ug)}")
    print(f"汉语词汇表大小: {len(tokenizer_zh)}")
    
    model = TransformerTranslator(
        vocab_size_ug=len(tokenizer_ug),
        vocab_size_zh=len(tokenizer_zh),
        d_model=256,
        nhead=4,
        num_encoder_layers=3,
        num_decoder_layers=3,
        dim_feedforward=512,
        dropout=0.1
    )
    
    from model.train import Trainer
    trainer = Trainer(model, tokenizer_ug, tokenizer_zh)
    trainer.train(train_data, val_data, epochs=20, batch_size=8, lr=0.0001)
    
    print("\n测试翻译:")
    test_texts = ["سالام", "رەھمەت", "مەكتەپ", "دوست"]
    for text in test_texts:
        result = trainer.translate(text)
        print(f'  {text} -> {result}')
    
    print("\n模型训练完成！")
    print("模型已保存到: model/checkpoints/best_model.pth")

if __name__ == '__main__':
    main()
