#include "temporal_registration.h"
#include "../include/kdtree.h"
#include <algorithm>
#include <cmath>
#include <iostream>
#include <fstream>
#include <iomanip>

TemporalRegistration::TemporalRegistration() : progressCallback_(nullptr) {}

void TemporalRegistration::setProgressCallback(ProgressCallback callback) {
    progressCallback_ = callback;
}

void TemporalRegistration::reportProgress(int currentFrame, int totalFrames,
                                          const std::string& stage, double progress) {
    if (progressCallback_) {
        progressCallback_(currentFrame, totalFrames, stage, progress);
    }
}

Eigen::Matrix4d TemporalRegistration::registerFrameToFrame(
    const PointCloud& source,
    const PointCloud& target,
    const NonRigidRegistration::Parameters& params
) {
    NonRigidRegistration registration;
    auto result = registration.registerClouds(source, target, params);
    
    if (!result.success) {
        std::cerr << "Frame registration failed" << std::endl;
        return Eigen::Matrix4d::Identity();
    }
    
    Eigen::Vector3d sourceCenter(0,0,0);
    Eigen::Vector3d deformedCenter(0,0,0);
    for (size_t i = 0; i < source.size(); ++i) {
        sourceCenter += source[i].xyz;
    }
    for (size_t i = 0; i < result.deformedSource.size(); ++i) {
        deformedCenter += result.deformedSource[i].xyz;
    }
    sourceCenter /= source.size();
    deformedCenter /= result.deformedSource.size();
    
    Eigen::Matrix4d transform = Eigen::Matrix4d::Identity();
    transform.block<3,1>(0,3) = deformedCenter - sourceCenter;
    
    return transform;
}

bool TemporalRegistration::isKeyframeNeeded(
    const CameraPose& currentPose,
    const CameraPose& lastKeyframePose,
    int framesSinceLastKeyframe,
    const Parameters& params
) {
    if (framesSinceLastKeyframe >= params.keyframeInterval) {
        return true;
    }
    
    double translation = (currentPose.position - lastKeyframePose.position).norm();
    double angle = currentPose.rotation.angularDistance(lastKeyframePose.rotation);
    
    return translation > 0.05 || angle > 0.1;
}

PointCloud TemporalRegistration::fuseFrame(
    const PointCloud& frame,
    const Eigen::Matrix4d& pose,
    const PointCloud& currentModel,
    double voxelSize
) {
    PointCloud transformedFrame;
    transformedFrame.resize(frame.size());
    for (size_t i = 0; i < frame.size(); ++i) {
        Eigen::Vector4d pointH(frame[i].xyz.x(), frame[i].xyz.y(), frame[i].xyz.z(), 1.0);
        Eigen::Vector4d transformed = pose * pointH;
        transformedFrame[i].xyz = transformed.head<3>();
        transformedFrame[i].rgb = frame[i].rgb;
    }
    
    PointCloud combined;
    combined.reserve(currentModel.size() + transformedFrame.size());
    for (size_t i = 0; i < currentModel.size(); ++i) {
        combined.push_back(currentModel[i]);
    }
    for (size_t i = 0; i < transformedFrame.size(); ++i) {
        combined.push_back(transformedFrame[i]);
    }
    
    return combined.voxelDownsample(voxelSize);
}

TemporalRegistration::Result TemporalRegistration::registerSequence(
    const std::vector<PointCloud>& frameClouds,
    const Parameters& params
) {
    Result result;
    result.totalFrames = frameClouds.size();
    
    if (frameClouds.empty()) {
        result.message = "Empty point cloud sequence";
        result.success = false;
        return result;
    }
    
    std::cout << "Starting temporal registration of " << frameClouds.size() << " frames" << std::endl;
    
    result.cameraTrajectory.resize(frameClouds.size());
    result.registeredFrames.resize(frameClouds.size());
    result.frameRegistrationErrors.resize(frameClouds.size(), 0.0);
    
    result.cameraTrajectory[0].transform.setIdentity();
    result.cameraTrajectory[0].updateFromTransform();
    result.cameraTrajectory[0].frameIndex = 0;
    result.cameraTrajectory[0].timestamp = 0.0;
    result.registeredFrames[0] = frameClouds[0];
    
    PointCloud fusedModel = frameClouds[0];
    
    CameraPose lastKeyframePose = result.cameraTrajectory[0];
    int framesSinceLastKeyframe = 0;
    int lastKeyframeIndex = 0;
    
    for (size_t i = 1; i < frameClouds.size(); ++i) {
        reportProgress(i, frameClouds.size(), "Processing frame", 
                      (double)i / frameClouds.size());
        
        std::cout << "Processing frame " << i << "/" << frameClouds.size() << std::endl;
        
        size_t targetIndex = isKeyframeNeeded(result.cameraTrajectory[i-1], lastKeyframePose,
                                               framesSinceLastKeyframe, params) ? 
                            lastKeyframeIndex : i - 1;
        
        const PointCloud& targetCloud = frameClouds[targetIndex];
        const PointCloud& sourceCloud = frameClouds[i];
        
        Eigen::Matrix4d deltaTransform = registerFrameToFrame(
            sourceCloud, targetCloud, params.perFrameParams
        );
        
        result.cameraTrajectory[i].transform = result.cameraTrajectory[targetIndex].transform * deltaTransform;
        result.cameraTrajectory[i].updateFromTransform();
        result.cameraTrajectory[i].frameIndex = i;
        result.cameraTrajectory[i].timestamp = i * 0.033;
        
        if (isKeyframeNeeded(result.cameraTrajectory[i], lastKeyframePose,
                             framesSinceLastKeyframe, params)) {
            lastKeyframePose = result.cameraTrajectory[i];
            lastKeyframeIndex = i;
            framesSinceLastKeyframe = 0;
            
            reportProgress(i, frameClouds.size(), "Fusing keyframe",
                          (double)i / frameClouds.size());
            
            fusedModel = fuseFrame(frameClouds[i], result.cameraTrajectory[i].transform,
                                   fusedModel, params.fusionVoxelSize);
        } else {
            framesSinceLastKeyframe++;
        }
        
        result.frameRegistrationErrors[i] = 
            deltaTransform.block<3,1>(0,3).norm();
        
        PointCloud registeredFrame;
        registeredFrame.resize(frameClouds[i].size());
        for (size_t p = 0; p < frameClouds[i].size(); ++p) {
            Eigen::Vector4d pointH(frameClouds[i][p].xyz.x(), frameClouds[i][p].xyz.y(),
                                   frameClouds[i][p].xyz.z(), 1.0);
            Eigen::Vector4d transformed = result.cameraTrajectory[i].transform * pointH;
            registeredFrame[p].xyz = transformed.head<3>();
            registeredFrame[p].rgb = frameClouds[i][p].rgb;
        }
        result.registeredFrames[i] = registeredFrame;
    }
    
    reportProgress(frameClouds.size() - 1, frameClouds.size(), "Final fusion", 0.95);
    
    for (size_t i = 1; i < frameClouds.size(); ++i) {
        fusedModel = fuseFrame(frameClouds[i], result.cameraTrajectory[i].transform,
                               fusedModel, params.fusionVoxelSize * 1.5);
    }
    
    result.fusedModel = fusedModel;
    result.success = true;
    result.message = "Temporal registration completed successfully";
    
    reportProgress(frameClouds.size() - 1, frameClouds.size(), "Complete", 1.0);
    
    std::cout << "Temporal registration completed!" << std::endl;
    std::cout << "Fused model has " << result.fusedModel.size() << " points" << std::endl;
    
    return result;
}

bool TemporalRegistration::saveTrajectoryPLY(const std::string& filename,
                                              const std::vector<CameraPose>& trajectory) const {
    std::ofstream file(filename);
    if (!file.is_open()) {
        return false;
    }
    
    file << "ply\n";
    file << "format ascii 1.0\n";
    file << "element vertex " << trajectory.size() << "\n";
    file << "property float x\n";
    file << "property float y\n";
    file << "property float z\n";
    file << "property float qw\n";
    file << "property float qx\n";
    file << "property float qy\n";
    file << "property float qz\n";
    file << "property float timestamp\n";
    file << "end_header\n";
    
    for (const auto& pose : trajectory) {
        file << pose.position.x() << " " 
             << pose.position.y() << " "
             << pose.position.z() << " "
             << pose.rotation.w() << " "
             << pose.rotation.x() << " "
             << pose.rotation.y() << " "
             << pose.rotation.z() << " "
             << pose.timestamp << "\n";
    }
    
    file.close();
    return true;
}

bool TemporalRegistration::saveTrajectoryCSV(const std::string& filename,
                                              const std::vector<CameraPose>& trajectory) const {
    std::ofstream file(filename);
    if (!file.is_open()) {
        return false;
    }
    
    file << "frame,timestamp,x,y,z,qw,qx,qy,qz\n";
    
    for (const auto& pose : trajectory) {
        file << pose.frameIndex << ","
             << std::fixed << std::setprecision(6)
             << pose.timestamp << ","
             << pose.position.x() << ","
             << pose.position.y() << ","
             << pose.position.z() << ","
             << pose.rotation.w() << ","
             << pose.rotation.x() << ","
             << pose.rotation.y() << ","
             << pose.rotation.z() << "\n";
    }
    
    file.close();
    return true;
}
