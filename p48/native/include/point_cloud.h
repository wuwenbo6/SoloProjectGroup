#ifndef POINT_CLOUD_H
#define POINT_CLOUD_H

#include <vector>
#include <unordered_map>
#include <Eigen/Core>

struct Point {
    Eigen::Vector3d xyz;
    Eigen::Vector3d rgb;
    Eigen::Vector3d normal;
    
    Point() : xyz(0,0,0), rgb(0,0,0), normal(0,0,0) {}
    Point(double x, double y, double z, double r=0, double g=0, double b=0)
        : xyz(x,y,z), rgb(r,g,b), normal(0,0,0) {}
};

struct VoxelKey {
    int x, y, z;
    
    VoxelKey() : x(0), y(0), z(0) {}
    VoxelKey(int x_, int y_, int z_) : x(x_), y(y_), z(z_) {}
    
    bool operator==(const VoxelKey& other) const {
        return x == other.x && y == other.y && z == other.z;
    }
};

namespace std {
    template<> struct hash<VoxelKey> {
        size_t operator()(const VoxelKey& k) const {
            return ((hash<int>()(k.x) ^ (hash<int>()(k.y) << 1)) >> 1) ^ (hash<int>()(k.z) << 1);
        }
    };
}

struct VoxelAccumulator {
    Eigen::Vector3d sum_xyz;
    Eigen::Vector3d sum_rgb;
    Eigen::Vector3d sum_normal;
    int count;
    
    VoxelAccumulator() : sum_xyz(0,0,0), sum_rgb(0,0,0), sum_normal(0,0,0), count(0) {}
    
    void add(const Point& p) {
        sum_xyz += p.xyz;
        sum_rgb += p.rgb;
        sum_normal += p.normal;
        count++;
    }
    
    Point average() const {
        Point p;
        if (count > 0) {
            p.xyz = sum_xyz / count;
            p.rgb = sum_rgb / count;
            p.normal = sum_normal / count;
            if (p.normal.norm() > 1e-8) {
                p.normal.normalize();
            }
        }
        return p;
    }
};

class PointCloud {
public:
    std::vector<Point> points;
    
    PointCloud() = default;
    PointCloud(const std::vector<Point>& pts) : points(pts) {}
    
    size_t size() const { return points.size(); }
    void resize(size_t n) { points.resize(n); }
    void reserve(size_t n) { points.reserve(n); }
    void push_back(const Point& p) { points.push_back(p); }
    
    Point& operator[](size_t i) { return points[i]; }
    const Point& operator[](size_t i) const { return points[i]; }
    
    void clear() { points.clear(); }
    bool empty() const { return points.empty(); }
    
    Eigen::Matrix3Xd getCoordinates() const;
    Eigen::Matrix3Xd getColors() const;
    
    PointCloud voxelDownsample(double voxelSize) const;
    void estimateNormals(int k = 10);
    std::vector<PointCloud> spatialPartition(int numChunks = 8) const;
    Eigen::Vector3d computeAABB() const;
};

#endif
