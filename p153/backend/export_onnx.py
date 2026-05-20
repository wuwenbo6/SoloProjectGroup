#!/usr/bin/env python3
import os
import sys
import torch

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from model.transformer import TransformerTranslator
from model.tokenizer import SimpleTokenizer
from model.onnx_export import ONNXExporter

def main():
    tokenizer_ug = SimpleTokenizer()
    tokenizer_zh = SimpleTokenizer()
    
    checkpoint_path = 'model/checkpoints/best_model.pth'
    tokenizer_ug_path = 'model/checkpoints/tokenizer_ug.pkl'
    tokenizer_zh_path = 'model/checkpoints/tokenizer_zh.pkl'
    
    if os.path.exists(tokenizer_ug_path):
        tokenizer_ug.load(tokenizer_ug_path)
    else:
        print("警告: 未找到维吾尔语分词器，使用默认大小")
    
    if os.path.exists(tokenizer_zh_path):
        tokenizer_zh.load(tokenizer_zh_path)
    else:
        print("警告: 未找到汉语分词器，使用默认大小")
    
    vocab_size_ug = len(tokenizer_ug) if len(tokenizer_ug) > 0 else 500
    vocab_size_zh = len(tokenizer_zh) if len(tokenizer_zh) > 0 else 500
    
    model = TransformerTranslator(
        vocab_size_ug=vocab_size_ug,
        vocab_size_zh=vocab_size_zh,
        d_model=256,
        nhead=4,
        num_encoder_layers=3,
        num_decoder_layers=3,
        dim_feedforward=512
    )
    
    if os.path.exists(checkpoint_path):
        checkpoint = torch.load(checkpoint_path, map_location='cpu')
        model.load_state_dict(checkpoint['model_state_dict'])
        print("成功加载模型权重")
    else:
        print("警告: 未找到模型权重文件，使用随机权重")
    
    model.eval()
    
    os.makedirs('model/onnx', exist_ok=True)
    
    exporter = ONNXExporter(model, tokenizer_ug, tokenizer_zh)
    exporter.export_all(save_dir='model/onnx', quantize=False)
    
    print("\nONNX 模型导出完成！")
    print("模型已保存到: model/onnx/")

if __name__ == '__main__':
    main()
