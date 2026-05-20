#include "visibility_test.h"
#include <algorithm>
#include <iostream>

VisibilityTester::VisibilityTester() {}

IntersectionResult VisibilityTester::rayTriangleIntersection(
    const Ray& ray,
    const Triangle& triangle,
    double epsilon
) const {
    IntersectionResult result;
    
    const Eigen::Vector3d& v0 = triangle.v0;
    const Eigen::Vector3d& v1 = triangle.v1;
    const Eigen::Vector3d& v2 = triangle.v2;
    
    Eigen::Vector3d edge1 = v1 - v0;
    Eigen::Vector3d edge2 = v2 - v0;
    
    Eigen::Vector3d h = ray.direction.cross(edge2);
    double a = edge1.dot(h);
    
    if (a > -epsilon && a < epsilon) {
        return result;
    }
    
    double f = 1.0 / a;
    Eigen::Vector3d s = ray.origin - v0;
    double u = f * s.dot(h);
    
    if (u < 0.0 || u > 1.0) {
        return result;
    }
    
    Eigen::Vector3d q = s.cross(edge1);
    double v = f * ray.direction.dot(q);
    
    if (v < 0.0 || u + v > 1.0) {
        return result;
    }
    
    double t = f * edge2.dot(q);
    
    if (t > epsilon) {
        result.hit = true;
        result.t = t;
        result.point = ray.pointAt(t);
        result.barycentric = Eigen::Vector3d(1.0 - u - v, u, v);
    }
    
    return result;
}

bool VisibilityTester::isPointVisible(
    const Eigen::Vector3d& cameraPosition,
    const Eigen::Vector3d& point,
    const std::vector<Triangle>& meshTriangles,
    double epsilon
) const {
    Eigen::Vector3d direction = point - cameraPosition;
    double maxDistance = direction.norm();
    direction.normalize();
    
    Ray ray(cameraPosition, direction);
    
    for (const Triangle& tri : meshTriangles) {
        IntersectionResult hit = rayTriangleIntersection(ray, tri, epsilon);
        
        if (hit.hit && hit.t > epsilon && hit.t < maxDistance - epsilon) {
            return false;
        }
    }
    
    return true;
}

std::vector<bool> VisibilityTester::computeVisibilityMap(
    const Eigen::Vector3d& cameraPosition,
    const PointCloud& cloud,
    const std::vector<Triangle>& meshTriangles,
    double epsilon
) const {
    std::vector<bool> visibility(cloud.size(), false);
    
    for (size_t i = 0; i < cloud.size(); ++i) {
        visibility[i] = isPointVisible(cameraPosition, cloud[i].xyz, meshTriangles, epsilon);
    }
    
    return visibility;
}

std::vector<bool> VisibilityTester::computeVisibilityFromMultipleViews(
    const std::vector<Eigen::Vector3d>& cameraPositions,
    const PointCloud& cloud,
    const std::vector<Triangle>& meshTriangles,
    double epsilon,
    int minVisibleCount
) const {
    std::vector<int> visibleCounts(cloud.size(), 0);
    
    for (const Eigen::Vector3d& cam : cameraPositions) {
        std::vector<bool> viewVisibility = computeVisibilityMap(cam, cloud, meshTriangles, epsilon);
        
        for (size_t i = 0; i < cloud.size(); ++i) {
            if (viewVisibility[i]) {
                visibleCounts[i]++;
            }
        }
    }
    
    std::vector<bool> result(cloud.size(), false);
    for (size_t i = 0; i < cloud.size(); ++i) {
        result[i] = visibleCounts[i] >= minVisibleCount;
    }
    
    return result;
}

void VisibilityTester::transferColorsWithVisibility(
    const PointCloud& source,
    const PointCloud& target,
    PointCloud& coloredTarget,
    const std::vector<size_t>& correspondences,
    const std::vector<bool>& visibilityMap,
    double confidenceThreshold
) const {
    coloredTarget = target;
    
    std::vector<Eigen::Vector3d> accumulatedColors(target.size(), Eigen::Vector3d(0, 0, 0));
    std::vector<int> colorCounts(target.size(), 0);
    
    for (size_t i = 0; i < correspondences.size(); ++i) {
        size_t targetIdx = correspondences[i];
        
        if (targetIdx < target.size() && visibilityMap[i]) {
            accumulatedColors[targetIdx] += source[i].rgb;
            colorCounts[targetIdx]++;
        }
    }
    
    for (size_t i = 0; i < target.size(); ++i) {
        if (colorCounts[i] > 0) {
            coloredTarget[i].rgb = accumulatedColors[i] / colorCounts[i];
        }
    }
    
    std::vector<std::pair<size_t, double>> nearestDists(target.size(), 
        std::make_pair(std::numeric_limits<size_t>::max(), 1e10));
    
    KDTree tree(&source);
    tree.build();
    
    for (size_t i = 0; i < target.size(); ++i) {
        if (colorCounts[i] == 0) {
            size_t nearest = tree.nearest(target[i].xyz);
            if (nearest < source.size()) {
                coloredTarget[i].rgb = source[nearest].rgb;
            }
        }
    }
}

void VisibilityTester::bilateralFilterColors(
    PointCloud& cloud,
    double spatialSigma,
    double colorSigma,
    int kernelSize
) const {
    if (cloud.empty()) return;
    
    KDTree tree(&cloud);
    tree.build();
    
    std::vector<Eigen::Vector3d> newColors(cloud.size());
    double spatialFactor = -0.5 / (spatialSigma * spatialSigma);
    double colorFactor = -0.5 / (colorSigma * colorSigma);
    
    for (size_t i = 0; i < cloud.size(); ++i) {
        Eigen::Vector3d weightedColor(0, 0, 0);
        double totalWeight = 0.0;
        
        std::vector<size_t> neighbors = tree.kNearest(cloud[i].xyz, kernelSize);
        
        for (size_t j : neighbors) {
            double spatialDist = (cloud[i].xyz - cloud[j].xyz).norm();
            double colorDist = (cloud[i].rgb - cloud[j].rgb).norm();
            
            double spatialWeight = std::exp(spatialDist * spatialDist * spatialFactor);
            double colorWeight = std::exp(colorDist * colorDist * colorFactor);
            double weight = spatialWeight * colorWeight;
            
            weightedColor += weight * cloud[j].rgb;
            totalWeight += weight;
        }
        
        if (totalWeight > 0) {
            newColors[i] = weightedColor / totalWeight;
        } else {
            newColors[i] = cloud[i].rgb;
        }
    }
    
    for (size_t i = 0; i < cloud.size(); ++i) {
        cloud[i].rgb = newColors[i];
    }
}

double VisibilityTester::triangleArea(const Triangle& tri) const {
    return 0.5 * (tri.v1 - tri.v0).cross(tri.v2 - tri.v0).norm();
}

bool VisibilityTester::isFrontFace(const Ray& ray, const Triangle& tri) const {
    return ray.direction.dot(tri.normal) < 0;
}

DepthBuffer::DepthBuffer(int width, int height)
    : width_(width), height_(height), buffer_(width * height, 1e10) {}

void DepthBuffer::resize(int width, int height) {
    width_ = width;
    height_ = height;
    buffer_.resize(width * height, 1e10);
}

void DepthBuffer::clear(double clearValue) {
    std::fill(buffer_.begin(), buffer_.end(), clearValue);
}

void DepthBuffer::setDepth(int x, int y, double depth) {
    if (x >= 0 && x < width_ && y >= 0 && y < height_) {
        buffer_[y * width_ + x] = depth;
    }
}

double DepthBuffer::getDepth(int x, int y) const {
    if (x >= 0 && x < width_ && y >= 0 && y < height_) {
        return buffer_[y * width_ + x];
    }
    return 1e10;
}

bool DepthBuffer::testAndSetDepth(int x, int y, double depth, double epsilon) {
    if (x >= 0 && x < width_ && y >= 0 && y < height_) {
        size_t idx = y * width_ + x;
        if (depth < buffer_[idx] - epsilon) {
            buffer_[idx] = depth;
            return true;
        }
    }
    return false;
}

Eigen::Vector3d DepthBuffer::projectPoint(
    const Eigen::Vector3d& point,
    const Eigen::Matrix4d& viewProjection,
    int width, int height
) const {
    Eigen::Vector4d clip = viewProjection * Eigen::Vector4d(point.x(), point.y(), point.z(), 1.0);
    
    Eigen::Vector3d ndc = clip.head<3>() / clip.w();
    
    return Eigen::Vector3d(
        (ndc.x() + 1.0) * 0.5 * width,
        (1.0 - ndc.y()) * 0.5 * height,
        ndc.z()
    );
}

void DepthBuffer::rasterizeTriangle(
    const Triangle& tri,
    const Eigen::Matrix4d& viewProjection,
    int width, int height
) {
    Eigen::Vector3d p0 = projectPoint(tri.v0, viewProjection, width, height);
    Eigen::Vector3d p1 = projectPoint(tri.v1, viewProjection, width, height);
    Eigen::Vector3d p2 = projectPoint(tri.v2, viewProjection, width, height);
    
    if ((p0.z() < -1 || p0.z() > 1) && 
        (p1.z() < -1 || p1.z() > 1) && 
        (p2.z() < -1 || p2.z() > 1)) {
        return;
    }
    
    int minX = std::max(0, (int)std::floor(std::min({p0.x(), p1.x(), p2.x()})));
    int maxX = std::min(width - 1, (int)std::ceil(std::max({p0.x(), p1.x(), p2.x()})));
    int minY = std::max(0, (int)std::floor(std::min({p0.y(), p1.y(), p2.y()})));
    int maxY = std::min(height - 1, (int)std::ceil(std::max({p0.y(), p1.y(), p2.y()})));
    
    double area = (p1.x() - p0.x()) * (p2.y() - p0.y()) - (p1.y() - p0.y()) * (p2.x() - p0.x());
    if (std::abs(area) < 1e-10) return;
    
    for (int y = minY; y <= maxY; ++y) {
        for (int x = minX; x <= maxX; ++x) {
            double px = x + 0.5;
            double py = y + 0.5;
            
            double w0 = (p1.x() - px) * (p2.y() - py) - (p1.y() - py) * (p2.x() - px);
            double w1 = (p2.x() - px) * (p0.y() - py) - (p2.y() - py) * (p0.x() - px);
            double w2 = (p0.x() - px) * (p1.y() - py) - (p0.y() - py) * (p1.x() - px);
            
            if (w0 >= 0 && w1 >= 0 && w2 >= 0) {
                w0 /= area;
                w1 /= area;
                w2 /= area;
                
                double depth = w0 * p0.z() + w1 * p1.z() + w2 * p2.z();
                
                testAndSetDepth(x, y, depth);
            }
        }
    }
}

std::vector<bool> DepthBuffer::projectAndTestVisibility(
    const PointCloud& cloud,
    const Eigen::Matrix4d& viewProjection,
    int width, int height,
    double epsilon
) const {
    std::vector<bool> visibility(cloud.size(), false);
    
    for (size_t i = 0; i < cloud.size(); ++i) {
        Eigen::Vector3d screenPos = projectPoint(cloud[i].xyz, viewProjection, width, height);
        
        int x = (int)std::round(screenPos.x());
        int y = (int)std::round(screenPos.y());
        
        if (x >= 0 && x < width && y >= 0 && y < height) {
            double depth = getDepth(x, y);
            if (screenPos.z() <= depth + epsilon) {
                visibility[i] = true;
            }
        }
    }
    
    return visibility;
}
