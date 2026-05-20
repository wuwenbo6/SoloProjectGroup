#include <nan.h>
#include "../include/point_cloud.h"
#include "../include/ply_io.h"
#include "../include/registration.h"
#include "../include/temporal_registration.h"
#include "../include/quality_evaluation.h"

using namespace v8;

Nan::Persistent<Function> progressCallback;
Nan::Persistent<Function> temporalProgressCallback;

Local<Object> createPointCloudObject(Isolate* isolate, const PointCloud& cloud) {
    Local<Object> obj = Object::New(isolate);
    
    Local<Array> positions = Array::New(isolate, cloud.size() * 3);
    Local<Array> colors = Array::New(isolate, cloud.size() * 3);
    
    for (size_t i = 0; i < cloud.size(); ++i) {
        positions->Set(i * 3, Number::New(isolate, cloud[i].xyz.x()));
        positions->Set(i * 3 + 1, Number::New(isolate, cloud[i].xyz.y()));
        positions->Set(i * 3 + 2, Number::New(isolate, cloud[i].xyz.z()));
        
        colors->Set(i * 3, Number::New(isolate, cloud[i].rgb.x()));
        colors->Set(i * 3 + 1, Number::New(isolate, cloud[i].rgb.y()));
        colors->Set(i * 3 + 2, Number::New(isolate, cloud[i].rgb.z()));
    }
    
    obj->Set(String::NewFromUtf8(isolate, "positions"), positions);
    obj->Set(String::NewFromUtf8(isolate, "colors"), colors);
    obj->Set(String::NewFromUtf8(isolate, "count"), Number::New(isolate, cloud.size()));
    
    return obj;
}

void progressWrapper(const std::string& stage, double progress) {
    if (!progressCallback.IsEmpty()) {
        Isolate* isolate = Isolate::GetCurrent();
        Local<Function> cb = Nan::New<Function>(progressCallback);
        
        Local<Value> argv[2] = {
            String::NewFromUtf8(isolate, stage.c_str()),
            Number::New(isolate, progress)
        };
        
        Nan::MakeCallback(isolate->GetCurrentContext()->Global(), cb, 2, argv);
    }
}

void readPLY(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.Length() < 1 || !args[0]->IsString()) {
        isolate->ThrowException(Exception::TypeError(
            String::NewFromUtf8(isolate, "Expected filename string")));
        return;
    }
    
    String::Utf8Value filename(args[0]->ToString());
    PointCloud cloud;
    
    if (!PLYIO::read(*filename, cloud)) {
        isolate->ThrowException(Exception::Error(
            String::NewFromUtf8(isolate, "Failed to read PLY file")));
        return;
    }
    
    args.GetReturnValue().Set(createPointCloudObject(isolate, cloud));
}

void writePLY(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.Length() < 2 || !args[0]->IsString() || !args[1]->IsObject()) {
        isolate->ThrowException(Exception::TypeError(
            String::NewFromUtf8(isolate, "Expected filename and point cloud object")));
        return;
    }
    
    String::Utf8Value filename(args[0]->ToString());
    Local<Object> cloudObj = args[1]->ToObject();
    
    Local<Array> positions = Local<Array>::Cast(
        cloudObj->Get(String::NewFromUtf8(isolate, "positions")));
    Local<Array> colors = Local<Array>::Cast(
        cloudObj->Get(String::NewFromUtf8(isolate, "colors")));
    int count = cloudObj->Get(String::NewFromUtf8(isolate, "count"))->Int32Value();
    
    PointCloud cloud;
    cloud.resize(count);
    
    for (int i = 0; i < count; ++i) {
        cloud[i].xyz.x() = positions->Get(i * 3)->NumberValue();
        cloud[i].xyz.y() = positions->Get(i * 3 + 1)->NumberValue();
        cloud[i].xyz.z() = positions->Get(i * 3 + 2)->NumberValue();
        
        cloud[i].rgb.x() = colors->Get(i * 3)->NumberValue();
        cloud[i].rgb.y() = colors->Get(i * 3 + 1)->NumberValue();
        cloud[i].rgb.z() = colors->Get(i * 3 + 2)->NumberValue();
    }
    
    bool success = PLYIO::write(*filename, cloud, true, false);
    
    args.GetReturnValue().Set(Boolean::New(isolate, success));
}

void voxelDownsample(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.Length() < 2 || !args[0]->IsObject() || !args[1]->IsNumber()) {
        isolate->ThrowException(Exception::TypeError(
            String::NewFromUtf8(isolate, "Expected point cloud object and voxel size")));
        return;
    }
    
    Local<Object> cloudObj = args[0]->ToObject();
    double voxelSize = args[1]->NumberValue();
    
    Local<Array> positions = Local<Array>::Cast(
        cloudObj->Get(String::NewFromUtf8(isolate, "positions")));
    Local<Array> colors = Local<Array>::Cast(
        cloudObj->Get(String::NewFromUtf8(isolate, "colors")));
    int count = cloudObj->Get(String::NewFromUtf8(isolate, "count"))->Int32Value();
    
    PointCloud cloud;
    cloud.resize(count);
    
    for (int i = 0; i < count; ++i) {
        cloud[i].xyz.x() = positions->Get(i * 3)->NumberValue();
        cloud[i].xyz.y() = positions->Get(i * 3 + 1)->NumberValue();
        cloud[i].xyz.z() = positions->Get(i * 3 + 2)->NumberValue();
        
        cloud[i].rgb.x() = colors->Get(i * 3)->NumberValue();
        cloud[i].rgb.y() = colors->Get(i * 3 + 1)->NumberValue();
        cloud[i].rgb.z() = colors->Get(i * 3 + 2)->NumberValue();
    }
    
    PointCloud downsampled = cloud.voxelDownsample(voxelSize);
    
    args.GetReturnValue().Set(createPointCloudObject(isolate, downsampled));
}

void registerPointClouds(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.Length() < 2 || !args[0]->IsObject() || !args[1]->IsObject()) {
        isolate->ThrowException(Exception::TypeError(
            String::NewFromUtf8(isolate, "Expected source and target point cloud objects")));
        return;
    }
    
    Local<Object> sourceObj = args[0]->ToObject();
    Local<Object> targetObj = args[1]->ToObject();
    
    NonRigidRegistration::Parameters params;
    
    if (args.Length() >= 3 && args[2]->IsObject()) {
        Local<Object> paramsObj = args[2]->ToObject();
        
        Local<String> numNodesKey = String::NewFromUtf8(isolate, "numNodes");
        if (paramsObj->Has(numNodesKey)) {
            params.numNodes = paramsObj->Get(numNodesKey)->Int32Value();
        }
        
        Local<String> maxIterKey = String::NewFromUtf8(isolate, "maxIterations");
        if (paramsObj->Has(maxIterKey)) {
            params.maxIterations = paramsObj->Get(maxIterKey)->Int32Value();
        }
        
        Local<String> alphaKey = String::NewFromUtf8(isolate, "alpha");
        if (paramsObj->Has(alphaKey)) {
            params.alpha = paramsObj->Get(alphaKey)->NumberValue();
        }
        
        Local<String> betaKey = String::NewFromUtf8(isolate, "beta");
        if (paramsObj->Has(betaKey)) {
            params.beta = paramsObj->Get(betaKey)->NumberValue();
        }
        
        Local<String> downsampleKey = String::NewFromUtf8(isolate, "enableDownsampling");
        if (paramsObj->Has(downsampleKey)) {
            params.enableDownsampling = paramsObj->Get(downsampleKey)->BooleanValue();
        }
        
        Local<String> voxelSizeKey = String::NewFromUtf8(isolate, "downsampleVoxelSize");
        if (paramsObj->Has(voxelSizeKey)) {
            params.downsampleVoxelSize = paramsObj->Get(voxelSizeKey)->NumberValue();
        }
        
        Local<String> chunkedKey = String::NewFromUtf8(isolate, "enableChunkedRegistration");
        if (paramsObj->Has(chunkedKey)) {
            params.enableChunkedRegistration = paramsObj->Get(chunkedKey)->BooleanValue();
        }
        
        Local<String> numChunksKey = String::NewFromUtf8(isolate, "numChunks");
        if (paramsObj->Has(numChunksKey)) {
            params.numChunks = paramsObj->Get(numChunksKey)->Int32Value();
        }
        
        Local<String> visibilityKey = String::NewFromUtf8(isolate, "enableVisibilityTest");
        if (paramsObj->Has(visibilityKey)) {
            params.enableVisibilityTest = paramsObj->Get(visibilityKey)->BooleanValue();
        }
        
        Local<String> epsilonKey = String::NewFromUtf8(isolate, "visibilityEpsilon");
        if (paramsObj->Has(epsilonKey)) {
            params.visibilityEpsilon = paramsObj->Get(epsilonKey)->NumberValue();
        }
        
        Local<String> multiViewKey = String::NewFromUtf8(isolate, "enableMultiView");
        if (paramsObj->Has(multiViewKey)) {
            params.enableMultiView = paramsObj->Get(multiViewKey)->BooleanValue();
        }
        
        Local<String> numViewsKey = String::NewFromUtf8(isolate, "numViews");
        if (paramsObj->Has(numViewsKey)) {
            params.numViews = paramsObj->Get(numViewsKey)->Int32Value();
        }
        
        Local<String> colorFilterKey = String::NewFromUtf8(isolate, "enableColorFiltering");
        if (paramsObj->Has(colorFilterKey)) {
            params.enableColorFiltering = paramsObj->Get(colorFilterKey)->BooleanValue();
        }
        
        Local<String> spatialSigmaKey = String::NewFromUtf8(isolate, "spatialSigma");
        if (paramsObj->Has(spatialSigmaKey)) {
            params.spatialSigma = paramsObj->Get(spatialSigmaKey)->NumberValue();
        }
        
        Local<String> colorSigmaKey = String::NewFromUtf8(isolate, "colorSigma");
        if (paramsObj->Has(colorSigmaKey)) {
            params.colorSigma = paramsObj->Get(colorSigmaKey)->NumberValue();
        }
    }
    
    if (args.Length() >= 4 && args[3]->IsFunction()) {
        Local<Function> cb = Local<Function>::Cast(args[3]);
        progressCallback.Reset(cb);
    }
    
    Local<Array> sourcePositions = Local<Array>::Cast(
        sourceObj->Get(String::NewFromUtf8(isolate, "positions")));
    Local<Array> sourceColors = Local<Array>::Cast(
        sourceObj->Get(String::NewFromUtf8(isolate, "colors")));
    int sourceCount = sourceObj->Get(String::NewFromUtf8(isolate, "count"))->Int32Value();
    
    Local<Array> targetPositions = Local<Array>::Cast(
        targetObj->Get(String::NewFromUtf8(isolate, "positions")));
    Local<Array> targetColors = Local<Array>::Cast(
        targetObj->Get(String::NewFromUtf8(isolate, "colors")));
    int targetCount = targetObj->Get(String::NewFromUtf8(isolate, "count"))->Int32Value();
    
    PointCloud source, target;
    source.resize(sourceCount);
    target.resize(targetCount);
    
    for (int i = 0; i < sourceCount; ++i) {
        source[i].xyz.x() = sourcePositions->Get(i * 3)->NumberValue();
        source[i].xyz.y() = sourcePositions->Get(i * 3 + 1)->NumberValue();
        source[i].xyz.z() = sourcePositions->Get(i * 3 + 2)->NumberValue();
        
        source[i].rgb.x() = sourceColors->Get(i * 3)->NumberValue();
        source[i].rgb.y() = sourceColors->Get(i * 3 + 1)->NumberValue();
        source[i].rgb.z() = sourceColors->Get(i * 3 + 2)->NumberValue();
    }
    
    for (int i = 0; i < targetCount; ++i) {
        target[i].xyz.x() = targetPositions->Get(i * 3)->NumberValue();
        target[i].xyz.y() = targetPositions->Get(i * 3 + 1)->NumberValue();
        target[i].xyz.z() = targetPositions->Get(i * 3 + 2)->NumberValue();
        
        target[i].rgb.x() = targetColors->Get(i * 3)->NumberValue();
        target[i].rgb.y() = targetColors->Get(i * 3 + 1)->NumberValue();
        target[i].rgb.z() = targetColors->Get(i * 3 + 2)->NumberValue();
    }
    
    NonRigidRegistration registration;
    registration.setProgressCallback(progressWrapper);
    
    NonRigidRegistration::Result result = registration.registerClouds(source, target, params);
    
    Local<Object> resultObj = Object::New(isolate);
    
    resultObj->Set(String::NewFromUtf8(isolate, "success"), 
                   Boolean::New(isolate, result.success));
    resultObj->Set(String::NewFromUtf8(isolate, "message"), 
                   String::NewFromUtf8(isolate, result.message.c_str()));
    resultObj->Set(String::NewFromUtf8(isolate, "averageError"), 
                   Number::New(isolate, result.averageError));
    resultObj->Set(String::NewFromUtf8(isolate, "maxError"), 
                   Number::New(isolate, result.maxError));
    resultObj->Set(String::NewFromUtf8(isolate, "deformedSource"), 
                   createPointCloudObject(isolate, result.deformedSource));
    resultObj->Set(String::NewFromUtf8(isolate, "coloredTarget"), 
                   createPointCloudObject(isolate, result.coloredTarget));
    
    Local<Array> errors = Array::New(isolate, result.registrationErrors.size());
    for (size_t i = 0; i < result.registrationErrors.size(); ++i) {
        errors->Set(i, Number::New(isolate, result.registrationErrors[i]));
    }
    resultObj->Set(String::NewFromUtf8(isolate, "errors"), errors);
    
    progressCallback.Reset();
    
    args.GetReturnValue().Set(resultObj);
}

void temporalProgressWrapper(int currentFrame, int totalFrames, 
                              const std::string& stage, double progress) {
    if (!temporalProgressCallback.IsEmpty()) {
        Isolate* isolate = Isolate::GetCurrent();
        Local<Function> cb = Nan::New<Function>(temporalProgressCallback);
        
        Local<Value> argv[4] = {
            Number::New(isolate, currentFrame),
            Number::New(isolate, totalFrames),
            String::NewFromUtf8(isolate, stage.c_str()),
            Number::New(isolate, progress)
        };
        
        Nan::MakeCallback(isolate->GetCurrentContext()->Global(), cb, 4, argv);
    }
}

void registerTemporalSequence(const FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.Length() < 1 || !args[0]->IsArray()) {
        isolate->ThrowException(Exception::TypeError(
            String::NewFromUtf8(isolate, "Expected array of point clouds")));
        return;
    }
    
    Local<Array> cloudArray = Local<Array>::Cast(args[0]);
    int numClouds = cloudArray->Length();
    
    std::vector<PointCloud> frameClouds;
    frameClouds.reserve(numClouds);
    
    for (int i = 0; i < numClouds; ++i) {
        Local<Object> cloudObj = Local<Object>::Cast(cloudArray->Get(i));
        
        Local<Array> positions = Local<Array>::Cast(
            cloudObj->Get(String::NewFromUtf8(isolate, "positions")));
        Local<Array> colors = Local<Array>::Cast(
            cloudObj->Get(String::NewFromUtf8(isolate, "colors")));
        int count = cloudObj->Get(String::NewFromUtf8(isolate, "count"))->Int32Value();
        
        PointCloud cloud;
        cloud.resize(count);
        
        for (int p = 0; p < count; ++p) {
            cloud[p].xyz.x() = positions->Get(p * 3)->NumberValue();
            cloud[p].xyz.y() = positions->Get(p * 3 + 1)->NumberValue();
            cloud[p].xyz.z() = positions->Get(p * 3 + 2)->NumberValue();
            
            cloud[p].rgb.x() = colors->Get(p * 3)->NumberValue();
            cloud[p].rgb.y() = colors->Get(p * 3 + 1)->NumberValue();
            cloud[p].rgb.z() = colors->Get(p * 3 + 2)->NumberValue();
        }
        
        frameClouds.push_back(cloud);
    }
    
    TemporalRegistration::Parameters params;
    
    if (args.Length() >= 2 && args[1]->IsObject()) {
        Local<Object> paramsObj = args[1]->ToObject();
        
        Local<String> keyframeKey = String::NewFromUtf8(isolate, "useKeyframes");
        if (paramsObj->Has(keyframeKey)) {
            params.useKeyframes = paramsObj->Get(keyframeKey)->BooleanValue();
        }
        
        Local<String> keyframeIntervalKey = String::NewFromUtf8(isolate, "keyframeInterval");
        if (paramsObj->Has(keyframeIntervalKey)) {
            params.keyframeInterval = paramsObj->Get(keyframeIntervalKey)->Int32Value();
        }
        
        Local<String> fusionVoxelKey = String::NewFromUtf8(isolate, "fusionVoxelSize");
        if (paramsObj->Has(fusionVoxelKey)) {
            params.fusionVoxelSize = paramsObj->Get(fusionVoxelKey)->NumberValue();
        }
    }
    
    if (args.Length() >= 3 && args[2]->IsFunction()) {
        Local<Function> cb = Local<Function>::Cast(args[2]);
        temporalProgressCallback.Reset(cb);
    }
    
    TemporalRegistration registration;
    registration.setProgressCallback(temporalProgressWrapper);
    
    TemporalRegistration::Result result = registration.registerSequence(frameClouds, params);
    
    Local<Object> resultObj = Object::New(isolate);
    
    resultObj->Set(String::NewFromUtf8(isolate, "success"),
                   Boolean::New(isolate, result.success));
    resultObj->Set(String::NewFromUtf8(isolate, "message"),
                   String::NewFromUtf8(isolate, result.message.c_str()));
    resultObj->Set(String::NewFromUtf8(isolate, "totalFrames"),
                   Number::New(isolate, result.totalFrames));
    
    Local<Array> trajectory = Array::New(isolate, result.cameraTrajectory.size());
    for (size_t i = 0; i < result.cameraTrajectory.size(); ++i) {
        const auto& pose = result.cameraTrajectory[i];
        
        Local<Object> poseObj = Object::New(isolate);
        
        Local<Array> position = Array::New(isolate, 3);
        position->Set(0, Number::New(isolate, pose.position.x()));
        position->Set(1, Number::New(isolate, pose.position.y()));
        position->Set(2, Number::New(isolate, pose.position.z()));
        
        Local<Array> quaternion = Array::New(isolate, 4);
        quaternion->Set(0, Number::New(isolate, pose.rotation.w()));
        quaternion->Set(1, Number::New(isolate, pose.rotation.x()));
        quaternion->Set(2, Number::New(isolate, pose.rotation.y()));
        quaternion->Set(3, Number::New(isolate, pose.rotation.z()));
        
        Local<Array> transform = Array::New(isolate, 16);
        for (int r = 0; r < 4; ++r) {
            for (int c = 0; c < 4; ++c) {
                transform->Set(r * 4 + c, Number::New(isolate, pose.transform(r, c)));
            }
        }
        
        poseObj->Set(String::NewFromUtf8(isolate, "position"), position);
        poseObj->Set(String::NewFromUtf8(isolate, "quaternion"), quaternion);
        poseObj->Set(String::NewFromUtf8(isolate, "transform"), transform);
        poseObj->Set(String::NewFromUtf8(isolate, "frameIndex"), Number::New(isolate, pose.frameIndex));
        poseObj->Set(String::NewFromUtf8(isolate, "timestamp"), Number::New(isolate, pose.timestamp));
        
        trajectory->Set(i, poseObj);
    }
    resultObj->Set(String::NewFromUtf8(isolate, "cameraTrajectory"), trajectory);
    
    resultObj->Set(String::NewFromUtf8(isolate, "fusedModel"),
                   createPointCloudObject(isolate, result.fusedModel));
    
    Local<Array> registeredFrames = Array::New(isolate, result.registeredFrames.size());
    for (size_t i = 0; i < result.registeredFrames.size(); ++i) {
        registeredFrames->Set(i, createPointCloudObject(isolate, result.registeredFrames[i]));
    }
    resultObj->Set(String::NewFromUtf8(isolate, "registeredFrames"), registeredFrames);
    
    Local<Array> errors = Array::New(isolate, result.frameRegistrationErrors.size());
    for (size_t i = 0; i < result.frameRegistrationErrors.size(); ++i) {
        errors->Set(i, Number::New(isolate, result.frameRegistrationErrors[i]));
    }
    resultObj->Set(String::NewFromUtf8(isolate, "frameErrors"), errors);
    
    temporalProgressCallback.Reset();
    
    args.GetReturnValue().Set(resultObj);
}

void evaluateRegistrationQuality(const Nan::FunctionCallbackInfo<Value>& args) {
    Isolate* isolate = args.GetIsolate();
    
    if (args.Length() < 2) {
        Nan::ThrowTypeError("Requires source and target point cloud data");
        return;
    }
    
    Local<Object> sourceObj = args[0]->ToObject(isolate->GetCurrentContext()).ToLocalChecked();
    Local<Object> targetObj = args[1]->ToObject(isolate->GetCurrentContext()).ToLocalChecked();
    
    PointCloud source, target;
    parsePointCloud(sourceObj, source);
    parsePointCloud(targetObj, target);
    
    double outlierThreshold = 3.0;
    if (args.Length() > 2) {
        outlierThreshold = args[2]->NumberValue(isolate->GetCurrentContext()).ToChecked();
    }
    
    QualityEvaluator evaluator;
    RegistrationStatistics stats = evaluator.evaluateRegistration(
        source, target, outlierThreshold, 50
    );
    
    Local<Object> resultObj = Object::New(isolate);
    
    resultObj->Set(String::NewFromUtf8(isolate, "totalPoints"), 
                   Number::New(isolate, stats.totalPoints));
    resultObj->Set(String::NewFromUtf8(isolate, "validCorrespondences"), 
                   Number::New(isolate, stats.validCorrespondences));
    resultObj->Set(String::NewFromUtf8(isolate, "overlapRatio"), 
                   Number::New(isolate, stats.overlapRatio));
    
    resultObj->Set(String::NewFromUtf8(isolate, "meanError"), 
                   Number::New(isolate, stats.meanError));
    resultObj->Set(String::NewFromUtf8(isolate, "medianError"), 
                   Number::New(isolate, stats.medianError));
    resultObj->Set(String::NewFromUtf8(isolate, "rmse"), 
                   Number::New(isolate, stats.rmse));
    resultObj->Set(String::NewFromUtf8(isolate, "stdDev"), 
                   Number::New(isolate, stats.stdDev));
    resultObj->Set(String::NewFromUtf8(isolate, "minError"), 
                   Number::New(isolate, stats.minError));
    resultObj->Set(String::NewFromUtf8(isolate, "maxError"), 
                   Number::New(isolate, stats.maxError));
    
    resultObj->Set(String::NewFromUtf8(isolate, "q25"), 
                   Number::New(isolate, stats.q25));
    resultObj->Set(String::NewFromUtf8(isolate, "q75"), 
                   Number::New(isolate, stats.q75));
    resultObj->Set(String::NewFromUtf8(isolate, "q95"), 
                   Number::New(isolate, stats.q95));
    resultObj->Set(String::NewFromUtf8(isolate, "q99"), 
                   Number::New(isolate, stats.q99));
    
    resultObj->Set(String::NewFromUtf8(isolate, "outlierCount"), 
                   Number::New(isolate, stats.outlierCount));
    resultObj->Set(String::NewFromUtf8(isolate, "outlierRatio"), 
                   Number::New(isolate, stats.outlierRatio));
    
    Local<Array> histogramBins = Array::New(isolate, stats.histogramBins.size());
    Local<Array> histogramCounts = Array::New(isolate, stats.histogramCounts.size());
    for (size_t i = 0; i < stats.histogramBins.size(); ++i) {
        histogramBins->Set(i, Number::New(isolate, stats.histogramBins[i]));
        histogramCounts->Set(i, Number::New(isolate, stats.histogramCounts[i]));
    }
    resultObj->Set(String::NewFromUtf8(isolate, "histogramBins"), histogramBins);
    resultObj->Set(String::NewFromUtf8(isolate, "histogramCounts"), histogramCounts);
    
    args.GetReturnValue().Set(resultObj);
}

void Init(Local<Object> exports) {
    exports->Set(String::NewFromUtf8(Isolate::GetCurrent(), "readPLY"),
                 FunctionTemplate::New(Isolate::GetCurrent(), readPLY)->GetFunction());
    exports->Set(String::NewFromUtf8(Isolate::GetCurrent(), "writePLY"),
                 FunctionTemplate::New(Isolate::GetCurrent(), writePLY)->GetFunction());
    exports->Set(String::NewFromUtf8(Isolate::GetCurrent(), "voxelDownsample"),
                 FunctionTemplate::New(Isolate::GetCurrent(), voxelDownsample)->GetFunction());
    exports->Set(String::NewFromUtf8(Isolate::GetCurrent(), "registerPointClouds"),
                 FunctionTemplate::New(Isolate::GetCurrent(), registerPointClouds)->GetFunction());
    exports->Set(String::NewFromUtf8(Isolate::GetCurrent(), "registerTemporalSequence"),
                 FunctionTemplate::New(Isolate::GetCurrent(), registerTemporalSequence)->GetFunction());
    exports->Set(String::NewFromUtf8(Isolate::GetCurrent(), "evaluateRegistrationQuality"),
                 FunctionTemplate::New(Isolate::GetCurrent(), evaluateRegistrationQuality)->GetFunction());
}

NODE_MODULE(registration, Init)
