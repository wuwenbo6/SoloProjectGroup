#include "point_cloud.h"
#include <algorithm>
#include <cmath>
#include <iostream>

Eigen::Matrix3Xd PointCloud::getCoordinates() const {
    Eigen::Matrix3Xd coords(3, points.size());
    for (size_t i = 0; i < points.size(); ++i) {
        coords.col(i) = points[i].xyz;
    }
    return coords;
}

Eigen::Matrix3Xd PointCloud::getColors() const {
    Eigen::Matrix3Xd colors(3, points.size());
    for (size_t i = 0; i < points.size(); ++i) {
        colors.col(i) = points[i].rgb;
    }
    return colors;
}

PointCloud PointCloud::voxelDownsample(double voxelSize) const {
    if (voxelSize <= 0 || points.empty()) {
        return *this;
    }
    
    std::unordered_map<VoxelKey, VoxelAccumulator> voxelMap;
    voxelMap.reserve(points.size() / 8);
    
    Eigen::Vector3d minCoord = computeAABB();
    
    for (const Point& p : points) {
        int x = static_cast<int>((p.xyz.x() - minCoord.x()) / voxelSize);
        int y = static_cast<int>((p.xyz.y() - minCoord.y()) / voxelSize);
        int z = static_cast<int>((p.xyz.z() - minCoord.z()) / voxelSize);
        
        VoxelKey key(x, y, z);
        voxelMap[key].add(p);
    }
    
    PointCloud result;
    result.reserve(voxelMap.size());
    
    for (const auto& pair : voxelMap) {
        result.push_back(pair.second.average());
    }
    
    std::cout << "Voxel downsampling: " << points.size() << " -> " 
              << result.size() << " points" << std::endl;
    
    return result;
}

void PointCloud::estimateNormals(int k) {
    if (points.empty() || k <= 0) return;
    
    std::cout << "Estimating normals..." << std::endl;
    
    for (size_t i = 0; i < points.size(); ++i) {
        std::vector<std::pair<double, size_t>> distances;
        distances.reserve(points.size());
        
        for (size_t j = 0; j < points.size(); ++j) {
            if (i != j) {
                double dist = (points[i].xyz - points[j].xyz).squaredNorm();
                distances.emplace_back(dist, j);
            }
        }
        
        size_t numNeighbors = std::min(k, static_cast<int>(distances.size()));
        std::partial_sort(distances.begin(), distances.begin() + numNeighbors, distances.end());
        
        Eigen::Matrix3Xd neighbors(3, numNeighbors);
        Eigen::Vector3d centroid(0, 0, 0);
        
        for (size_t j = 0; j < numNeighbors; ++j) {
            neighbors.col(j) = points[distances[j].second].xyz;
            centroid += neighbors.col(j);
        }
        centroid /= numNeighbors;
        
        Eigen::Matrix3d cov = Eigen::Matrix3d::Zero();
        for (size_t j = 0; j < numNeighbors; ++j) {
            Eigen::Vector3d diff = neighbors.col(j) - centroid;
            cov += diff * diff.transpose();
        }
        
        Eigen::SelfAdjointEigenSolver<Eigen::Matrix3d> solver(cov);
        points[i].normal = solver.eigenvectors().col(0);
        
        if (points[i].normal.dot(points[i].xyz) > 0) {
            points[i].normal *= -1;
        }
    }
    
    std::cout << "Normals estimated" << std::endl;
}

std::vector<PointCloud> PointCloud::spatialPartition(int numChunks) const {
    std::vector<PointCloud> chunks(numChunks);
    if (points.empty()) return chunks;
    
    Eigen::Vector3d minCoord = computeAABB();
    Eigen::Vector3d maxCoord = minCoord;
    
    for (const Point& p : points) {
        for (int d = 0; d < 3; ++d) {
            maxCoord[d] = std::max(maxCoord[d], p.xyz[d]);
        }
    }
    
    Eigen::Vector3d extent = maxCoord - minCoord;
    int axis = 0;
    if (extent.y() > extent.x()) axis = 1;
    if (extent.z() > extent[axis]) axis = 2;
    
    std::vector<size_t> indices(points.size());
    for (size_t i = 0; i < points.size(); ++i) indices[i] = i;
    
    std::sort(indices.begin(), indices.end(), [&](size_t a, size_t b) {
        return points[a].xyz[axis] < points[b].xyz[axis];
    });
    
    size_t chunkSize = points.size() / numChunks;
    for (int c = 0; c < numChunks; ++c) {
        size_t start = c * chunkSize;
        size_t end = (c == numChunks - 1) ? points.size() : (c + 1) * chunkSize;
        
        chunks[c].reserve(end - start);
        for (size_t i = start; i < end; ++i) {
            chunks[c].push_back(points[indices[i]]);
        }
    }
    
    std::cout << "Spatial partition: " << numChunks << " chunks" << std::endl;
    
    return chunks;
}

Eigen::Vector3d PointCloud::computeAABB() const {
    if (points.empty()) return Eigen::Vector3d(0, 0, 0);
    
    Eigen::Vector3d minCoord = points[0].xyz;
    for (const Point& p : points) {
        for (int d = 0; d < 3; ++d) {
            minCoord[d] = std::min(minCoord[d], p.xyz[d]);
        }
    }
    return minCoord;
}
