#ifndef REGISTRATION_H
#define REGISTRATION_H

#include "point_cloud.h"
#include "embedded_deformation.h"
#include "kdtree.h"
#include <string>
#include <functional>

class NonRigidRegistration {
public:
    struct Result {
        PointCloud deformedSource;
        PointCloud coloredTarget;
        std::vector<double> registrationErrors;
        double averageError;
        double maxError;
        bool success;
        std::string message;
    };
    
    struct Parameters {
        size_t numNodes;
        int kNeighbors;
        int maxIterations;
        double alpha;
        double beta;
        double correspondenceThreshold;
        int maxCorrespondenceIterations;
        
        bool enableDownsampling;
        double downsampleVoxelSize;
        bool enableChunkedRegistration;
        int numChunks;
        
        bool enableVisibilityTest;
        double visibilityEpsilon;
        bool enableMultiView;
        int numViews;
        bool enableColorFiltering;
        double spatialSigma;
        double colorSigma;
        
        Parameters() : numNodes(100), kNeighbors(4), maxIterations(50),
                      alpha(1.0), beta(10.0), 
                      correspondenceThreshold(0.05),
                      maxCorrespondenceIterations(10),
                      enableDownsampling(true),
                      downsampleVoxelSize(0.01),
                      enableChunkedRegistration(true),
                      numChunks(4),
                      enableVisibilityTest(true),
                      visibilityEpsilon(1e-3),
                      enableMultiView(false),
                      numViews(4),
                      enableColorFiltering(true),
                      spatialSigma(0.05),
                      colorSigma(0.1) {}
    };
    
    typedef std::function<void(const std::string& stage, double progress)> ProgressCallback;
    
    NonRigidRegistration();
    
    void setProgressCallback(ProgressCallback callback);
    
    Result registerClouds(const PointCloud& source, 
                          const PointCloud& target,
                          const Parameters& params = Parameters());
    
    static std::vector<size_t> findCorrespondencesFast(
        const PointCloud& source,
        const PointCloud& target,
        double threshold = -1.0);
    
private:
    EmbeddedDeformationGraph graph_;
    ProgressCallback progressCallback_;
    
    void reportProgress(const std::string& stage, double progress);
    
    void rigidAlignment(PointCloud& source, const PointCloud& target);
    
    Result registerChunks(const PointCloud& source, const PointCloud& target,
                          const Parameters& params);
    
    PointCloud blendDeformations(const PointCloud& original,
                                 const std::vector<PointCloud>& chunks,
                                 const std::vector<Eigen::Vector3d>& chunkCenters,
                                 const std::vector<EmbeddedDeformationGraph>& graphs);
};

#endif
