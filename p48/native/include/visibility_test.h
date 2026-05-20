#ifndef VISIBILITY_TEST_H
#define VISIBILITY_TEST_H

#include "point_cloud.h"
#include <Eigen/Core>
#include <Eigen/Geometry>
#include <vector>
#include <cmath>

struct Ray {
    Eigen::Vector3d origin;
    Eigen::Vector3d direction;
    
    Ray() : origin(0, 0, 0), direction(0, 0, 1) {}
    Ray(const Eigen::Vector3d& o, const Eigen::Vector3d& d) 
        : origin(o), direction(d.normalized()) {}
    
    Eigen::Vector3d pointAt(double t) const {
        return origin + t * direction;
    }
};

struct Triangle {
    Eigen::Vector3d v0, v1, v2;
    Eigen::Vector3d normal;
    
    Triangle() {}
    Triangle(const Eigen::Vector3d& a, const Eigen::Vector3d& b, const Eigen::Vector3d& c)
        : v0(a), v1(b), v2(c) {
        normal = (v1 - v0).cross(v2 - v0).normalized();
    }
    
    void computeNormal() {
        normal = (v1 - v0).cross(v2 - v0).normalized();
    }
};

struct IntersectionResult {
    bool hit;
    double t;
    Eigen::Vector3d point;
    Eigen::Vector3d barycentric;
    
    IntersectionResult() : hit(false), t(0.0) {}
};

class VisibilityTester {
public:
    VisibilityTester();
    
    IntersectionResult rayTriangleIntersection(
        const Ray& ray, 
        const Triangle& triangle,
        double epsilon = 1e-6
    ) const;
    
    bool isPointVisible(
        const Eigen::Vector3d& cameraPosition,
        const Eigen::Vector3d& point,
        const std::vector<Triangle>& meshTriangles,
        double epsilon = 1e-3
    ) const;
    
    std::vector<bool> computeVisibilityMap(
        const Eigen::Vector3d& cameraPosition,
        const PointCloud& cloud,
        const std::vector<Triangle>& meshTriangles,
        double epsilon = 1e-3
    ) const;
    
    std::vector<bool> computeVisibilityFromMultipleViews(
        const std::vector<Eigen::Vector3d>& cameraPositions,
        const PointCloud& cloud,
        const std::vector<Triangle>& meshTriangles,
        double epsilon = 1e-3,
        int minVisibleCount = 1
    ) const;
    
    void transferColorsWithVisibility(
        const PointCloud& source,
        const PointCloud& target,
        PointCloud& coloredTarget,
        const std::vector<size_t>& correspondences,
        const std::vector<bool>& visibilityMap,
        double confidenceThreshold = 0.5
    ) const;
    
    void bilateralFilterColors(
        PointCloud& cloud,
        double spatialSigma = 0.05,
        double colorSigma = 0.1,
        int kernelSize = 5
    ) const;
    
private:
    double triangleArea(const Triangle& tri) const;
    bool isFrontFace(const Ray& ray, const Triangle& tri) const;
};

class DepthBuffer {
public:
    DepthBuffer(int width, int height);
    
    void resize(int width, int height);
    void clear(double clearValue = 1e10);
    
    void setDepth(int x, int y, double depth);
    double getDepth(int x, int y) const;
    
    bool testAndSetDepth(int x, int y, double depth, double epsilon = 1e-3);
    
    void rasterizeTriangle(
        const Triangle& tri,
        const Eigen::Matrix4d& viewProjection,
        int width, int height
    );
    
    std::vector<bool> projectAndTestVisibility(
        const PointCloud& cloud,
        const Eigen::Matrix4d& viewProjection,
        int width, int height,
        double epsilon = 1e-3
    ) const;
    
private:
    int width_, height_;
    std::vector<double> buffer_;
    
    Eigen::Vector3d projectPoint(
        const Eigen::Vector3d& point,
        const Eigen::Matrix4d& viewProjection,
        int width, int height
    ) const;
};

#endif
