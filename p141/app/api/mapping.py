import math
import heapq
import numpy as np
from datetime import datetime
from flask import Blueprint, request, jsonify
from app import db
from app.models.models import Building, Floor, Obstacle, POI, HeatmapData, Trajectory

bp = Blueprint('mapping', __name__, url_prefix='/api/mapping')

class AStarPlanner:
    def __init__(self, grid_width, grid_height, grid_size=1.0, obstacles=None):
        self.grid_width = grid_width
        self.grid_height = grid_height
        self.grid_size = grid_size
        self.obstacles = obstacles or []
        self.obstacle_grid = self._build_obstacle_grid()
    
    def _build_obstacle_grid(self):
        grid = np.zeros((self.grid_height, self.grid_width), dtype=bool)
        for obs in self.obstacles:
            x1 = max(0, int(math.floor(obs.x1 / self.grid_size)))
            y1 = max(0, int(math.floor(obs.y1 / self.grid_size)))
            x2 = min(self.grid_width - 1, int(math.ceil(obs.x2 / self.grid_size)))
            y2 = min(self.grid_height - 1, int(math.ceil(obs.y2 / self.grid_size)))
            grid[y1:y2+1, x1:x2+1] = True
        return grid
    
    def _is_valid(self, x, y):
        if x < 0 or x >= self.grid_width or y < 0 or y >= self.grid_height:
            return False
        return not self.obstacle_grid[y, x]
    
    def _heuristic(self, a, b):
        return math.sqrt((a[0] - b[0])**2 + (a[1] - b[1])**2)
    
    def plan(self, start_x, start_y, end_x, end_y):
        start_gx = int(round(start_x / self.grid_size))
        start_gy = int(round(start_y / self.grid_size))
        end_gx = int(round(end_x / self.grid_size))
        end_gy = int(round(end_y / self.grid_size))
        
        if not self._is_valid(start_gx, start_gy) or not self._is_valid(end_gx, end_gy):
            return None
        
        neighbors = [(0,1), (0,-1), (1,0), (-1,0), (1,1), (1,-1), (-1,1), (-1,-1)]
        
        close_set = set()
        came_from = {}
        gscore = {(start_gx, start_gy): 0}
        fscore = {(start_gx, start_gy): self._heuristic((start_gx, start_gy), (end_gx, end_gy))}
        oheap = []
        
        heapq.heappush(oheap, (fscore[(start_gx, start_gy)], (start_gx, start_gy)))
        
        while oheap:
            current = heapq.heappop(oheap)[1]
            
            if current == (end_gx, end_gy):
                path = []
                while current in came_from:
                    path.append((
                        current[0] * self.grid_size + self.grid_size / 2,
                        current[1] * self.grid_size + self.grid_size / 2
                    ))
                    current = came_from[current]
                path.append((start_x, start_y))
                return path[::-1]
            
            close_set.add(current)
            
            for i, j in neighbors:
                neighbor = (current[0] + i, current[1] + j)
                tentative_g_score = gscore[current] + self._heuristic(current, neighbor)
                
                if 0 <= neighbor[0] < self.grid_width and 0 <= neighbor[1] < self.grid_height:
                    if self.obstacle_grid[neighbor[1], neighbor[0]]:
                        continue
                else:
                    continue
                
                if neighbor in close_set and tentative_g_score >= gscore.get(neighbor, 0):
                    continue
                
                if tentative_g_score < gscore.get(neighbor, 0) or neighbor not in [i[1] for i in oheap]:
                    came_from[neighbor] = current
                    gscore[neighbor] = tentative_g_score
                    fscore[neighbor] = tentative_g_score + self._heuristic(neighbor, (end_gx, end_gy))
                    heapq.heappush(oheap, (fscore[neighbor], neighbor))
        
        return None

@bp.route('/buildings', methods=['GET'])
def get_buildings():
    buildings = Building.query.all()
    return jsonify({
        'buildings': [b.to_dict() for b in buildings]
    })

@bp.route('/buildings', methods=['POST'])
def create_building():
    data = request.get_json()
    building = Building(
        name=data['name'],
        description=data.get('description'),
        center_lat=data['center_lat'],
        center_lng=data['center_lng'],
        width=data.get('width', 50.0),
        height=data.get('height', 50.0)
    )
    db.session.add(building)
    db.session.commit()
    return jsonify(building.to_dict()), 201

@bp.route('/buildings/<int:building_id>/floors', methods=['GET'])
def get_floors(building_id):
    floors = Floor.query.filter_by(building_id=building_id).order_by(Floor.floor_number).all()
    return jsonify({
        'floors': [f.to_dict() for f in floors]
    })

@bp.route('/buildings/<int:building_id>/floors', methods=['POST'])
def create_floor(building_id):
    data = request.get_json()
    floor = Floor(
        building_id=building_id,
        floor_number=data['floor_number'],
        name=data.get('name'),
        description=data.get('description'),
        grid_size=data.get('grid_size', 1.0),
        grid_width=data.get('grid_width', 50),
        grid_height=data.get('grid_height', 50),
        image_url=data.get('image_url')
    )
    db.session.add(floor)
    db.session.commit()
    return jsonify(floor.to_dict()), 201

@bp.route('/floors/<int:floor_id>/obstacles', methods=['GET'])
def get_obstacles(floor_id):
    obstacles = Obstacle.query.filter_by(floor_id=floor_id).all()
    return jsonify({
        'obstacles': [o.to_dict() for o in obstacles]
    })

@bp.route('/floors/<int:floor_id>/obstacles', methods=['POST'])
def create_obstacle(floor_id):
    data = request.get_json()
    obstacle = Obstacle(
        floor_id=floor_id,
        name=data.get('name'),
        type=data.get('type'),
        x1=data['x1'],
        y1=data['y1'],
        x2=data['x2'],
        y2=data['y2']
    )
    db.session.add(obstacle)
    db.session.commit()
    return jsonify(obstacle.to_dict()), 201

@bp.route('/floors/<int:floor_id>/pois', methods=['GET'])
def get_pois(floor_id):
    pois = POI.query.filter_by(floor_id=floor_id).all()
    return jsonify({
        'pois': [p.to_dict() for p in pois]
    })

@bp.route('/floors/<int:floor_id>/pois', methods=['POST'])
def create_poi(floor_id):
    data = request.get_json()
    poi = POI(
        floor_id=floor_id,
        name=data['name'],
        type=data.get('type'),
        x=data['x'],
        y=data['y'],
        description=data.get('description')
    )
    db.session.add(poi)
    db.session.commit()
    return jsonify(poi.to_dict()), 201

@bp.route('/floors/<int:floor_id>/path', methods=['POST'])
def plan_path(floor_id):
    data = request.get_json()
    start_x = data['start_x']
    start_y = data['start_y']
    end_x = data['end_x']
    end_y = data['end_y']
    
    floor = Floor.query.get_or_404(floor_id)
    obstacles = Obstacle.query.filter_by(floor_id=floor_id).all()
    
    planner = AStarPlanner(
        floor.grid_width,
        floor.grid_height,
        floor.grid_size,
        obstacles
    )
    
    path = planner.plan(start_x, start_y, end_x, end_y)
    
    if path is None:
        return jsonify({'error': 'No valid path found'}), 400
    
    distance = 0
    for i in range(1, len(path)):
        dx = path[i][0] - path[i-1][0]
        dy = path[i][1] - path[i-1][1]
        distance += math.sqrt(dx*dx + dy*dy)
    
    return jsonify({
        'path': path,
        'distance': distance,
        'waypoints': len(path)
    })

@bp.route('/floors/<int:floor_id>/heatmap', methods=['GET'])
def get_heatmap(floor_id):
    heatmap_data = HeatmapData.query.filter_by(floor_id=floor_id).all()
    return jsonify({
        'heatmap': [h.to_dict() for h in heatmap_data]
    })

@bp.route('/floors/<int:floor_id>/heatmap/update', methods=['POST'])
def update_heatmap(floor_id):
    data = request.get_json()
    x = data['x']
    y = data['y']
    error = data['error']
    
    floor = Floor.query.get_or_404(floor_id)
    grid_x = int(round(x / floor.grid_size))
    grid_y = int(round(y / floor.grid_size))
    
    grid_x = max(0, min(floor.grid_width - 1, grid_x))
    grid_y = max(0, min(floor.grid_height - 1, grid_y))
    
    heatmap = HeatmapData.query.filter_by(
        floor_id=floor_id,
        grid_x=grid_x,
        grid_y=grid_y
    ).first()
    
    if heatmap:
        old_mean = heatmap.error_mean
        old_count = heatmap.sample_count
        new_count = old_count + 1
        new_mean = (old_mean * old_count + error) / new_count
        new_std = math.sqrt(
            (heatmap.error_std**2 * old_count + (error - old_mean) * (error - new_mean)) / new_count
        )
        
        heatmap.error_mean = new_mean
        heatmap.error_std = new_std
        heatmap.sample_count = new_count
    else:
        heatmap = HeatmapData(
            floor_id=floor_id,
            grid_x=grid_x,
            grid_y=grid_y,
            error_mean=error,
            error_std=0.0,
            sample_count=1
        )
        db.session.add(heatmap)
    
    db.session.commit()
    return jsonify(heatmap.to_dict())

@bp.route('/floors/<int:floor_id>/heatmap/generate', methods=['POST'])
def generate_heatmap_from_trajectory(floor_id):
    data = request.get_json()
    device_id = data.get('device_id')
    start_time = data.get('start_time')
    end_time = data.get('end_time')
    
    floor = Floor.query.get_or_404(floor_id)
    
    query = Trajectory.query
    if device_id:
        query = query.filter_by(device_id=device_id)
    if start_time:
        query = query.filter(Trajectory.timestamp >= datetime.fromisoformat(start_time))
    if end_time:
        query = query.filter(Trajectory.timestamp <= datetime.fromisoformat(end_time))
    
    trajectories = query.all()
    
    updates = 0
    for traj in trajectories:
        grid_x = int(round(traj.x / floor.grid_size))
        grid_y = int(round(traj.y / floor.grid_size))
        
        if 0 <= grid_x < floor.grid_width and 0 <= grid_y < floor.grid_height:
            error = traj.uncertainty or 1.0
            
            heatmap = HeatmapData.query.filter_by(
                floor_id=floor_id,
                grid_x=grid_x,
                grid_y=grid_y
            ).first()
            
            if heatmap:
                old_mean = heatmap.error_mean
                old_count = heatmap.sample_count
                new_count = old_count + 1
                heatmap.error_mean = (old_mean * old_count + error) / new_count
                heatmap.sample_count = new_count
            else:
                heatmap = HeatmapData(
                    floor_id=floor_id,
                    grid_x=grid_x,
                    grid_y=grid_y,
                    error_mean=error,
                    error_std=0.0,
                    sample_count=1
                )
                db.session.add(heatmap)
            
            updates += 1
    
    db.session.commit()
    
    return jsonify({
        'message': f'Heatmap updated with {updates} samples',
        'updates': updates
    })
