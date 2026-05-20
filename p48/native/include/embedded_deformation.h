#ifndef EMBEDDED_DEFORMATION_H
#define EMBEDDED_DEFORMATION_H

#include "point_cloud.h"
#include <Eigen/Sparse>
#include <vector>

class DeformationNode {
public:
    Eigen::Vector3d position;
    Eigen::Vector3d rotation;
    Eigen::Matrix3d rotationMatrix;
    double weight;
    
    DeformationNode() : position(0,0,0), rotation(0,0,0), 
                       rotationMatrix(Eigen::Matrix3d::Identity()), weight(1.0) {}
    
    DeformationNode(const Eigen::Vector3d& pos) 
        : position(pos), rotation(0,0,0), 
          rotationMatrix(Eigen::Matrix3d::Identity()), weight(1.0) {}
    
    void updateRotationMatrix();
};

class EmbeddedDeformationGraph {
public:
    std::vector<DeformationNode> nodes;
    std::vector<std::vector<size_t>> nodeNeighbors;
    std::vector<std::vector<std::pair<size_t, double>>> pointWeights;
    
    EmbeddedDeformationGraph() = default;
    
    void buildFromPointCloud(const PointCloud& cloud, size_t numNodes = 100);
    void computeWeights(const PointCloud& cloud, int k = 4);
    
    Eigen::Vector3d deformPoint(size_t pointIdx, const Eigen::Vector3d& point) const;
    
    void deformPointCloud(const PointCloud& source, PointCloud& deformed) const;
    
    double computeEnergy(const PointCloud& source, const PointCloud& target,
                        const std::vector<size_t>& correspondences,
                        double alpha = 1.0, double beta = 10.0) const;
    
    void optimize(const PointCloud& source, const PointCloud& target,
                  const std::vector<size_t>& correspondences,
                  int maxIterations = 50, double alpha = 1.0, double beta = 10.0);
    
    std::vector<double> computeRegistrationError(
        const PointCloud& deformedSource, 
        const PointCloud& target,
        const std::vector<size_t>& correspondences) const;
    
    void transferColors(const PointCloud& source, const PointCloud& target,
                       PointCloud& coloredTarget,
                       const std::vector<size_t>& correspondences) const;
    
    void transferColorsWithVisibility(const PointCloud& source, const PointCloud& target,
                                      PointCloud& coloredTarget,
                                      const std::vector<size_t>& correspondences,
                                      const Eigen::Vector3d& cameraPosition,
                                      double epsilon = 1e-3) const;
    
    void transferColorsMultiView(const PointCloud& source, const PointCloud& target,
                                 PointCloud& coloredTarget,
                                 const std::vector<size_t>& correspondences,
                                 const std::vector<Eigen::Vector3d>& cameraPositions,
                                 double epsilon = 1e-3,
                                 int minVisibleCount = 1) const;

private:
    void sampleNodes(const PointCloud& cloud, size_t numNodes);
    void buildNeighborhoodGraph(double radius = -1.0);
    Eigen::Vector3d computeRotatedPosition(const DeformationNode& node,
                                           const Eigen::Vector3d& point) const;
};

#endif
