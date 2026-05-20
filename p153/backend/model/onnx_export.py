import torch
import os
import sys
import numpy as np

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from model.transformer import TransformerTranslator
from model.tokenizer import SimpleTokenizer


class ONNXExporter:
    def __init__(self, model, tokenizer_ug, tokenizer_zh, device='cpu'):
        self.model = model
        self.tokenizer_ug = tokenizer_ug
        self.tokenizer_zh = tokenizer_zh
        self.device = device
        self.model.to(device)
        self.model.eval()
    
    def export_encoder(self, save_path='model/onnx/encoder.onnx', seq_len=64):
        src = torch.randint(0, len(self.tokenizer_ug), (1, seq_len)).to(self.device)
        src_padding_mask = torch.zeros(1, seq_len, dtype=torch.bool).to(self.device)
        
        class EncoderWrapper(torch.nn.Module):
            def __init__(self, model):
                super().__init__()
                self.model = model
            
            def forward(self, src, src_padding_mask):
                src = self.model.embedding_ug(src) * np.sqrt(self.model.d_model)
                src = self.model.pos_encoder(src)
                memory = self.model.transformer.encoder(src, src_key_padding_mask=src_padding_mask)
                return memory
        
        encoder = EncoderWrapper(self.model)
        
        torch.onnx.export(
            encoder,
            (src, src_padding_mask),
            save_path,
            export_params=True,
            opset_version=13,
            do_constant_folding=True,
            input_names=['src', 'src_padding_mask'],
            output_names=['memory'],
            dynamic_axes={
                'src': {0: 'batch_size', 1: 'seq_len'},
                'src_padding_mask': {0: 'batch_size', 1: 'seq_len'},
                'memory': {0: 'batch_size', 1: 'seq_len'}
            }
        )
        print(f'Encoder exported to {save_path}')
    
    def export_decoder(self, save_path='model/onnx/decoder.onnx', seq_len=64):
        memory = torch.randn(1, seq_len, 256).to(self.device)
        tgt = torch.randint(0, len(self.tokenizer_zh), (1, seq_len)).to(self.device)
        tgt_mask = self.model.generate_square_subsequent_mask(seq_len).to(self.device)
        
        class DecoderWrapper(torch.nn.Module):
            def __init__(self, model):
                super().__init__()
                self.model = model
            
            def forward(self, tgt, memory, tgt_mask):
                tgt = self.model.embedding_zh(tgt) * np.sqrt(self.model.d_model)
                tgt = self.model.pos_decoder(tgt)
                output = self.model.transformer.decoder(tgt, memory, tgt_mask=tgt_mask)
                output = self.model.fc(output)
                return output
        
        decoder = DecoderWrapper(self.model)
        
        torch.onnx.export(
            decoder,
            (tgt, memory, tgt_mask),
            save_path,
            export_params=True,
            opset_version=13,
            do_constant_folding=True,
            input_names=['tgt', 'memory', 'tgt_mask'],
            output_names=['output'],
            dynamic_axes={
                'tgt': {0: 'batch_size', 1: 'seq_len'},
                'memory': {0: 'batch_size', 1: 'seq_len'},
                'tgt_mask': {0: 'size', 1: 'size'},
                'output': {0: 'batch_size', 1: 'seq_len', 2: 'vocab_size'}
            }
        )
        print(f'Decoder exported to {save_path}')
    
    def export_full_model(self, save_path='model/onnx/full_model.onnx', seq_len=64):
        src = torch.randint(0, len(self.tokenizer_ug), (1, seq_len)).to(self.device)
        tgt = torch.randint(0, len(self.tokenizer_zh), (1, seq_len)).to(self.device)
        tgt_mask = self.model.generate_square_subsequent_mask(seq_len).to(self.device)
        src_padding_mask = torch.zeros(1, seq_len, dtype=torch.bool).to(self.device)
        tgt_padding_mask = torch.zeros(1, seq_len, dtype=torch.bool).to(self.device)
        
        torch.onnx.export(
            self.model,
            (src, tgt, None, tgt_mask, src_padding_mask, tgt_padding_mask, None),
            save_path,
            export_params=True,
            opset_version=13,
            do_constant_folding=True,
            input_names=['src', 'tgt', 'src_mask', 'tgt_mask', 'src_padding_mask', 'tgt_padding_mask', 'memory_key_padding_mask'],
            output_names=['output'],
            dynamic_axes={
                'src': {0: 'batch_size', 1: 'seq_len'},
                'tgt': {0: 'batch_size', 1: 'seq_len'},
                'src_mask': {0: 'size1', 1: 'size2'},
                'tgt_mask': {0: 'size1', 1: 'size2'},
                'src_padding_mask': {0: 'batch_size', 1: 'seq_len'},
                'tgt_padding_mask': {0: 'batch_size', 1: 'seq_len'},
                'memory_key_padding_mask': {0: 'batch_size', 1: 'seq_len'},
                'output': {0: 'batch_size', 1: 'seq_len', 2: 'vocab_size'}
            }
        )
        print(f'Full model exported to {save_path}')
    
    def quantize_dynamic(self, model_path, output_path):
        try:
            import onnxruntime
            from onnxruntime.quantization import quantize_dynamic, QuantType
            
            quantize_dynamic(
                model_input=model_path,
                model_output=output_path,
                weight_type=QuantType.QUInt8,
                optimize_model=True
            )
            print(f'Model quantized and saved to {output_path}')
        except ImportError:
            print("onnxruntime not installed. Skipping quantization.")
            import shutil
            shutil.copy(model_path, output_path)
    
    def export_all(self, save_dir='model/onnx', quantize=True):
        os.makedirs(save_dir, exist_ok=True)
        
        encoder_path = os.path.join(save_dir, 'encoder.onnx')
        decoder_path = os.path.join(save_dir, 'decoder.onnx')
        full_path = os.path.join(save_dir, 'full_model.onnx')
        
        self.export_encoder(encoder_path)
        self.export_decoder(decoder_path)
        self.export_full_model(full_path)
        
        if quantize:
            self.quantize_dynamic(encoder_path, os.path.join(save_dir, 'encoder_quantized.onnx'))
            self.quantize_dynamic(decoder_path, os.path.join(save_dir, 'decoder_quantized.onnx'))
            self.quantize_dynamic(full_path, os.path.join(save_dir, 'full_model_quantized.onnx'))


class ONNXRuntimeTranslator:
    def __init__(self, encoder_path, decoder_path, tokenizer_ug_path, tokenizer_zh_path, device='cpu'):
        import onnxruntime
        
        providers = ['CPUExecutionProvider'] if device == 'cpu' else ['CUDAExecutionProvider', 'CPUExecutionProvider']
        
        self.encoder_session = onnxruntime.InferenceSession(encoder_path, providers=providers)
        self.decoder_session = onnxruntime.InferenceSession(decoder_path, providers=providers)
        
        self.tokenizer_ug = SimpleTokenizer()
        self.tokenizer_zh = SimpleTokenizer()
        self.tokenizer_ug.load(tokenizer_ug_path)
        self.tokenizer_zh.load(tokenizer_zh_path)
        
        self.sos_idx = self.tokenizer_zh.special_tokens['<sos>']
        self.eos_idx = self.tokenizer_zh.special_tokens['<eos>']
        self.pad_idx = self.tokenizer_zh.special_tokens['<pad>']
    
    def generate_square_subsequent_mask(self, sz):
        mask = (np.triu(np.ones((sz, sz))) == 1).transpose()
        mask = mask.astype(np.float32)
        mask = np.where(mask == 0, -np.inf, 0.0)
        return mask
    
    def apply_repetition_penalty(self, logits, generated_tokens, penalty=1.2):
        if penalty == 1.0 or len(generated_tokens) == 0:
            return logits
        
        for token_id in set(generated_tokens):
            logits[token_id] /= penalty
        
        return logits
    
    def top_k_filtering(self, logits, top_k=50):
        if top_k <= 0:
            return logits
        
        indices_to_remove = logits < np.sort(logits)[-top_k]
        logits[indices_to_remove] = -np.inf
        return logits
    
    def softmax(self, x):
        exp_x = np.exp(x - np.max(x))
        return exp_x / exp_x.sum(axis=-1, keepdims=True)
    
    def translate(self, text, max_len=256, repetition_penalty=1.2, temperature=0.8, top_k=50):
        src_ids = self.tokenizer_ug.encode(text, max_length=max_len)
        src = np.array([src_ids], dtype=np.int64)
        src_padding_mask = (src == self.pad_idx).astype(np.bool_)
        
        ort_inputs = {
            self.encoder_session.get_inputs()[0].name: src,
            self.encoder_session.get_inputs()[1].name: src_padding_mask
        }
        memory = self.encoder_session.run(None, ort_inputs)[0]
        
        tgt_ids = [self.sos_idx]
        
        for _ in range(max_len):
            tgt = np.array([tgt_ids], dtype=np.int64)
            tgt_mask = self.generate_square_subsequent_mask(len(tgt_ids)).astype(np.float32)
            
            ort_inputs = {
                self.decoder_session.get_inputs()[0].name: tgt,
                self.decoder_session.get_inputs()[1].name: memory,
                self.decoder_session.get_inputs()[2].name: tgt_mask
            }
            
            output = self.decoder_session.run(None, ort_inputs)[0]
            logits = output[0, -1, :] / temperature
            
            logits = self.apply_repetition_penalty(logits, tgt_ids, repetition_penalty)
            logits = self.top_k_filtering(logits, top_k)
            
            probs = self.softmax(logits)
            next_token = int(np.random.choice(len(probs), p=probs))
            
            tgt_ids.append(next_token)
            
            if next_token == self.eos_idx:
                break
        
        return self.tokenizer_zh.decode(tgt_ids)


if __name__ == '__main__':
    from model.train import load_sample_data, build_tokenizers
    
    data = load_sample_data()
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
    
    exporter = ONNXExporter(model, tokenizer_ug, tokenizer_zh)
    exporter.export_all(save_dir='model/onnx', quantize=False)
