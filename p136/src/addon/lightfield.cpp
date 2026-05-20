#include "lightfield.h"
#include <iostream>
#include <algorithm>
#include <cstring>

LightFieldProcessor::LightFieldProcessor()
    : m_numViewsX(15), m_numViewsY(15), m_imageWidth(0), m_imageHeight(0), m_loaded(false), m_cancelFlag(false), m_poolInitialized(false) {}

LightFieldProcessor::~LightFieldProcessor() {
    releaseMemory();
}

void LightFieldProcessor::releaseMemory() {
    std::lock_guard<std::mutex> lock(m_mutex);
    for (auto& row : m_subApertureImages) {
        for (auto& img : row) {
            img.release();
        }
        row.clear();
    }
    m_subApertureImages.clear();
    
    for (auto& mat : m_resultPool) mat.release();
    for (auto& mat : m_weightPool) mat.release();
    m_resultPool.clear();
    m_weightPool.clear();
    m_poolInitialized = false;
    
    m_loaded = false;
}

void LightFieldProcessor::cancelProcessing() {
    m_cancelFlag = true;
}

bool LightFieldProcessor::loadLightField(const std::string& path, int numViewsX, int numViewsY) {
    std::lock_guard<std::mutex> lock(m_mutex);
    releaseMemory();
    m_cancelFlag = false;

    m_numViewsX = numViewsX;
    m_numViewsY = numViewsY;

    cv::Mat rawImage = cv::imread(path, cv::IMREAD_COLOR);
    if (rawImage.empty()) {
        return false;
    }

    extractSubApertureImages(rawImage);
    rawImage.release();

    m_loaded = !m_subApertureImages.empty();
    return m_loaded;
}

void LightFieldProcessor::extractSubApertureImages(const cv::Mat& rawImage) {
    int rawWidth = rawImage.cols;
    int rawHeight = rawImage.rows;

    m_imageWidth = rawWidth / m_numViewsX;
    m_imageHeight = rawHeight / m_numViewsY;

    m_subApertureImages.resize(m_numViewsY);
    for (int v = 0; v < m_numViewsY; v++) {
        m_subApertureImages[v].resize(m_numViewsX);
        for (int u = 0; u < m_numViewsX; u++) {
            cv::Mat subImg(m_imageHeight, m_imageWidth, rawImage.type());
            for (int y = 0; y < m_imageHeight; y++) {
                for (int x = 0; x < m_imageWidth; x++) {
                    int srcX = x * m_numViewsX + u;
                    int srcY = y * m_numViewsY + v;
                    if (srcX < rawWidth && srcY < rawHeight) {
                        subImg.at<cv::Vec3b>(y, x) = rawImage.at<cv::Vec3b>(srcY, srcX);
                    }
                }
            }
            m_subApertureImages[v][u] = subImg;
        }
    }
}

cv::Mat LightFieldProcessor::shiftImage(const cv::Mat& img, float dx, float dy) {
    cv::Mat result;
    {
        cv::Mat mapX(img.size(), CV_32F);
        cv::Mat mapY(img.size(), CV_32F);

        for (int y = 0; y < img.rows; y++) {
            float* mapXRow = mapX.ptr<float>(y);
            float* mapYRow = mapY.ptr<float>(y);
            for (int x = 0; x < img.cols; x++) {
                mapXRow[x] = x + dx;
                mapYRow[x] = y + dy;
            }
        }

        cv::remap(img, result, mapX, mapY, cv::INTER_LINEAR, cv::BORDER_CONSTANT, cv::Scalar(0, 0, 0));
        mapX.release();
        mapY.release();
    }
    return result;
}

cv::Mat LightFieldProcessor::refocus(float focusDepth, float aperture) {
    std::lock_guard<std::mutex> lock(m_mutex);
    return refocusInternal(focusDepth, aperture, true);
}

cv::Mat LightFieldProcessor::refocusInternal(float focusDepth, float aperture, bool alreadyLocked) {
    if (!m_loaded) return cv::Mat();

    m_cancelFlag = false;

    int numThreads = std::thread::hardware_concurrency();
    int rowsPerThread = m_imageHeight / numThreads;

    if (!m_poolInitialized) {
        m_resultPool.resize(numThreads);
        m_weightPool.resize(numThreads);
        for (int i = 0; i < numThreads; i++) {
            m_resultPool[i] = cv::Mat::zeros(m_imageHeight, m_imageWidth, CV_32FC3);
            m_weightPool[i] = cv::Mat::zeros(m_imageHeight, m_imageWidth, CV_32F);
        }
        m_poolInitialized = true;
    }

    for (int i = 0; i < numThreads; i++) {
        m_resultPool[i].setTo(cv::Scalar::all(0));
        m_weightPool[i].setTo(cv::Scalar::all(0));
    }

    cv::Mat result = cv::Mat::zeros(m_imageHeight, m_imageWidth, CV_32FC3);
    cv::Mat weightSum = cv::Mat::zeros(m_imageHeight, m_imageWidth, CV_32F);

    int centerU = m_numViewsX / 2;
    int centerV = m_numViewsY / 2;
    int halfAperture = static_cast<int>(std::floor(aperture * m_numViewsX / 2));

    std::vector<std::thread> threads;

    auto processBlock = [&](int threadId, int startY, int endY) {
        cv::Mat& localResult = m_resultPool[threadId];
        cv::Mat& localWeight = m_weightPool[threadId];

        for (int v = std::max(0, centerV - halfAperture); v <= std::min(m_numViewsY - 1, centerV + halfAperture) && !m_cancelFlag; v++) {
            for (int u = std::max(0, centerU - halfAperture); u <= std::min(m_numViewsX - 1, centerU + halfAperture) && !m_cancelFlag; u++) {
                float du = (u - centerU) * focusDepth;
                float dv = (v - centerV) * focusDepth;

                {
                    cv::Mat shifted = shiftImage(m_subApertureImages[v][u], du, dv);
                    cv::Mat shiftedFloat;
                    shifted.convertTo(shiftedFloat, CV_32FC3);
                    shifted.release();

                    for (int y = startY; y < endY && !m_cancelFlag; y++) {
                        cv::Vec3f* shiftedRow = shiftedFloat.ptr<cv::Vec3f>(y);
                        cv::Vec3f* resultRow = localResult.ptr<cv::Vec3f>(y);
                        float* weightRow = localWeight.ptr<float>(y);

                        for (int x = 0; x < m_imageWidth && !m_cancelFlag; x++) {
                            cv::Vec3f pixel = shiftedRow[x];
                            if (pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0) {
                                resultRow[x] += pixel;
                                weightRow[x] += 1.0f;
                            }
                        }
                    }
                    shiftedFloat.release();
                }
            }
        }
    };

    for (int i = 0; i < numThreads; i++) {
        int startY = i * rowsPerThread;
        int endY = (i == numThreads - 1) ? m_imageHeight : (i + 1) * rowsPerThread;
        threads.emplace_back(processBlock, i, startY, endY);
    }

    for (auto& t : threads) {
        t.join();
    }

    if (m_cancelFlag) {
        result.release();
        weightSum.release();
        return cv::Mat();
    }

    for (int i = 0; i < numThreads; i++) {
        result += m_resultPool[i];
        weightSum += m_weightPool[i];
    }

    for (int y = 0; y < m_imageHeight; y++) {
        cv::Vec3f* resultRow = result.ptr<cv::Vec3f>(y);
        float* weightRow = weightSum.ptr<float>(y);
        for (int x = 0; x < m_imageWidth; x++) {
            if (weightRow[x] > 0) {
                resultRow[x] /= weightRow[x];
            }
        }
    }

    weightSum.release();

    cv::Mat finalResult;
    result.convertTo(finalResult, CV_8UC3);
    result.release();

    return finalResult;
}

cv::Mat LightFieldProcessor::computeAllInFocus() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!m_loaded) return cv::Mat();

    m_cancelFlag = false;

    cv::Mat allInFocus(m_imageHeight, m_imageWidth, CV_8UC3);
    cv::Mat maxSharpness = cv::Mat::zeros(m_imageHeight, m_imageWidth, CV_32F);

    int numDepths = 20;
    float minDepth = -2.0f;
    float maxDepth = 2.0f;

    for (int d = 0; d < numDepths && !m_cancelFlag; d++) {
        float depth = minDepth + (maxDepth - minDepth) * d / (numDepths - 1);
        cv::Mat refocused = refocusInternal(depth, 1.0f, true);

        if (refocused.empty()) continue;

        cv::Mat gray, laplacian;
        cv::cvtColor(refocused, gray, cv::COLOR_BGR2GRAY);
        cv::Laplacian(gray, laplacian, CV_32F, 3);
        cv::Mat sharpness;
        cv::convertScaleAbs(laplacian, sharpness);

        for (int y = 0; y < m_imageHeight && !m_cancelFlag; y++) {
            uchar* sharpnessRow = sharpness.ptr<uchar>(y);
            float* maxSharpnessRow = maxSharpness.ptr<float>(y);
            cv::Vec3b* allInFocusRow = allInFocus.ptr<cv::Vec3b>(y);
            cv::Vec3b* refocusedRow = refocused.ptr<cv::Vec3b>(y);

            for (int x = 0; x < m_imageWidth && !m_cancelFlag; x++) {
                float s = sharpnessRow[x];
                if (s > maxSharpnessRow[x]) {
                    maxSharpnessRow[x] = s;
                    allInFocusRow[x] = refocusedRow[x];
                }
            }
        }

        refocused.release();
        gray.release();
        laplacian.release();
        sharpness.release();
    }

    maxSharpness.release();

    return allInFocus;
}

float LightFieldProcessor::computeVariance(const cv::Mat& img, int x, int y, int windowSize) {
    int half = windowSize / 2;
    float sum = 0, sumSq = 0;
    int count = 0;

    for (int dy = -half; dy <= half; dy++) {
        int ny = y + dy;
        if (ny < 0 || ny >= img.rows) continue;
        const float* row = img.ptr<float>(ny);

        for (int dx = -half; dx <= half; dx++) {
            int nx = x + dx;
            if (nx >= 0 && nx < img.cols) {
                float val = row[nx];
                sum += val;
                sumSq += val * val;
                count++;
            }
        }
    }

    if (count == 0) return 0;
    float mean = sum / count;
    return (sumSq / count) - mean * mean;
}

void LightFieldProcessor::processDepthRow(int y, cv::Mat& depthMap, cv::Mat& confidenceMap) {
    int numDepths = 20;
    float minDepth = -2.0f;
    float maxDepth = 2.0f;

    std::vector<cv::Mat> grayImages(numDepths);

    for (int d = 0; d < numDepths && !m_cancelFlag; d++) {
        float depth = minDepth + (maxDepth - minDepth) * d / (numDepths - 1);
        cv::Mat refocused = refocusInternal(depth, 1.0f, true);
        if (refocused.empty()) {
            grayImages[d] = cv::Mat();
            continue;
        }
        cv::cvtColor(refocused, grayImages[d], cv::COLOR_BGR2GRAY);
        grayImages[d].convertTo(grayImages[d], CV_32F);
        refocused.release();
    }

    for (int x = 0; x < m_imageWidth && !m_cancelFlag; x++) {
        float maxVariance = 0;
        float bestDepth = 0;

        for (int d = 0; d < numDepths && !m_cancelFlag; d++) {
            if (grayImages[d].empty()) continue;

            float depth = minDepth + (maxDepth - minDepth) * d / (numDepths - 1);
            float variance = computeVariance(grayImages[d], x, y, DEPTH_WINDOW_SIZE);

            if (variance > maxVariance) {
                maxVariance = variance;
                bestDepth = depth;
            }
        }

        depthMap.at<float>(y, x) = bestDepth;
        confidenceMap.at<float>(y, x) = maxVariance;
    }

    for (auto& img : grayImages) {
        img.release();
    }
}

cv::Mat LightFieldProcessor::inpaintDepthMap(const cv::Mat& depthMap) {
    cv::Mat grayImage;
    if (!m_subApertureImages.empty()) {
        int centerV = m_numViewsY / 2;
        int centerU = m_numViewsX / 2;
        cv::cvtColor(m_subApertureImages[centerV][centerU], grayImage, cv::COLOR_BGR2GRAY);
    }

    cv::Mat normalizedDepth;
    cv::normalize(depthMap, normalizedDepth, 0, 255, cv::NORM_MINMAX, CV_8U);

    cv::Mat mask = cv::Mat::zeros(depthMap.size(), CV_8U);
    cv::Mat confidence = cv::Mat::zeros(depthMap.size(), CV_32F);

    for (int y = 0; y < depthMap.rows; y++) {
        const float* depthRow = depthMap.ptr<float>(y);
        uchar* maskRow = mask.ptr<uchar>(y);
        float* confRow = confidence.ptr<float>(y);

        for (int x = 0; x < depthMap.cols; x++) {
            float centerDepth = depthRow[x];
            float sumWeights = 0;
            float weightedDepth = 0;

            for (int dy = -3; dy <= 3; dy++) {
                int ny = y + dy;
                if (ny < 0 || ny >= depthMap.rows) continue;
                const float* nRow = depthMap.ptr<float>(ny);

                for (int dx = -3; dx <= 3; dx++) {
                    int nx = x + dx;
                    if (nx >= 0 && nx < depthMap.cols) {
                        float d = nRow[nx];
                        float spatialDist = std::sqrt((float)(dx*dx + dy*dy));
                        float weight = std::exp(-spatialDist / 3.0f);
                        
                        if (std::abs(d - centerDepth) < 0.5f) {
                            weightedDepth += d * weight;
                            sumWeights += weight;
                        }
                    }
                }
            }

            if (sumWeights > 0) {
                float filteredDepth = weightedDepth / sumWeights;
                float diff = std::abs(filteredDepth - centerDepth);
                
                if (!grayImage.empty()) {
                    uchar intensity = grayImage.at<uchar>(y, x);
                    float texture = 0;
                    for (int dy = -1; dy <= 1; dy++) {
                        for (int dx = -1; dx <= 1; dx++) {
                            int ny = y + dy, nx = x + dx;
                            if (ny >= 0 && ny < depthMap.rows && nx >= 0 && nx < depthMap.cols) {
                                texture += std::abs(grayImage.at<uchar>(ny, nx) - intensity);
                            }
                        }
                    }
                    confRow[x] = texture / 8.0f;
                }

                if (diff > 0.3f || centerDepth == 0 || (confRow[x] < 10.0f && !grayImage.empty())) {
                    maskRow[x] = 255;
                }
            } else {
                maskRow[x] = 255;
            }
        }
    }

    cv::Mat dilatedMask;
    cv::dilate(mask, dilatedMask, cv::getStructuringElement(cv::MORPH_ELLIPSE, cv::Size(5, 5)));

    cv::Mat inpainted;
    if (!grayImage.empty()) {
        cv::Mat blended;
        cv::cvtColor(normalizedDepth, blended, cv::COLOR_GRAY2BGR);
        cv::Mat colorMask;
        cv::cvtColor(dilatedMask, colorMask, cv::COLOR_GRAY2BGR);
        cv::inpaint(blended, colorMask, inpainted, 7, cv::INPAINT_NS);
        cv::cvtColor(inpainted, inpainted, cv::COLOR_BGR2GRAY);
    } else {
        cv::inpaint(normalizedDepth, dilatedMask, inpainted, 7, cv::INPAINT_TELEA);
    }

    cv::Mat result;
    inpainted.convertTo(result, CV_32F);

    double minVal, maxVal;
    cv::minMaxLoc(depthMap, &minVal, &maxVal);
    cv::normalize(result, result, minVal, maxVal, cv::NORM_MINMAX);

    cv::Mat smoothed;
    cv::Mat guide;
    if (!grayImage.empty()) {
        grayImage.convertTo(guide, CV_32F);
    } else {
        result.copyTo(guide);
    }
    cv::bilateralFilter(result, smoothed, 11, 50, 50);

    cv::Mat finalDepth;
    smoothed.copyTo(finalDepth, 255 - dilatedMask);
    for (int y = 0; y < depthMap.rows; y++) {
        for (int x = 0; x < depthMap.cols; x++) {
            if (dilatedMask.at<uchar>(y, x) == 0) {
                finalDepth.at<float>(y, x) = 0.8f * depthMap.at<float>(y, x) + 0.2f * smoothed.at<float>(y, x);
            }
        }
    }

    normalizedDepth.release();
    mask.release();
    dilatedMask.release();
    inpainted.release();
    result.release();
    smoothed.release();
    confidence.release();
    grayImage.release();
    guide.release();

    return finalDepth;
}

cv::Mat LightFieldProcessor::computeDepthMap() {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!m_loaded) return cv::Mat();

    m_cancelFlag = false;

    cv::Mat depthMap(m_imageHeight, m_imageWidth, CV_32F);
    cv::Mat confidenceMap(m_imageHeight, m_imageWidth, CV_32F);

    int numThreads = std::thread::hardware_concurrency();
    std::vector<std::thread> threads;

    int rowsPerThread = m_imageHeight / numThreads;

    for (int i = 0; i < numThreads && !m_cancelFlag; i++) {
        int startY = i * rowsPerThread;
        int endY = (i == numThreads - 1) ? m_imageHeight : (i + 1) * rowsPerThread;

        threads.emplace_back([&](int start, int end) {
            for (int y = start; y < end && !m_cancelFlag; y++) {
                processDepthRow(y, depthMap, confidenceMap);
            }
        }, startY, endY);
    }

    for (auto& t : threads) {
        t.join();
    }

    if (m_cancelFlag) {
        depthMap.release();
        confidenceMap.release();
        return cv::Mat();
    }

    confidenceMap.release();

    cv::Mat filledDepth = inpaintDepthMap(depthMap);
    depthMap.release();

    return filledDepth;
}

Napi::FunctionReference LightFieldAddon::constructor;

Napi::Object LightFieldAddon::Init(Napi::Env env, Napi::Object exports) {
    Napi::HandleScope scope(env);

    Napi::Function func = DefineClass(env, "LightFieldProcessor", {
        InstanceMethod("loadLightField", &LightFieldAddon::LoadLightField),
        InstanceMethod("refocus", &LightFieldAddon::Refocus),
        InstanceMethod("computeAllInFocus", &LightFieldAddon::ComputeAllInFocus),
        InstanceMethod("computeDepthMap", &LightFieldAddon::ComputeDepthMap),
        InstanceMethod("generatePointCloud", &LightFieldAddon::GeneratePointCloud),
        InstanceMethod("estimateFocusDepth", &LightFieldAddon::EstimateFocusDepth),
        InstanceMethod("cancelProcessing", &LightFieldAddon::CancelProcessing),
        InstanceMethod("releaseMemory", &LightFieldAddon::ReleaseMemory),
        InstanceMethod("getDimensions", &LightFieldAddon::GetDimensions)
    });

    constructor = Napi::Persistent(func);
    constructor.SuppressDestruct();

    exports.Set("LightFieldProcessor", func);
    return exports;
}

LightFieldAddon::LightFieldAddon(const Napi::CallbackInfo& info)
    : Napi::ObjectWrap<LightFieldAddon>(info) {
    m_processor = std::make_unique<LightFieldProcessor>();
}

Napi::Value LightFieldAddon::LoadLightField(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsString()) {
        Napi::TypeError::New(env, "String expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    std::string path = info[0].As<Napi::String>();
    int numViewsX = info.Length() > 1 && info[1].IsNumber() ? info[1].As<Napi::Number>().Int32Value() : 15;
    int numViewsY = info.Length() > 2 && info[2].IsNumber() ? info[2].As<Napi::Number>().Int32Value() : 15;

    bool success = m_processor->loadLightField(path, numViewsX, numViewsY);
    return Napi::Boolean::New(env, success);
}

Napi::Value LightFieldAddon::Refocus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1 || !info[0].IsNumber()) {
        Napi::TypeError::New(env, "Number expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    float focusDepth = info[0].As<Napi::Number>().FloatValue();
    float aperture = info.Length() > 1 && info[1].IsNumber() ? info[1].As<Napi::Number>().FloatValue() : 1.0f;

    cv::Mat result = m_processor->refocus(focusDepth, aperture);

    if (result.empty()) {
        return env.Null();
    }

    size_t dataSize = result.total() * result.elemSize();
    uchar* copiedData = new uchar[dataSize];
    std::memcpy(copiedData, result.data, dataSize);

    Napi::Buffer<uchar> buffer = Napi::Buffer<uchar>::New(env, copiedData, dataSize,
        [](Napi::Env env, uchar* data) {
            delete[] data;
        });

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("width", result.cols);
    obj.Set("height", result.rows);
    obj.Set("channels", result.channels());
    obj.Set("data", buffer);

    return obj;
}

Napi::Value LightFieldAddon::ComputeAllInFocus(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    cv::Mat result = m_processor->computeAllInFocus();

    if (result.empty()) {
        return env.Null();
    }

    size_t dataSize = result.total() * result.elemSize();
    uchar* copiedData = new uchar[dataSize];
    std::memcpy(copiedData, result.data, dataSize);

    Napi::Buffer<uchar> buffer = Napi::Buffer<uchar>::New(env, copiedData, dataSize,
        [](Napi::Env env, uchar* data) {
            delete[] data;
        });

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("width", result.cols);
    obj.Set("height", result.rows);
    obj.Set("channels", result.channels());
    obj.Set("data", buffer);

    return obj;
}

Napi::Value LightFieldAddon::ComputeDepthMap(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    cv::Mat result = m_processor->computeDepthMap();

    if (result.empty()) {
        return env.Null();
    }

    cv::Mat normalized;
    cv::normalize(result, normalized, 0, 255, cv::NORM_MINMAX, CV_8U);
    cv::cvtColor(normalized, normalized, cv::COLOR_GRAY2BGR);

    size_t dataSize = normalized.total() * normalized.elemSize();
    uchar* copiedData = new uchar[dataSize];
    std::memcpy(copiedData, normalized.data, dataSize);

    Napi::Buffer<uchar> buffer = Napi::Buffer<uchar>::New(env, copiedData, dataSize,
        [](Napi::Env env, uchar* data) {
            delete[] data;
        });

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("width", normalized.cols);
    obj.Set("height", normalized.rows);
    obj.Set("channels", normalized.channels());
    obj.Set("data", buffer);

    result.release();
    normalized.release();

    return obj;
}

std::vector<LightFieldProcessor::Point3D> LightFieldProcessor::generatePointCloud(float fx, float fy, float cx, float cy) {
    std::lock_guard<std::mutex> lock(m_mutex);
    std::vector<Point3D> pointCloud;

    if (!m_loaded) return pointCloud;

    cv::Mat depthMap = computeDepthMap();
    if (depthMap.empty()) return pointCloud;

    cv::Mat colorImage = refocusInternal(0.0f, 1.0f, true);

    if (cx < 0) cx = m_imageWidth / 2.0f;
    if (cy < 0) cy = m_imageHeight / 2.0f;

    float minDepth, maxDepth;
    cv::minMaxLoc(depthMap, &minDepth, &maxDepth);

    for (int y = 0; y < m_imageHeight && !m_cancelFlag; y++) {
        for (int x = 0; x < m_imageWidth && !m_cancelFlag; x++) {
            float z = depthMap.at<float>(y, x);
            
            if (std::isnan(z) || std::isinf(z) || z == 0) continue;
            
            float normalizedZ = (z - minDepth) / (maxDepth - minDepth + 1e-6f);
            normalizedZ = normalizedZ * 10.0f + 0.1f;
            
            float x3d = (x - cx) * normalizedZ / fx;
            float y3d = (y - cy) * normalizedZ / fy;
            
            cv::Vec3b color = colorImage.at<cv::Vec3b>(y, x);
            
            pointCloud.emplace_back(x3d, y3d, normalizedZ, color[2], color[1], color[0]);
        }
    }

    depthMap.release();
    colorImage.release();

    return pointCloud;
}

float LightFieldProcessor::getDepthAtPoint(int x, int y) {
    if (!m_loaded) return 0.0f;
    if (x < 0 || x >= m_imageWidth || y < 0 || y >= m_imageHeight) return 0.0f;
    
    cv::Mat depthMap = computeDepthMap();
    if (depthMap.empty()) return 0.0f;
    
    float depth = depthMap.at<float>(y, x);
    depthMap.release();
    
    return depth;
}

float LightFieldProcessor::estimateFocusDepth(int x, int y, int windowSize) {
    std::lock_guard<std::mutex> lock(m_mutex);
    if (!m_loaded) return 0.0f;

    int halfWindow = windowSize / 2;
    int startX = std::max(0, x - halfWindow);
    int startY = std::max(0, y - halfWindow);
    int endX = std::min(m_imageWidth - 1, x + halfWindow);
    int endY = std::min(m_imageHeight - 1, y + halfWindow);

    int numDepths = 40;
    float minDepth = -2.0f;
    float maxDepth = 2.0f;
    float bestDepth = 0.0f;
    float maxSharpness = 0.0f;

    for (int d = 0; d < numDepths && !m_cancelFlag; d++) {
        float depth = minDepth + (maxDepth - minDepth) * d / (numDepths - 1);
        cv::Mat refocused = refocusInternal(depth, 1.0f, true);
        
        if (refocused.empty()) continue;

        cv::Mat gray;
        cv::cvtColor(refocused, gray, cv::COLOR_BGR2GRAY);
        
        cv::Mat laplacian;
        cv::Laplacian(gray, laplacian, CV_32F, 3);
        
        cv::Mat absLap;
        cv::convertScaleAbs(laplacian, absLap);
        
        float avgSharpness = 0.0f;
        int count = 0;
        for (int py = startY; py <= endY && !m_cancelFlag; py++) {
            for (int px = startX; px <= endX && !m_cancelFlag; px++) {
                avgSharpness += absLap.at<uchar>(py, px);
                count++;
            }
        }
        
        if (count > 0) {
            avgSharpness /= count;
            if (avgSharpness > maxSharpness) {
                maxSharpness = avgSharpness;
                bestDepth = depth;
            }
        }

        refocused.release();
        gray.release();
        laplacian.release();
        absLap.release();
    }

    return bestDepth;
}

Napi::Value LightFieldAddon::GeneratePointCloud(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    float fx = info.Length() > 0 && info[0].IsNumber() ? info[0].As<Napi::Number>().FloatValue() : 500.0f;
    float fy = info.Length() > 1 && info[1].IsNumber() ? info[1].As<Napi::Number>().FloatValue() : 500.0f;
    float cx = info.Length() > 2 && info[2].IsNumber() ? info[2].As<Napi::Number>().FloatValue() : -1.0f;
    float cy = info.Length() > 3 && info[3].IsNumber() ? info[3].As<Napi::Number>().FloatValue() : -1.0f;

    std::vector<LightFieldProcessor::Point3D> pointCloud = m_processor->generatePointCloud(fx, fy, cx, cy);

    Napi::Array result = Napi::Array::New(env, pointCloud.size());
    
    for (size_t i = 0; i < pointCloud.size(); i++) {
        Napi::Object point = Napi::Object::New(env);
        point.Set("x", pointCloud[i].x);
        point.Set("y", pointCloud[i].y);
        point.Set("z", pointCloud[i].z);
        point.Set("r", pointCloud[i].r);
        point.Set("g", pointCloud[i].g);
        point.Set("b", pointCloud[i].b);
        result.Set(i, point);
    }

    return result;
}

Napi::Value LightFieldAddon::EstimateFocusDepth(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    
    if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber()) {
        Napi::TypeError::New(env, "Numbers expected for x and y").ThrowAsJavaScriptException();
        return env.Null();
    }

    int x = info[0].As<Napi::Number>().Int32Value();
    int y = info[1].As<Napi::Number>().Int32Value();
    int windowSize = info.Length() > 2 && info[2].IsNumber() ? info[2].As<Napi::Number>().Int32Value() : 31;

    float depth = m_processor->estimateFocusDepth(x, y, windowSize);

    return Napi::Number::New(env, depth);
}

Napi::Value LightFieldAddon::CancelProcessing(const Napi::CallbackInfo& info) {
    m_processor->cancelProcessing();
    return info.Env().Undefined();
}

Napi::Value LightFieldAddon::ReleaseMemory(const Napi::CallbackInfo& info) {
    m_processor->releaseMemory();
    return info.Env().Undefined();
}

Napi::Value LightFieldAddon::GetDimensions(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("width", m_processor->getWidth());
    obj.Set("height", m_processor->getHeight());
    obj.Set("numViewsX", m_processor->getNumViewsX());
    obj.Set("numViewsY", m_processor->getNumViewsY());
    obj.Set("loaded", m_processor->isLoaded());
    return obj;
}

Napi::Object InitAll(Napi::Env env, Napi::Object exports) {
    return LightFieldAddon::Init(env, exports);
}

NODE_API_MODULE(lightfield_addon, InitAll)
