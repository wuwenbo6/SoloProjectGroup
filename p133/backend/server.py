#!/usr/bin/env python3
"""
6-DOF 机械臂控制后端 - ROS2 模拟服务
提供运动学求解、路径规划、状态监控等API接口
"""

import math
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn


class DHParameter:
    def __init__(self, theta: float, d: float, a: float, alpha: float):
        self.theta = theta
        self.d = d
        self.a = a
        self.alpha = alpha


class Kinematics:
    def __init__(self):
        self.dh_params = [
            DHParameter(0, 0.15, 0, math.pi / 2),
            DHParameter(0, 0, 0.2, 0),
            DHParameter(0, 0, 0.15, 0),
            DHParameter(0, 0, 0, math.pi / 2),
            DHParameter(0, 0.1, 0, -math.pi / 2),
            DHParameter(0, 0.08, 0, 0)
        ]
        
        self.joint_limits = [
            (-math.pi, math.pi),
            (-math.pi / 2, math.pi / 2),
            (-math.pi / 2, math.pi / 2),
            (-math.pi, math.pi),
            (-math.pi / 2, math.pi / 2),
            (-math.pi, math.pi)
        ]
        
        self.max_joint_velocity = 0.2

    def dh_transform(self, dh: DHParameter) -> np.ndarray:
        ct = math.cos(dh.theta)
        st = math.sin(dh.theta)
        ca = math.cos(dh.alpha)
        sa = math.sin(dh.alpha)
        
        return np.array([
            [ct, -st * ca, st * sa, dh.a * ct],
            [st, ct * ca, -ct * sa, dh.a * st],
            [0, sa, ca, dh.d],
            [0, 0, 0, 1]
        ])

    def forward_kinematics(self, joint_angles: List[float]) -> dict:
        transform = np.eye(4)
        joint_positions = []
        
        for i in range(6):
            dh = DHParameter(
                joint_angles[i],
                self.dh_params[i].d,
                self.dh_params[i].a,
                self.dh_params[i].alpha
            )
            transform = transform @ self.dh_transform(dh)
            joint_positions.append([
                float(transform[0, 3]),
                float(transform[1, 3]),
                float(transform[2, 3])
            ])
        
        return {
            "position": [
                float(transform[0, 3]),
                float(transform[1, 3]),
                float(transform[2, 3])
            ],
            "rotation": transform[:3, :3].tolist(),
            "joint_positions": joint_positions
        }

    def inverse_kinematics(
        self,
        target_pos: List[float],
        initial_guess: Optional[List[float]] = None,
        max_iterations: int = 150,
        tolerance: float = 0.002,
        learning_rate: float = 0.3
    ) -> dict:
        if initial_guess is None:
            joint_angles = np.zeros(6)
        else:
            joint_angles = np.array(initial_guess, dtype=float)
        
        target = np.array(target_pos)
        last_error_norm = float('inf')
        stagnation_count = 0
        
        for iter_num in range(max_iterations):
            fk = self.forward_kinematics(joint_angles.tolist())
            current_pos = np.array(fk["position"])
            
            error = target - current_pos
            error_norm = np.linalg.norm(error)
            
            if error_norm < tolerance:
                return {
                    "success": True,
                    "joint_angles": joint_angles.tolist(),
                    "iterations": iter_num,
                    "error": float(error_norm)
                }
            
            if abs(error_norm - last_error_norm) < 1e-6:
                stagnation_count += 1
                if stagnation_count > 10:
                    break
            else:
                stagnation_count = 0
            last_error_norm = error_norm
            
            jacobian = self._compute_jacobian(joint_angles)
            delta = self._solve_jacobian_damped(jacobian, error)
            
            max_delta = np.max(np.abs(delta))
            scale = self.max_joint_velocity / max_delta if max_delta > self.max_joint_velocity else 1.0
            
            joint_angles += learning_rate * scale * delta
            
            for i in range(6):
                joint_angles[i] = max(
                    self.joint_limits[i][0],
                    min(self.joint_limits[i][1], joint_angles[i])
                )
                
                if math.isnan(joint_angles[i]):
                    joint_angles[i] = initial_guess[i] if initial_guess else 0.0
        
        fk = self.forward_kinematics(joint_angles.tolist())
        current_pos = np.array(fk["position"])
        error_norm = np.linalg.norm(target - current_pos)
        
        return {
            "success": False,
            "joint_angles": joint_angles.tolist(),
            "iterations": max_iterations,
            "error": float(error_norm)
        }

    def _compute_jacobian(self, joint_angles: np.ndarray) -> np.ndarray:
        jacobian = np.zeros((3, 6))
        epsilon = 0.0001
        
        for i in range(6):
            angles1 = joint_angles.copy()
            angles2 = joint_angles.copy()
            angles1[i] -= epsilon
            angles2[i] += epsilon
            
            fk1 = self.forward_kinematics(angles1.tolist())
            fk2 = self.forward_kinematics(angles2.tolist())
            
            pos1 = np.array(fk1["position"])
            pos2 = np.array(fk2["position"])
            
            jacobian[:, i] = (pos2 - pos1) / (2 * epsilon)
        
        return jacobian

    def _solve_jacobian_damped(self, jacobian: np.ndarray, error: np.ndarray) -> np.ndarray:
        delta = np.zeros(6)
        damping = 0.05
        
        jt = jacobian.T
        jtj = jt @ jacobian
        jte = jt @ error
        
        for i in range(6):
            jtj[i, i] += damping * damping
        
        for iter_num in range(100):
            max_change = 0.0
            for i in range(6):
                sum_val = 0.0
                for j in range(6):
                    if i != j:
                        sum_val += jtj[i, j] * delta[j]
                new_val = (jte[i] - sum_val) / jtj[i, i]
                max_change = max(max_change, abs(new_val - delta[i]))
                delta[i] = new_val
                
                if math.isnan(delta[i]):
                    delta[i] = 0.0
            if max_change < 0.0001:
                break
        
        for i in range(6):
            if math.isnan(delta[i]) or abs(delta[i]) > 10:
                delta[i] = 0.0
        
        return delta

    def get_link_segments(self, joint_positions: List[List[float]]) -> List[dict]:
        segments = []
        base_pos = [0.0, 0.0, 0.0]
        
        for i in range(len(joint_positions)):
            start = base_pos if i == 0 else joint_positions[i - 1]
            end = joint_positions[i]
            segments.append({
                "start": start.copy(),
                "end": end.copy(),
                "radius": 0.03 if i < 3 else 0.02
            })
        
        return segments


class RRTStar:
    def __init__(self, kinematics: Kinematics, obstacles: List[dict] = None):
        self.kinematics = kinematics
        self.obstacles = obstacles or []
        self.max_iterations = 300
        self.goal_bias = 0.15
        self.step_size = 0.5
        self.connection_radius = 0.8
        self.collision_check_steps = 8

    def _distance(self, angles1: List[float], angles2: List[float]) -> float:
        dist = 0.0
        for a1, a2 in zip(angles1, angles2):
            diff = a1 - a2
            dist += diff * diff
        return math.sqrt(dist)

    def capsule_box_collision(self, seg_start: List[float], seg_end: List[float], radius: float, box: dict) -> bool:
        half_w = box["size"][0] / 2
        half_h = box["size"][1] / 2
        half_d = box["size"][2] / 2
        
        box_min = [
            box["position"][0] - half_w,
            box["position"][1] - half_h,
            box["position"][2] - half_d
        ]
        box_max = [
            box["position"][0] + half_w,
            box["position"][1] + half_h,
            box["position"][2] + half_d
        ]
        
        check_points = [seg_start, seg_end]
        steps = 5
        for i in range(1, steps):
            t = i / steps
            check_points.append([
                seg_start[0] + (seg_end[0] - seg_start[0]) * t,
                seg_start[1] + (seg_end[1] - seg_start[1]) * t,
                seg_start[2] + (seg_end[2] - seg_start[2]) * t
            ])
        
        for point in check_points:
            clamped = [
                max(box_min[0], min(box_max[0], point[0])),
                max(box_min[1], min(box_max[1], point[1])),
                max(box_min[2], min(box_max[2], point[2]))
            ]
            
            dist = math.sqrt(
                (point[0] - clamped[0])**2 +
                (point[1] - clamped[1])**2 +
                (point[2] - clamped[2])**2
            )
            
            if dist < radius - 0.005:
                return True
        
        return False

    def check_collision(self, joint_angles: List[float]) -> bool:
        fk = self.kinematics.forward_kinematics(joint_angles)
        segments = self.kinematics.get_link_segments(fk["joint_positions"])
        
        for segment in segments:
            for obs in self.obstacles:
                if self.capsule_box_collision(
                    segment["start"],
                    segment["end"],
                    segment["radius"],
                    obs
                ):
                    return True
        
        return False

    def line_collision_check(self, from_angles: List[float], to_angles: List[float], steps: int = None) -> bool:
        check_steps = steps or self.collision_check_steps
        
        for i in range(check_steps + 1):
            t = i / check_steps
            interpolated = []
            for j in range(6):
                interpolated.append(from_angles[j] + (to_angles[j] - from_angles[j]) * t)
            if self.check_collision(interpolated):
                return True
        return False

    def plan(self, start_angles: List[float], target_pos: List[float]) -> dict:
        ik_result = self.kinematics.inverse_kinematics(target_pos, start_angles)
        if not ik_result["success"]:
            return {"success": False, "path": [], "message": "目标位置不可达"}
        
        goal_angles = ik_result["joint_angles"]
        
        if self.check_collision(goal_angles):
            return {"success": False, "path": [], "message": "目标位置在障碍物内"}
        
        class Node:
            def __init__(self, angles, parent=None):
                self.angles = angles
                self.parent = parent
                self.cost = 0.0 if parent is None else parent.cost + self._distance(parent)
            
            def _distance(self, other):
                dist = 0.0
                for a1, a2 in zip(self.angles, other.angles):
                    diff = a1 - a2
                    dist += diff * diff
                return math.sqrt(dist)
        
        nodes = [Node(start_angles)]
        best_goal_node = None
        best_goal_cost = float('inf')
        
        for iter_num in range(self.max_iterations):
            if np.random.random() < self.goal_bias:
                sample = goal_angles
            else:
                sample = []
                for i in range(6):
                    limits = self.kinematics.joint_limits[i]
                    sample.append(np.random.uniform(limits[0], limits[1]))
            
            nearest = min(nodes, key=lambda n: self._distance(n.angles, sample))
            
            direction = [s - a for s, a in zip(sample, nearest.angles)]
            norm = math.sqrt(sum(d * d for d in direction))
            
            if norm > self.step_size:
                new_angles = [
                    nearest.angles[i] + (direction[i] / norm) * self.step_size
                    for i in range(6)
                ]
            else:
                new_angles = sample
            
            new_node = Node(new_angles, nearest)
            
            if self.check_collision(new_angles):
                continue
            
            near_nodes = [n for n in nodes if self._distance(n.angles, new_angles) <= self.connection_radius]
            
            for node in near_nodes:
                if not self.line_collision_check(node.angles, new_angles, 6):
                    potential_cost = node.cost + self._distance(node.angles, new_angles)
                    if potential_cost < new_node.cost:
                        new_node.cost = potential_cost
                        new_node.parent = node
            
            nodes.append(new_node)
            
            for node in near_nodes:
                if not self.line_collision_check(new_angles, node.angles, 6):
                    potential_cost = new_node.cost + self._distance(new_angles, node.angles)
                    if potential_cost < node.cost:
                        node.parent = new_node
                        node.cost = potential_cost
            
            dist_to_goal = self._distance(new_angles, goal_angles)
            if dist_to_goal < 0.15:
                if not self.line_collision_check(new_angles, goal_angles, 10):
                    total_cost = new_node.cost + dist_to_goal
                    if total_cost < best_goal_cost:
                        best_goal_cost = total_cost
                        best_goal_node = Node(goal_angles, new_node)
        
        if not best_goal_node:
            return {"success": False, "path": [], "message": "未找到可行路径"}
        
        path = []
        current = best_goal_node
        while current:
            path.insert(0, current.angles)
            current = current.parent
        
        smoothed_path = self._smooth_path(path)
        
        workspace_path = []
        for angles in smoothed_path:
            fk = self.kinematics.forward_kinematics(angles)
            workspace_path.append(fk["position"])
        
        return {
            "success": True,
            "path": smoothed_path,
            "workspace_path": workspace_path,
            "cost": best_goal_cost,
            "iterations": self.max_iterations
        }

    def _smooth_path(self, path: List[List[float]], iterations: int = 100) -> List[List[float]]:
        if len(path) < 3:
            return path
        
        smoothed = path.copy()
        
        for _ in range(iterations):
            i = np.random.randint(0, len(smoothed) - 1)
            j = np.random.randint(i, len(smoothed))
            
            if j - i < 2:
                continue
            
            if not self.line_collision_check(smoothed[i], smoothed[j], 15):
                smoothed = smoothed[:i + 1] + smoothed[j:]
        
        return smoothed


app = FastAPI(title="6-DOF Robot Arm Controller API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

kinematics = Kinematics()


class JointAnglesRequest(BaseModel):
    angles: List[float]


class IKRequest(BaseModel):
    target_position: List[float]
    initial_guess: Optional[List[float]] = None


class PlanPathRequest(BaseModel):
    start_angles: List[float]
    target_position: List[float]
    obstacles: List[dict] = []


class ExecutePathRequest(BaseModel):
    path: List[List[float]]
    speed: float = 1.0


@app.get("/")
async def root():
    return {"message": "6-DOF Robot Arm Controller API", "status": "running", "version": "1.1.0"}


@app.get("/api/status")
async def get_status():
    return {
        "status": "connected",
        "robot_model": "6-DOF Manipulator",
        "simulation_mode": True,
        "ros2_available": False,
        "features": ["damped_ik", "capsule_collision", "rrt_star_planner"]
    }


@app.post("/api/forward_kinematics")
async def forward_kinematics(request: JointAnglesRequest):
    if len(request.angles) != 6:
        raise HTTPException(status_code=400, detail="需要6个关节角度")
    
    result = kinematics.forward_kinematics(request.angles)
    return {"success": True, **result}


@app.post("/api/inverse_kinematics")
async def inverse_kinematics(request: IKRequest):
    if len(request.target_position) != 3:
        raise HTTPException(status_code=400, detail="目标位置需要3个坐标")
    
    result = kinematics.inverse_kinematics(
        request.target_position,
        request.initial_guess
    )
    return result


@app.post("/api/plan_path")
async def plan_path(request: PlanPathRequest):
    if len(request.start_angles) != 6:
        raise HTTPException(status_code=400, detail="起始关节角度需要6个值")
    if len(request.target_position) != 3:
        raise HTTPException(status_code=400, detail="目标位置需要3个坐标")
    
    rrt_star = RRTStar(kinematics, request.obstacles)
    result = rrt_star.plan(request.start_angles, request.target_position)
    return result


@app.post("/api/execute_path")
async def execute_path(request: ExecutePathRequest):
    if len(request.path) < 2:
        raise HTTPException(status_code=400, detail="路径至少需要2个点")
    
    return {
        "success": True,
        "message": "路径执行命令已发送",
        "path_length": len(request.path),
        "speed": request.speed,
        "estimated_time": len(request.path) * 0.1 / request.speed
    }


@app.get("/api/joint_limits")
async def get_joint_limits():
    return {
        "limits": [
            {
                "joint": i + 1,
                "min_rad": lim[0],
                "max_rad": lim[1],
                "min_deg": math.degrees(lim[0]),
                "max_deg": math.degrees(lim[1])
            }
            for i, lim in enumerate(kinematics.joint_limits)
        ]
    }


if __name__ == "__main__":
    print("=" * 60)
    print("6-DOF 机械臂控制后端服务 v1.1.0")
    print("改进: 阻尼逆运动学 + 胶囊体碰撞检测")
    print("=" * 60)
    print(f"API 文档: http://localhost:8000/docs")
    print(f"状态接口: http://localhost:8000/api/status")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
