from flask import Flask, request, jsonify
import re
import json
from collections import defaultdict
import os

app = Flask(__name__)

VARIANT_CHARS = {
    '無': '无', '萬': '万', '禮': '礼', '體': '体', '漢': '汉',
    '學': '学', '發': '发', '國': '国', '會': '会', '來': '来',
    '後': '后', '裏': '里', '云': '云', '說': '说', '謂': '谓',
    '爲': '为', '與': '与', '從': '从', '見': '见', '問': '问',
    '聞': '闻', '對': '对', '將': '将', '時': '时', '於': '于',
    '為': '为', '無': '无', '萬': '万', '與': '与', '從': '从',
    '愛': '爱', '慶': '庆', '親': '亲', '產': '产', '殺': '杀',
    '長': '长', '門': '门', '間': '间', '東': '东', '車': '车',
    '馬': '马', '風': '风', '書': '书', '畫': '画', '畫': '划',
    '盡': '尽', '盡': '尽', '燈': '灯', '電': '电', '雲': '云',
    '個': '个', '倫': '伦', '倉': '仓', '們': '们', '億': '亿',
    '仁': '仁', '義': '义', '禮': '礼', '智': '智', '信': '信'
}

class VariantCharRecognizer:
    def __init__(self):
        self.variant_map = VARIANT_CHARS
        self.reverse_map = defaultdict(list)
        for variant, standard in self.variant_map.items():
            self.reverse_map[standard].append(variant)
        
        self.confidence_scores = {
            v: 0.95 if v in ['無', '萬', '禮', '體', '漢'] else 0.85 
            for v in self.variant_map.keys()
        }
    
    def recognize_variants(self, text):
        results = []
        seen = set()
        
        for idx, char in enumerate(text):
            if char in self.variant_map and char not in seen:
                seen.add(char)
                results.append({
                    'position': idx,
                    'variant_char': char,
                    'standard_char': self.variant_map[char],
                    'confidence': self.confidence_scores.get(char, 0.8),
                    'source': '异体字字典'
                })
        
        return results
    
    def convert_to_standard(self, text):
        result = []
        variants_found = []
        
        for idx, char in enumerate(text):
            if char in self.variant_map:
                standard = self.variant_map[char]
                result.append(standard)
                variants_found.append({
                    'position': idx,
                    'original': char,
                    'converted': standard
                })
            else:
                result.append(char)
        
        return ''.join(result), variants_found
    
    def suggest_variants(self, standard_char):
        return self.reverse_map.get(standard_char, [])

class PunctuationModelOptimizer:
    def __init__(self):
        self.rules = [
            {'pattern': r'.*[之乎者也矣焉哉]$', 'punct': '。', 'weight': 0.95},
            {'pattern': r'.*[曰云道]$', 'punct': '：', 'weight': 0.90},
            {'pattern': r'.*[而则故是然但虽且及与以].*', 'punct': '，', 'weight': 0.70},
            {'pattern': r'.*[何胡焉奚安岂孰乌恶乎].*', 'punct': '？', 'weight': 0.75},
            {'pattern': r'^[盖夫盖维若夫].*', 'punct': '，', 'weight': 0.60},
            {'pattern': r'.*[矣哉耶耶乎]$', 'punct': '！', 'weight': 0.65},
        ]
        self.performance = {i: {'success': 0, 'total': 0} for i in range(len(self.rules))}
    
    def add_feedback(self, rule_index, is_correct):
        if 0 <= rule_index < len(self.rules):
            self.performance[rule_index]['total'] += 1
            if is_correct:
                self.performance[rule_index]['success'] += 1
    
    def get_rule_performance(self, rule_index):
        perf = self.performance[rule_index]
        if perf['total'] == 0:
            return self.rules[rule_index]['weight']
        return perf['success'] / perf['total']
    
    def optimize_weights(self):
        for i, rule in enumerate(self.rules):
            perf = self.get_rule_performance(i)
            if perf['total'] > 0:
                success_rate = perf['success'] / perf['total']
                rule['weight'] = 0.5 * rule['weight'] + 0.5 * success_rate
        
        self.rules.sort(key=lambda x: -x['weight'])
    
    def apply_rules(self, text):
        applied_rules = []
        
        for i, rule in enumerate(self.rules):
            if re.match(rule['pattern'], text):
                applied_rules.append({
                    'rule_index': i,
                    'pattern': rule['pattern'],
                    'punctuation': rule['punct'],
                    'confidence': rule['weight']
                })
        
        return sorted(applied_rules, key=lambda x: -x['confidence'])

recognizer = VariantCharRecognizer()
optimizer = PunctuationModelOptimizer()

@app.route('/variant/recognize', methods=['POST'])
def recognize_variants():
    try:
        data = request.json
        text = data.get('text', '')
        
        variants = recognizer.recognize_variants(text)
        
        return jsonify({
            'success': True,
            'original_text': text,
            'variants_found': variants,
            'count': len(variants)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/variant/convert', methods=['POST'])
def convert_to_standard():
    try:
        data = request.json
        text = data.get('text', '')
        
        converted, variants = recognizer.convert_to_standard(text)
        
        return jsonify({
            'success': True,
            'original_text': text,
            'converted_text': converted,
            'variants_converted': variants,
            'count': len(variants)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/variant/suggest', methods=['GET'])
def suggest_variants():
    try:
        char = request.args.get('char', '')
        variants = recognizer.suggest_variants(char)
        
        return jsonify({
            'success': True,
            'standard_char': char,
            'variant_suggestions': variants
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/punctuation/apply', methods=['POST'])
def apply_punctuation_rules():
    try:
        data = request.json
        text = data.get('text', '')
        
        applied_rules = optimizer.apply_rules(text)
        
        return jsonify({
            'success': True,
            'original_text': text,
            'applied_rules': applied_rules,
            'suggested_punctuation': applied_rules[0]['punctuation'] if applied_rules else None
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/punctuation/feedback', methods=['POST'])
def submit_feedback():
    try:
        data = request.json
        rule_index = data.get('rule_index', 0)
        is_correct = data.get('is_correct', False)
        
        optimizer.add_feedback(rule_index, is_correct)
        
        return jsonify({
            'success': True,
            'message': 'Feedback submitted successfully'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/punctuation/optimize', methods=['POST'])
def optimize_model():
    try:
        optimizer.optimize_weights()
        
        return jsonify({
            'success': True,
            'message': 'Model weights optimized successfully',
            'current_rules': optimizer.rules
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/punctuation/rules', methods=['GET'])
def get_rules():
    return jsonify({
        'success': True,
        'rules': optimizer.rules,
        'performance': optimizer.performance
    })

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'nlp-service'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3004, debug=True)
