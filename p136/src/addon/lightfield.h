#ifndef LIGHTFIELD_H
#define LIGHTFIELD_H

#include <napi.h>
#include <opencv2/opencv.hpp>
#include <vector>
#include <thread>
#include <mutex>
#include <atomic>
#include <memory>

class LightFieldProcessor {
public:
    LightFieldProcessor();
    ~LightFieldProcessor();

    bool loadLightField(const std::string& path, int numViewsX = 15, int numViewsY = 15);
    cv::Mat refocus(float focusDepth, float aperture = 1.0f);
    cv::Mat computeAllInFocus();
    cv::Mat computeDepthMap();
    void cancelProcessing();
    void releaseMemory();
    
    struct Point3D {
        float x, y, z;
        uint8_t r, g, b;
        Point3D(float x_, float y_, float z_, uint8_t r_, uint8_t g_, uint8_t b_)
            : x(x_), y(y_), z(z_), r(r_), g(g_), b(b_) {}
    };
    
    std::vector<Point3D> generatePointCloud(float fx = 500.0f, float fy = 500.0f, float cx = -1, float cy = -1);
    float getDepthAtPoint(int x, int y);
    float estimateFocusDepth(int x, int y, int windowSize = 31);

private:
    cv::Mat refocusInternal(float focusDepth, float aperture, bool alreadyLocked = false);

    int getWidth() const { return m_imageWidth; }
    int getHeight() const { return m_imageHeight; }
    int getNumViewsX() const { return m_numViewsX; }
    int getNumViewsY() const { return m_numViewsY; }
    bool isLoaded() const { return m_loaded; }

private:
    void extractSubApertureImages(const cv::Mat& rawImage);
    cv::Mat shiftImage(const cv::Mat& img, float dx, float dy);
    float computeVariance(const cv::Mat& img, int x, int y, int windowSize = 7);
    cv::Mat inpaintDepthMap(const cv::Mat& depthMap);
    void processDepthRow(int y, cv::Mat& depthMap, cv::Mat& confidenceMap);

    std::vector<std::vector<cv::Mat>> m_subApertureImages;
    std::vector<cv::Mat> m_resultPool;
    std::vector<cv::Mat> m_weightPool;
    int m_numViewsX;
    int m_numViewsY;
    int m_imageWidth;
    int m_imageHeight;
    bool m_loaded;
    std::atomic<bool> m_cancelFlag;
    std::mutex m_mutex;
    bool m_poolInitialized;

    static constexpr int DEPTH_WINDOW_SIZE = 7;
    static constexpr float CONFIDENCE_THRESHOLD = 0.001f;
};

class LightFieldAddon : public Napi::ObjectWrap<LightFieldAddon> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports);
    LightFieldAddon(const Napi::CallbackInfo& info);

private:
    Napi::Value LoadLightField(const Napi::CallbackInfo& info);
    Napi::Value Refocus(const Napi::CallbackInfo& info);
    Napi::Value ComputeAllInFocus(const Napi::CallbackInfo& info);
    Napi::Value ComputeDepthMap(const Napi::CallbackInfo& info);
    Napi::Value GeneratePointCloud(const Napi::CallbackInfo& info);
    Napi::Value EstimateFocusDepth(const Napi::CallbackInfo& info);
    Napi::Value CancelProcessing(const Napi::CallbackInfo& info);
    Napi::Value ReleaseMemory(const Napi::CallbackInfo& info);
    Napi::Value GetDimensions(const Napi::CallbackInfo& info);

    static Napi::FunctionReference constructor;
    std::unique_ptr<LightFieldProcessor> m_processor;
};

#endif
