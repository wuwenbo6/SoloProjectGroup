#ifndef TEMPORAL_REGISTRATION_H
#define TEMPORAL_REGISTRATION_H

#include "point_cloud.h"
#include "registration.h"
#include <Eigen/Geometry>
#include <vector>
#include <string>
#include <functional>

struct CameraPose {
    Eigen::Matrix4d transform;
    Eigen::Vector3d position;
    Eigen::Quaterniond rotation;
    double timestamp;
    int frameIndex;
    
    CameraPose() : timestamp(0.0), frameIndex(-1) {
        transform.setIdentity();
        position.setZero();
        rotation.setIdentity();
    }
    
    void updateFromTransform() {
        position = transform.block<3,1>(0,3);
        rotation = Eigen::Quaterniond(transform.block<3,3>(0,0));
    }
};

class TemporalRegistration {
public:
    struct Parameters {
        NonRigidRegistration::Parameters perFrameParams;
        bool useKeyframes;
        int keyframeInterval;
        double maxFrameDistance;
        double fusionVoxelSize;
        int minFusionWeight;
        
        Parameters() : 
            useKeyframes(true),
            keyframeInterval(5),
            maxFrameDistance(0.1),
            fusionVoxelSize(0.005),
            minFusionWeight(2) {}
    };
    
    struct Result {
        std::vector<CameraPose> cameraTrajectory;
        PointCloud fusedModel;
        std::vector<PointCloud> registeredFrames;
        std::vector<double> frameRegistrationErrors;
        bool success;
        std::string message;
        int totalFrames;
        
        Result() : success(false), totalFrames(0) {}
    };
    
    typedef std::function<void(int currentFrame, int totalFrames, 
                               const std::string& stage, double progress)> ProgressCallback;
    
    TemporalRegistration();
    
    void setProgressCallback(ProgressCallback callback);
    
    Result registerSequence(
        const std::vector<PointCloud>& frameClouds,
        const Parameters& params = Parameters()
    );
    
    bool saveTrajectoryPLY(const std::string& filename, 
                           const std::vector<CameraPose>& trajectory) const;
    
    bool saveTrajectoryCSV(const std::string& filename,
                           const std::vector<CameraPose>& trajectory) const;
    
private:
    ProgressCallback progressCallback_;
    
    Eigen::Matrix4d registerFrameToFrame(
        const PointCloud& source,
        const PointCloud& target,
        const NonRigidRegistration::Parameters& params
    );
    
    PointCloud fuseFrame(
        const PointCloud& frame,
        const Eigen::Matrix4d& pose,
        const PointCloud& currentModel,
        double voxelSize
    );
    
    bool isKeyframeNeeded(
        const CameraPose& currentPose,
        const CameraPose& lastKeyframePose,
        int framesSinceLastKeyframe,
        const Parameters& params
    );
    
    void reportProgress(int currentFrame, int totalFrames,
                        const std::string& stage, double progress);
};

#endif