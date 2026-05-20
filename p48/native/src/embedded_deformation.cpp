#include "embedded_deformation.h"
#include "visibility_test.h"
#include <Eigen/Geometry>
#include <random>
#include <algorithm>
#include <numeric>
#include <iostream>

void DeformationNode::updateRotationMatrix() {
    Eigen::AngleAxisd rx(rotation.x(), Eigen::Vector3d::UnitX());
    Eigen::AngleAxisd ry(rotation.y(), Eigen::Vector3d::UnitY());
    Eigen::AngleAxisd rz(rotation.z(), Eigen::Vector3d::UnitZ());
    rotationMatrix = (rx * ry * rz).toRotationMatrix();
}

void EmbeddedDeformationGraph::sampleNodes(const PointCloud& cloud, size_t numNodes) {
    nodes.clear();
    if (cloud.empty()) return;
    
    numNodes = std::min(numNodes, cloud.size());
    
    std::vector<size_t> indices(cloud.size());
    std::iota(indices.begin(), indices.end(), 0);
    
    std::random_device rd;
    std::mt19937 g(rd());
    std::shuffle(indices.begin(), indices.end(), g);
    
    for (size_t i = 0; i < numNodes; ++i) {
        nodes.emplace_back(cloud[indices[i]].xyz);
    }
    
    std::cout << "Sampled " << nodes.size() << " deformation nodes" << std::endl;
}

void EmbeddedDeformationGraph::buildNeighborhoodGraph(double radius) {
    nodeNeighbors.resize(nodes.size());
    
    if (radius <= 0) {
        double maxDist = 0;
        for (size_t i = 0; i < nodes.size(); ++i) {
            for (size_t j = i + 1; j < nodes.size(); ++j) {
                maxDist = std::max(maxDist, 
                    (nodes[i].position - nodes[j].position).norm());
            }
        }
        radius = maxDist * 0.3;
    }
    
    for (size_t i = 0; i < nodes.size(); ++i) {
        for (size_t j = 0; j < nodes.size(); ++j) {
            if (i != j) {
                double dist = (nodes[i].position - nodes[j].position).norm();
                if (dist < radius) {
                    nodeNeighbors[i].push_back(j);
                }
            }
        }
    }
}

void EmbeddedDeformationGraph::computeWeights(const PointCloud& cloud, int k) {
    pointWeights.resize(cloud.size());
    
    for (size_t p = 0; p < cloud.size(); ++p) {
        std::vector<std::pair<size_t, double>> dists;
        for (size_t n = 0; n < nodes.size(); ++n) {
            double d = (cloud[p].xyz - nodes[n].position).norm();
            dists.emplace_back(n, d);
        }
        
        std::partial_sort(dists.begin(), dists.begin() + std::min(k, (int)dists.size()), 
                         dists.end(),
                         [](const auto& a, const auto& b) { return a.second < b.second; });
        
        double sum = 0;
        for (int i = 0; i < k && i < dists.size(); ++i) {
            if (dists[i].second < 1e-8) {
                pointWeights[p].clear();
                pointWeights[p].emplace_back(dists[i].first, 1.0);
                sum = 1.0;
                break;
            }
            double w = 1.0 / (dists[i].second * dists[i].second);
            pointWeights[p].emplace_back(dists[i].first, w);
            sum += w;
        }
        
        for (auto& nw : pointWeights[p]) {
            nw.second /= sum;
        }
    }
}

void EmbeddedDeformationGraph::buildFromPointCloud(const PointCloud& cloud, size_t numNodes) {
    sampleNodes(cloud, numNodes);
    buildNeighborhoodGraph();
    computeWeights(cloud);
}

Eigen::Vector3d EmbeddedDeformationGraph::computeRotatedPosition(
    const DeformationNode& node, const Eigen::Vector3d& point) const {
    return node.position + node.rotationMatrix * (point - node.position);
}

Eigen::Vector3d EmbeddedDeformationGraph::deformPoint(
    size_t pointIdx, const Eigen::Vector3d& point) const {
    if (pointIdx >= pointWeights.size()) return point;
    
    Eigen::Vector3d result(0, 0, 0);
    const auto& weights = pointWeights[pointIdx];
    
    for (const auto& nw : weights) {
        size_t nodeIdx = nw.first;
        double w = nw.second;
        result += w * computeRotatedPosition(nodes[nodeIdx], point);
    }
    
    return result;
}

void EmbeddedDeformationGraph::deformPointCloud(
    const PointCloud& source, PointCloud& deformed) const {
    deformed.resize(source.size());
    for (size_t i = 0; i < source.size(); ++i) {
        deformed[i].xyz = deformPoint(i, source[i].xyz);
        deformed[i].rgb = source[i].rgb;
        deformed[i].normal = source[i].normal;
    }
}

double EmbeddedDeformationGraph::computeEnergy(
    const PointCloud& source, const PointCloud& target,
    const std::vector<size_t>& correspondences,
    double alpha, double beta) const {
    double dataEnergy = 0;
    double smoothEnergy = 0;
    
    for (size_t i = 0; i < correspondences.size(); ++i) {
        if (correspondences[i] < target.size()) {
            Eigen::Vector3d deformed = deformPoint(i, source[i].xyz);
            dataEnergy += (deformed - target[correspondences[i]].xyz).squaredNorm();
        }
    }
    
    for (size_t i = 0; i < nodes.size(); ++i) {
        for (size_t j : nodeNeighbors[i]) {
            if (j > i) {
                smoothEnergy += (nodes[i].rotation - nodes[j].rotation).squaredNorm();
                smoothEnergy += (nodes[i].position - nodes[j].position).squaredNorm();
            }
        }
    }
    
    return alpha * dataEnergy + beta * smoothEnergy;
}

void EmbeddedDeformationGraph::optimize(
    const PointCloud& source, const PointCloud& target,
    const std::vector<size_t>& correspondences,
    int maxIterations, double alpha, double beta) {
    
    const double epsilon = 1e-6;
    const double stepSize = 0.01;
    
    for (int iter = 0; iter < maxIterations; ++iter) {
        double prevEnergy = computeEnergy(source, target, correspondences, alpha, beta);
        
        for (size_t n = 0; n < nodes.size(); ++n) {
            for (int dim = 0; dim < 3; ++dim) {
                nodes[n].position(dim) += epsilon;
                double energyPlus = computeEnergy(source, target, correspondences, alpha, beta);
                nodes[n].position(dim) -= 2 * epsilon;
                double energyMinus = computeEnergy(source, target, correspondences, alpha, beta);
                nodes[n].position(dim) += epsilon;
                
                double grad = (energyPlus - energyMinus) / (2 * epsilon);
                nodes[n].position(dim) -= stepSize * grad;
            }
            
            for (int dim = 0; dim < 3; ++dim) {
                nodes[n].rotation(dim) += epsilon;
                nodes[n].updateRotationMatrix();
                double energyPlus = computeEnergy(source, target, correspondences, alpha, beta);
                
                nodes[n].rotation(dim) -= 2 * epsilon;
                nodes[n].updateRotationMatrix();
                double energyMinus = computeEnergy(source, target, correspondences, alpha, beta);
                
                nodes[n].rotation(dim) += epsilon;
                nodes[n].updateRotationMatrix();
                
                double grad = (energyPlus - energyMinus) / (2 * epsilon);
                nodes[n].rotation(dim) -= stepSize * grad;
                nodes[n].updateRotationMatrix();
            }
        }
        
        double currentEnergy = computeEnergy(source, target, correspondences, alpha, beta);
        
        if (iter % 10 == 0) {
            std::cout << "Iteration " << iter << ", Energy: " << currentEnergy << std::endl;
        }
    }
}

std::vector<double> EmbeddedDeformationGraph::computeRegistrationError(
    const PointCloud& deformedSource, 
    const PointCloud& target,
    const std::vector<size_t>& correspondences) const {
    
    std::vector<double> errors(deformedSource.size(), 0.0);
    
    for (size_t i = 0; i < correspondences.size(); ++i) {
        if (correspondences[i] < target.size()) {
            errors[i] = (deformedSource[i].xyz - target[correspondences[i]].xyz).norm();
        }
    }
    
    return errors;
}

void EmbeddedDeformationGraph::transferColors(
    const PointCloud& source, const PointCloud& target,
    PointCloud& coloredTarget,
    const std::vector<size_t>& correspondences) const {
    
    coloredTarget = target;
    
    std::vector<std::vector<size_t>> reverseCorrespondences(target.size());
    for (size_t i = 0; i < correspondences.size(); ++i) {
        if (correspondences[i] < target.size()) {
            reverseCorrespondences[correspondences[i]].push_back(i);
        }
    }
    
    for (size_t t = 0; t < target.size(); ++t) {
        if (!reverseCorrespondences[t].empty()) {
            Eigen::Vector3d avgColor(0, 0, 0);
            for (size_t s : reverseCorrespondences[t]) {
                avgColor += source[s].rgb;
            }
            avgColor /= reverseCorrespondences[t].size();
            coloredTarget[t].rgb = avgColor;
        }
    }
}

void EmbeddedDeformationGraph::transferColorsWithVisibility(
    const PointCloud& source, const PointCloud& target,
    PointCloud& coloredTarget,
    const std::vector<size_t>& correspondences,
    const Eigen::Vector3d& cameraPosition,
    double epsilon) const {
    
    coloredTarget = target;
    
    std::vector<Triangle> occluderTriangles;
    if (target.size() >= 3) {
        KDTree tree(&target);
        tree.build();
        
        for (size_t i = 0; i < target.size(); ++i) {
            std::vector<size_t> neighbors = tree.kNearest(target[i].xyz, 10);
            for (size_t j = 1; j < neighbors.size() - 1; ++j) {
                occluderTriangles.emplace_back(
                    target[neighbors[0]].xyz,
                    target[neighbors[j]].xyz,
                    target[neighbors[j + 1]].xyz
                );
            }
        }
    }
    
    VisibilityTester tester;
    std::vector<bool> visibility = tester.computeVisibilityMap(
        cameraPosition, source, occluderTriangles, epsilon
    );
    
    std::vector<Eigen::Vector3d> accumulatedColors(target.size(), Eigen::Vector3d(0, 0, 0));
    std::vector<int> colorCounts(target.size(), 0);
    
    for (size_t i = 0; i < correspondences.size(); ++i) {
        size_t targetIdx = correspondences[i];
        if (targetIdx < target.size() && visibility[i]) {
            accumulatedColors[targetIdx] += source[i].rgb;
            colorCounts[targetIdx]++;
        }
    }
    
    for (size_t t = 0; t < target.size(); ++t) {
        if (colorCounts[t] > 0) {
            coloredTarget[t].rgb = accumulatedColors[t] / colorCounts[t];
        }
    }
    
    KDTree sourceTree(&source);
    sourceTree.build();
    
    for (size_t t = 0; t < target.size(); ++t) {
        if (colorCounts[t] == 0) {
            size_t nearest = sourceTree.nearest(target[t].xyz);
            if (nearest < source.size()) {
                coloredTarget[t].rgb = source[nearest].rgb;
            }
        }
    }
}

void EmbeddedDeformationGraph::transferColorsMultiView(
    const PointCloud& source, const PointCloud& target,
    PointCloud& coloredTarget,
    const std::vector<size_t>& correspondences,
    const std::vector<Eigen::Vector3d>& cameraPositions,
    double epsilon,
    int minVisibleCount) const {
    
    coloredTarget = target;
    
    std::vector<Triangle> occluderTriangles;
    if (target.size() >= 3) {
        KDTree tree(&target);
        tree.build();
        
        for (size_t i = 0; i < target.size(); ++i) {
            std::vector<size_t> neighbors = tree.kNearest(target[i].xyz, 10);
            for (size_t j = 1; j < neighbors.size() - 1; ++j) {
                occluderTriangles.emplace_back(
                    target[neighbors[0]].xyz,
                    target[neighbors[j]].xyz,
                    target[neighbors[j + 1]].xyz
                );
            }
        }
    }
    
    VisibilityTester tester;
    std::vector<bool> visibility = tester.computeVisibilityFromMultipleViews(
        cameraPositions, source, occluderTriangles, epsilon, minVisibleCount
    );
    
    std::vector<Eigen::Vector3d> accumulatedColors(target.size(), Eigen::Vector3d(0, 0, 0));
    std::vector<int> colorCounts(target.size(), 0);
    
    for (size_t i = 0; i < correspondences.size(); ++i) {
        size_t targetIdx = correspondences[i];
        if (targetIdx < target.size() && visibility[i]) {
            accumulatedColors[targetIdx] += source[i].rgb;
            colorCounts[targetIdx]++;
        }
    }
    
    for (size_t t = 0; t < target.size(); ++t) {
        if (colorCounts[t] > 0) {
            coloredTarget[t].rgb = accumulatedColors[t] / colorCounts[t];
        }
    }
    
    tester.bilateralFilterColors(coloredTarget, 0.05, 0.1, 8);
}
