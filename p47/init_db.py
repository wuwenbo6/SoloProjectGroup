#!/usr/bin/env python3
import sys
import os
import django

sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'api'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pest_monitor.settings')

django.setup()

from api_app.models import MicrophoneNode

def init_nodes():
    nodes = [
        {'node_id': 'node_1', 'lat': 35.0, 'lng': 118.0, 'height': 2.5},
        {'node_id': 'node_2', 'lat': 35.01, 'lng': 118.02, 'height': 2.5},
        {'node_id': 'node_3', 'lat': 35.01, 'lng': 117.98, 'height': 2.5},
        {'node_id': 'node_4', 'lat': 34.99, 'lng': 118.01, 'height': 2.5},
        {'node_id': 'node_5', 'lat': 34.99, 'lng': 117.99, 'height': 2.5},
    ]
    
    created_count = 0
    for node_data in nodes:
        node, created = MicrophoneNode.objects.get_or_create(
            node_id=node_data['node_id'],
            defaults=node_data
        )
        if created:
            created_count += 1
            print(f"Created node: {node.node_id}")
        else:
            print(f"Node already exists: {node.node_id}")
    
    print(f"\nTotal nodes created: {created_count}")
    print(f"Total nodes in DB: {MicrophoneNode.objects.count()}")

if __name__ == '__main__':
    print("Initializing microphone nodes...\n")
    init_nodes()
    print("\nInitialization complete!")
