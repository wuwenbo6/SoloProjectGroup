#!/usr/bin/env python3
import json
import random
import uuid
from datetime import datetime, timedelta
import numpy as np

def generate_normal_trace(trace_id=None):
    if trace_id is None:
        trace_id = str(uuid.uuid4())
    
    service_names = ['api-gateway', 'user-service', 'order-service', 
                     'payment-service', 'db-service', 'cache-service']
    span_kinds = ['server', 'client', 'internal', 'producer', 'consumer']
    
    span_count = random.randint(5, 30)
    spans = []
    
    start_time = datetime.now()
    
    for i in range(span_count):
        span_id = str(uuid.uuid4())
        parent_idx = random.randint(-1, i-1) if i > 0 else -1
        parent_span_id = spans[parent_idx]['span_id'] if parent_idx >= 0 else ''
        
        duration = max(1000000, int(random.lognormvariate(13, 0.5)))
        
        span = {
            'trace_id': trace_id,
            'span_id': span_id,
            'parent_span_id': parent_span_id,
            'name': f'{random.choice(["handle", "process", "query", "update", "delete"])}_{random.choice(["request", "data", "user", "order"])}',
            'kind': random.choice(span_kinds),
            'start_time_unix_nano': int((start_time + timedelta(microseconds=random.randint(0, 10000))).timestamp() * 1e9),
            'duration': duration,
            'service_name': random.choice(service_names),
            'status_code': 0 if random.random() > 0.02 else 2,
            'attributes': {}
        }
        spans.append(span)
    
    return {
        'trace_id': trace_id,
        'spans': spans,
        'span_count': span_count,
        'service_names': list(set(s['service_name'] for s in spans)),
        'error_count': sum(1 for s in spans if s['status_code'] != 0),
        'duration': sum(s['duration'] for s in spans)
    }

def generate_anomalous_trace(trace_id=None):
    trace = generate_normal_trace(trace_id)
    
    anomaly_type = random.choice(['slow', 'error', 'complex', 'spike'])
    
    if anomaly_type == 'slow':
        for span in trace['spans']:
            span['duration'] = int(span['duration'] * random.uniform(5, 20))
        trace['duration'] = sum(s['duration'] for s in trace['spans'])
    
    elif anomaly_type == 'error':
        error_count = random.randint(len(trace['spans']) // 3, len(trace['spans']))
        for span in trace['spans'][:error_count]:
            span['status_code'] = 2
        trace['error_count'] = error_count
    
    elif anomaly_type == 'complex':
        extra_services = 15
        for span in trace['spans'][:extra_services]:
            span['service_name'] = f'service_{random.randint(100, 200)}'
        trace['service_names'] = list(set(s['service_name'] for s in trace['spans']))
    
    elif anomaly_type == 'spike':
        for _ in range(random.randint(50, 100)):
            span = {
                'trace_id': trace['trace_id'],
                'span_id': str(uuid.uuid4()),
                'parent_span_id': '',
                'name': f'spike_op_{random.randint(1, 100)}',
                'kind': 'internal',
                'duration': random.randint(100000, 5000000),
                'service_name': f'spike-service',
                'status_code': 0,
                'attributes': {}
            }
            trace['spans'].append(span)
        trace['span_count'] = len(trace['spans'])
    
    return trace

def generate_test_data(normal_count=100, anomaly_count=10):
    traces = []
    
    for _ in range(normal_count):
        traces.append(generate_normal_trace())
    
    for _ in range(anomaly_count):
        traces.append(generate_anomalous_trace())
    
    random.shuffle(traces)
    return traces

if __name__ == '__main__':
    traces = generate_test_data(normal_count=200, anomaly_count=20)
    
    with open('test_traces.json', 'w') as f:
        json.dump(traces, f, indent=2)
    
    print(f"Generated {len(traces)} test traces (10% anomalies)")
    print(f"Saved to test_traces.json")
