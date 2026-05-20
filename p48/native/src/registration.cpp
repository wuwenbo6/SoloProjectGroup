#include "registration.h"
#include "visibility_test.h"
#include <Eigen/Geometry>
#include <iostream>
#include <numeric>

NonRigidRegistration::NonRigidRegistration() : progressCallback_(nullptr) {}

void NonRigidRegistration::setProgressCallback(ProgressCallback callback) {
    progressCallback_ = callback;
}

void NonRigidRegistration::reportProgress(const std::string& stage, double progress) {
    if (progressCallback_) {
        progressCallback_(stage, progress);
    }
    std::cout << stage << " (" << (progress * 100) << "%)" << std::endl;
}

std::vector<size_t> NonRigidRegistration::findCorrespondencesFast(
    const PointCloud& source,
    const PointCloud& target,
    double threshold) {
    
    std::vector<size_t> correspondences(source.size(), -1);
    
    KDTree kdTree(&target);
    kdTree.build();
    
    double thresholdSq = threshold * threshold;
    
    for (size_t i = 0; i < source.size(); ++i) {
        size_t bestIdx = kdTree.nearest(source[i].xyz);
        
        if (bestIdx < target.size()) {
            if (threshold <= 0) {
                correspondences[i] = bestIdx;
            } else {
                double distSq = (source[i].xyz - target[bestIdx].xyz).squaredNorm();
                if (distSq < thresholdSq) {
                    correspondences[i] = bestIdx;
                }
            }
        }
    }
    
    return correspondences;
}

void NonRigidRegistration::rigidAlignment(PointCloud& source, const PointCloud& target) {
    if (source.empty() || target.empty()) return;
    
    Eigen::Vector3d sourceCenter(0,0,0);
    Eigen::Vector3d targetCenter(0,0,0);
    
    for (size_t i = 0; i < source.size(); ++i) {
        sourceCenter += source[i].xyz;
    }
    for (size_t i = 0; i < target.size(); ++i) {
        targetCenter += target[i].xyz;
    }
    sourceCenter /= source.size();
    targetCenter /= target.size();
    
    Eigen::Matrix3d H = Eigen::Matrix3d::Zero();
    size_t minSize = std::min(source.size(), target.size());
    for (size_t i = 0; i < minSize; ++i) {
        H += (source[i].xyz - sourceCenter) * 
             (target[i].xyz - targetCenter).transpose();
    }
    
    Eigen::JacobiSVD<Eigen::Matrix3d> svd(H, Eigen::ComputeFullU | Eigen::ComputeFullV);
    Eigen::Matrix3d R = svd.matrixV() * svd.matrixU().transpose();
    
    if (R.determinant() < 0) {
        Eigen::Matrix3d V = svd.matrixV();
        V.col(2) *= -1;
        R = V * svd.matrixU().transpose();
    }
    
    Eigen::Vector3d t = targetCenter - R * sourceCenter;
    
    for (size_t i = 0; i < source.size(); ++i) {
        source[i].xyz = R * source[i].xyz + t;
    }
}

PointCloud NonRigidRegistration::blendDeformations(
    const PointCloud& original,
    const std::vector<PointCloud>& chunks,
    const std::vector<Eigen::Vector3d>& chunkCenters,
    const std::vector<EmbeddedDeformationGraph>& graphs) {
    
    PointCloud result;
    result.resize(original.size());
    
    std::vector<std::vector<size_t>> chunkPointIndices(chunks.size());
    
    for (size_t c = 0; c < chunks.size(); ++c) {
        for (size_t i = 0; i < original.size(); ++i) {
            double dist = (original[i].xyz - chunkCenters[c]).norm();
            if (dist < 0.5) {
                chunkPointIndices[c].push_back(i);
            }
        }
    }
    
    for (size_t i = 0; i < original.size(); ++i) {
        std::vector<std::pair<size_t, double>> influences;
        
        for (size_t c = 0; c < chunkCenters.size(); ++c) {
            double dist = (original[i].xyz - chunkCenters[c]).norm();
            if (dist < 0.5) {
                double weight = std::exp(-dist * dist * 20.0);
                influences.emplace_back(c, weight);
            }
        }
        
        if (influences.empty()) {
            result[i] = original[i];
        } else {
            double totalWeight = 0;
            Eigen::Vector3d avgPos(0, 0, 0);
            
            for (const auto& infl : influences) {
                size_t c = infl.first;
                double w = infl.second;
                
                Eigen::Vector3d deformed = graphs[c].deformPoint(i, original[i].xyz);
                avgPos += w * deformed;
                totalWeight += w;
            }
            
            if (totalWeight > 0) {
                avgPos /= totalWeight;
            }
            
            result[i].xyz = avgPos;
            result[i].rgb = original[i].rgb;
            result[i].normal = original[i].normal;
        }
    }
    
    return result;
}

NonRigidRegistration::Result NonRigidRegistration::registerChunks(
    const PointCloud& source,
    const PointCloud& target,
    const Parameters& params) {
    
    Result result;
    result.success = false;
    
    reportProgress("Spatial partitioning", 0.1);
    std::vector<PointCloud> sourceChunks = source.spatialPartition(params.numChunks);
    std::vector<PointCloud> targetChunks = target.spatialPartition(params.numChunks);
    
    std::vector<Eigen::Vector3d> chunkCenters;
    std::vector<EmbeddedDeformationGraph> graphs(params.numChunks);
    
    for (size_t c = 0; c < params.numChunks; ++c) {
        reportProgress("Processing chunk " + std::to_string(c + 1) + "/" + 
                       std::to_string(params.numChunks),
                       0.2 + 0.6 * (c + 1.0) / params.numChunks);
        
        Eigen::Vector3d center(0, 0, 0);
        for (size_t i = 0; i < sourceChunks[c].size(); ++i) {
            center += sourceChunks[c][i].xyz;
        }
        center /= sourceChunks[c].size();
        chunkCenters.push_back(center);
        
        rigidAlignment(sourceChunks[c], targetChunks[c]);
        graphs[c].buildFromPointCloud(sourceChunks[c], params.numNodes / params.numChunks);
        
        std::vector<size_t> correspondences = findCorrespondencesFast(
            sourceChunks[c], targetChunks[c], params.correspondenceThreshold);
        
        graphs[c].optimize(sourceChunks[c], targetChunks[c], correspondences,
                          params.maxIterations / params.maxCorrespondenceIterations,
                          params.alpha, params.beta);
    }
    
    reportProgress("Blending deformations", 0.85);
    
    PointCloud alignedSource = source;
    rigidAlignment(alignedSource, target);
    
    result.deformedSource = blendDeformations(alignedSource, sourceChunks, chunkCenters, graphs);
    
    reportProgress("Computing final results", 0.95);
    
    std::vector<size_t> finalCorrespondences = findCorrespondencesFast(
        result.deformedSource, target, params.correspondenceThreshold);
    
    result.registrationErrors.resize(source.size(), 0);
    for (size_t i = 0; i < source.size(); ++i) {
        if (finalCorrespondences[i] < target.size()) {
            result.registrationErrors[i] = (result.deformedSource[i].xyz - 
                                            target[finalCorrespondences[i]].xyz).norm();
        }
    }
    
    result.averageError = 0;
    result.maxError = 0;
    int validCount = 0;
    for (size_t i = 0; i < result.registrationErrors.size(); ++i) {
        if (finalCorrespondences[i] < target.size()) {
            result.averageError += result.registrationErrors[i];
            result.maxError = std::max(result.maxError, result.registrationErrors[i]);
            validCount++;
        }
    }
    if (validCount > 0) {
        result.averageError /= validCount;
    }
    
    if (params.enableVisibilityTest) {
        Eigen::Vector3d center(0, 0, 0);
        for (size_t i = 0; i < source.size(); ++i) {
            center += source[i].xyz;
        }
        center /= source.size();
        
        Eigen::Vector3d cameraPosition = center + Eigen::Vector3d(0, 0, 2.0);
        graph_.transferColorsWithVisibility(source, target, result.coloredTarget,
                                          finalCorrespondences, cameraPosition,
                                          params.visibilityEpsilon);
        
        if (params.enableColorFiltering) {
            VisibilityTester tester;
            tester.bilateralFilterColors(result.coloredTarget, params.spatialSigma, params.colorSigma, 8);
        }
    } else {
        graph_.transferColors(source, target, result.coloredTarget, finalCorrespondences);
    }
    
    result.success = true;
    result.message = "Chunked registration completed";
    
    reportProgress("Complete", 1.0);
    
    return result;
}

NonRigidRegistration::Result NonRigidRegistration::registerClouds(
    const PointCloud& source, 
    const PointCloud& target,
    const Parameters& params) {
    
    Result result;
    result.success = false;
    
    if (source.empty() || target.empty()) {
        result.message = "Empty point cloud(s)";
        return result;
    }
    
    const size_t LARGE_CLOUD_THRESHOLD = 100000;
    bool isLargeCloud = (source.size() > LARGE_CLOUD_THRESHOLD || 
                        target.size() > LARGE_CLOUD_THRESHOLD);
    
    std::cout << "Starting non-rigid registration..." << std::endl;
    std::cout << "Source points: " << source.size() << std::endl;
    std::cout << "Target points: " << target.size() << std::endl;
    
    PointCloud workingSource = source;
    PointCloud workingTarget = target;
    
    if (isLargeCloud && params.enableDownsampling) {
        reportProgress("Downsampling source", 0.05);
        workingSource = source.voxelDownsample(params.downsampleVoxelSize);
        
        reportProgress("Downsampling target", 0.10);
        workingTarget = target.voxelDownsample(params.downsampleVoxelSize);
    }
    
    if (isLargeCloud && params.enableChunkedRegistration) {
        result = registerChunks(workingSource, workingTarget, params);
        
        if (params.enableDownsampling && source.size() > workingSource.size()) {
            reportProgress("Upsampling to original resolution", 0.98);
            
            PointCloud fullSource = source;
            rigidAlignment(fullSource, target);
            
            PointCloud fullResult;
            fullResult.resize(source.size());
            
            KDTree kdTree(&result.deformedSource);
            kdTree.build();
            
            for (size_t i = 0; i < source.size(); ++i) {
                size_t nearest = kdTree.nearest(fullSource[i].xyz);
                if (nearest < result.deformedSource.size()) {
                    Eigen::Vector3d offset = result.deformedSource[nearest].xyz - 
                                            workingSource[nearest].xyz;
                    fullResult[i].xyz = fullSource[i].xyz + offset;
                    fullResult[i].rgb = source[i].rgb;
                } else {
                    fullResult[i] = fullSource[i];
                }
            }
            
            result.deformedSource = fullResult;
        }
        
        return result;
    }
    
    reportProgress("Rigid alignment", 0.15);
    PointCloud alignedSource = workingSource;
    rigidAlignment(alignedSource, workingTarget);
    
    reportProgress("Building deformation graph", 0.25);
    graph_.buildFromPointCloud(alignedSource, params.numNodes);
    std::cout << "Deformation graph built with " << graph_.nodes.size() << " nodes" << std::endl;
    
    std::vector<size_t> correspondences;
    PointCloud currentDeformed = alignedSource;
    
    for (int iter = 0; iter < params.maxCorrespondenceIterations; ++iter) {
        double progress = 0.3 + 0.5 * (iter + 1.0) / params.maxCorrespondenceIterations;
        reportProgress("Finding correspondences (iter " + 
                      std::to_string(iter + 1) + ")", progress);
        
        correspondences = findCorrespondencesFast(currentDeformed, workingTarget, 
                                                   params.correspondenceThreshold);
        
        size_t validCorrespondences = 0;
        for (size_t c : correspondences) {
            if (c < workingTarget.size()) validCorrespondences++;
        }
        std::cout << "Iteration " << iter << ": " << validCorrespondences 
                  << " valid correspondences" << std::endl;
        
        graph_.optimize(alignedSource, workingTarget, correspondences,
                       params.maxIterations / params.maxCorrespondenceIterations,
                       params.alpha, params.beta);
        
        graph_.deformPointCloud(alignedSource, currentDeformed);
    }
    
    reportProgress("Computing final deformation", 0.85);
    graph_.deformPointCloud(alignedSource, result.deformedSource);
    
    result.registrationErrors = graph_.computeRegistrationError(
        result.deformedSource, workingTarget, correspondences);
    
    result.averageError = 0;
    result.maxError = 0;
    int validCount = 0;
    for (size_t i = 0; i < result.registrationErrors.size(); ++i) {
        if (correspondences[i] < workingTarget.size()) {
            result.averageError += result.registrationErrors[i];
            result.maxError = std::max(result.maxError, result.registrationErrors[i]);
            validCount++;
        }
    }
    if (validCount > 0) {
        result.averageError /= validCount;
    }
    
    if (params.enableVisibilityTest) {
        reportProgress("Computing visibility", 0.88);
        
        Eigen::Vector3d center(0, 0, 0);
        for (size_t i = 0; i < workingSource.size(); ++i) {
            center += workingSource[i].xyz;
        }
        center /= workingSource.size();
        
        if (params.enableMultiView) {
            std::vector<Eigen::Vector3d> cameraPositions;
            
            double radius = (center - workingSource[0].xyz).norm() * 2.0;
            for (int i = 0; i < params.numViews; ++i) {
                double angle = (2.0 * M_PI * i) / params.numViews;
                cameraPositions.emplace_back(
                    center.x() + radius * cos(angle),
                    center.y() + radius * sin(angle) * 0.5,
                    center.z() + radius * sin(angle)
                );
            }
            
            graph_.transferColorsMultiView(workingSource, workingTarget, 
                                           result.coloredTarget, correspondences,
                                           cameraPositions, params.visibilityEpsilon, 1);
        } else {
            Eigen::Vector3d cameraPosition = center + Eigen::Vector3d(0, 0, 2.0);
            
            graph_.transferColorsWithVisibility(workingSource, workingTarget,
                                               result.coloredTarget, correspondences,
                                               cameraPosition, params.visibilityEpsilon);
        }
        
        if (params.enableColorFiltering) {
            reportProgress("Filtering colors", 0.92);
            VisibilityTester tester;
            tester.bilateralFilterColors(result.coloredTarget, params.spatialSigma, params.colorSigma, 8);
        }
    } else {
        graph_.transferColors(workingSource, workingTarget, result.coloredTarget, correspondences);
    }
    
    result.success = true;
    result.message = "Registration completed successfully";
    
    reportProgress("Complete", 1.0);
    
    std::cout << "Registration completed:" << std::endl;
    std::cout << "  Average error: " << result.averageError << std::endl;
    std::cout << "  Max error: " << result.maxError << std::endl;
    
    return result;
}
