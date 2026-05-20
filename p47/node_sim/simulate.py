import requests
import json
import time
import numpy as np
from .audio_generator import create_default_nodes, PestSoundGenerator
import soundfile as sf
import io


class NodeSimulation:
    def __init__(self, api_url='http://localhost:8000'):
        self.nodes = create_default_nodes()
        self.api_url = api_url
        self.generator = PestSoundGenerator()
    
    def register_nodes(self):
        for node in self.nodes:
            pos = node.get_position()
            try:
                response = requests.post(
                    f'{self.api_url}/api/nodes/register/',
                    json=pos
                )
                print(f"Registered node {node.node_id}: {response.status_code}")
            except Exception as e:
                print(f"Failed to register node {node.node_id}: {e}")
    
    def simulate_pest_event(self, pest_type, source_lat=None, source_lng=None, 
                            duration=3.0, base_time=None):
        if source_lat is None:
            source_lat = np.random.uniform(34.98, 35.02)
        if source_lng is None:
            source_lng = np.random.uniform(117.97, 118.03)
        
        if base_time is None:
            base_time = time.time()
        
        print(f"\nSimulating {pest_type} event at ({source_lat:.4f}, {source_lng:.4f})")
        
        detections = []
        for node in self.nodes:
            capture = node.capture_audio(
                source_lat, source_lng, pest_type,
                duration=duration, base_time=base_time
            )
            
            detections.append({
                'node_id': node.node_id,
                'timestamp': capture['arrival_time'],
                'signal': capture['signal'],
                'distance': capture['distance']
            })
            
            print(f"  Node {node.node_id}: arrival at {capture['arrival_time']:.4f}s, "
                  f"distance: {capture['distance']:.1f}m")
        
        return detections, source_lat, source_lng
    
    def upload_detections(self, detections, source_lat, source_lng):
        event_id = f"event_{int(time.time())}"
        
        for detection in detections:
            buffer = io.BytesIO()
            sf.write(buffer, detection['signal'], 22050, format='WAV')
            buffer.seek(0)
            
            files = {'audio_file': (f'{detection["node_id"]}_{event_id}.wav', 
                                    buffer, 'audio/wav')}
            data = {
                'node_id': detection['node_id'],
                'timestamp': str(detection['timestamp']),
                'event_id': event_id,
                'true_lat': str(source_lat),
                'true_lng': str(source_lng)
            }
            
            try:
                response = requests.post(
                    f'{self.api_url}/api/detections/upload/',
                    files=files,
                    data=data
                )
                if response.status_code == 201:
                    print(f"Uploaded detection from {detection['node_id']}")
                else:
                    print(f"Failed to upload {detection['node_id']}: {response.status_code}")
            except Exception as e:
                print(f"Error uploading {detection['node_id']}: {e}")
            
            time.sleep(0.1)
        
        return event_id
    
    def run_continuous_simulation(self, interval=10.0, max_events=10):
        pest_types = ['locust', 'cotton_bollworm', 'aphid', 'whitefly']
        
        for i in range(max_events):
            pest_type = np.random.choice(pest_types)
            detections, src_lat, src_lng = self.simulate_pest_event(pest_type)
            event_id = self.upload_detections(detections, src_lat, src_lng)
            
            print(f"Event {event_id} simulated. Waiting {interval}s...")
            time.sleep(interval)


def quick_test():
    sim = NodeSimulation()
    
    detections, src_lat, src_lng = sim.simulate_pest_event('locust')
    
    import os
    os.makedirs('test_output', exist_ok=True)
    for det in detections:
        sf.write(f'test_output/{det["node_id"]}.wav', det['signal'], 22050)
    
    print(f"\nTest audio saved to test_output/")
    print(f"True source location: lat={src_lat:.6f}, lng={src_lng:.6f}")


if __name__ == '__main__':
    quick_test()
