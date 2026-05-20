#!/usr/bin/env python3
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app, db
from app.models.models import Building, Floor, Obstacle, POI

def init_sample_data():
    app = create_app()
    
    with app.app_context():
        print("Creating sample building data...")
        
        building = Building.query.filter_by(name="Main Building").first()
        if not building:
            building = Building(
                name="Main Building",
                description="Main office building with 3 floors",
                center_lat=39.9042,
                center_lng=116.4074,
                width=50.0,
                height=50.0
            )
            db.session.add(building)
            db.session.commit()
            print(f"Created building: {building.name}")
        else:
            print(f"Building already exists: {building.name}")
        
        floors_data = [
            {"floor_number": 1, "name": "Ground Floor", "grid_width": 50, "grid_height": 50},
            {"floor_number": 2, "name": "First Floor", "grid_width": 50, "grid_height": 50},
            {"floor_number": 3, "name": "Second Floor", "grid_width": 50, "grid_height": 50}
        ]
        
        for floor_data in floors_data:
            floor = Floor.query.filter_by(
                building_id=building.id,
                floor_number=floor_data["floor_number"]
            ).first()
            
            if not floor:
                floor = Floor(
                    building_id=building.id,
                    floor_number=floor_data["floor_number"],
                    name=floor_data["name"],
                    grid_size=1.0,
                    grid_width=floor_data["grid_width"],
                    grid_height=floor_data["grid_height"]
                )
                db.session.add(floor)
                db.session.commit()
                print(f"Created floor: {floor.name}")
                
                obstacles = [
                    {"name": "Wall 1", "type": "wall", "x1": 5, "y1": 5, "x2": 15, "y2": 6},
                    {"name": "Wall 2", "type": "wall", "x1": 25, "y1": 10, "x2": 26, "y2": 30},
                    {"name": "Room 1", "type": "room", "x1": 30, "y1": 5, "x2": 45, "y2": 20},
                    {"name": "Corridor Wall", "type": "wall", "x1": 10, "y1": 25, "x2": 40, "y2": 26},
                    {"name": "Elevator", "type": "elevator", "x1": 22, "y1": 22, "x2": 28, "y2": 28}
                ]
                
                for obs_data in obstacles:
                    obstacle = Obstacle(
                        floor_id=floor.id,
                        name=obs_data["name"],
                        type=obs_data["type"],
                        x1=obs_data["x1"],
                        y1=obs_data["y1"],
                        x2=obs_data["x2"],
                        y2=obs_data["y2"]
                    )
                    db.session.add(obstacle)
                
                db.session.commit()
                print(f"  Created {len(obstacles)} obstacles")
                
                pois = [
                    {"name": "Main Entrance", "type": "entrance", "x": 5, "y": 25, "description": "Main building entrance"},
                    {"name": "Reception", "type": "service", "x": 10, "y": 25, "description": "Reception desk"},
                    {"name": "Conference Room A", "type": "meeting", "x": 35, "y": 10, "description": "Large conference room"},
                    {"name": "Conference Room B", "type": "meeting", "x": 35, "y": 15, "description": "Small conference room"},
                    {"name": "Restroom", "type": "facility", "x": 15, "y": 10, "description": "Public restroom"},
                    {"name": "Cafeteria", "type": "food", "x": 40, "y": 35, "description": "Employee cafeteria"},
                    {"name": "Elevator Lobby", "type": "facility", "x": 25, "y": 25, "description": "Elevator access point"},
                    {"name": "IT Office", "type": "office", "x": 15, "y": 40, "description": "Information Technology department"},
                    {"name": "HR Office", "type": "office", "x": 25, "y": 40, "description": "Human Resources department"},
                    {"name": "Executive Office", "type": "office", "x": 40, "y": 45, "description": "Executive management office"}
                ]
                
                for poi_data in pois:
                    poi = POI(
                        floor_id=floor.id,
                        name=poi_data["name"],
                        type=poi_data["type"],
                        x=poi_data["x"],
                        y=poi_data["y"],
                        description=poi_data["description"]
                    )
                    db.session.add(poi)
                
                db.session.commit()
                print(f"  Created {len(pois)} POIs")
            else:
                print(f"Floor already exists: {floor.name}")
        
        print("\nSample data initialization complete!")

if __name__ == "__main__":
    init_sample_data()
