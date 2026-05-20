#ifndef QUALITY_EVALUATION_H
#define QUALITY_EVALUATION_H

#include "point_cloud.h"
#include <vector>
#include <string>
#include <map>

struct RegistrationStatistics {
    size_t totalPoints;
    size_t validCorrespondences;
    double overlapRatio;
    
    double meanError;
    double medianError;
    double rmse;
    double stdDev;
    double minError;
    double maxError;
    
    double q25;
    double q75;
    double q95;
    double q99;
    
    size_t outlierCount;
    double outlierRatio;
    
    std::vector<double> histogram;
    std::vector<double> histogramBins;
    std::vector<size_t> histogramCounts;
    
    std::vector<size_t> outlierIndices;
    std::vector<double> allErrors;
    
    RegistrationStatistics()
        : totalPoints(0), validCorrespondences(0), overlapRatio(0.0),
          meanError(0.0), medianError(0.0), rmse(0.0), stdDev(0.0),
          minError(0.0), maxError(0.0), q25(0.0), q75(0.0), q95(0.0), q99(0.0),
          outlierCount(0), outlierRatio(0.0) {}
};

class QualityEvaluator {
public:
    QualityEvaluator();
    
    RegistrationStatistics evaluateRegistration(
        const PointCloud& source,
        const PointCloud& target,
        double outlierThreshold = 3.0,
        size_t histogramBins = 50
    );
    
    std::string generateJSONReport(const RegistrationStatistics& stats);
    
    void computeHistogram(const std::vector<double>& errors,
                          std::vector<double>& bins,
                          std::vector<size_t>& counts,
                          size_t numBins = 50);
    
    void detectOutliers(const std::vector<double>& errors,
                        std::vector<size_t>& outlierIndices,
                        double threshold = 3.0);
    
private:
    double computeMedian(std::vector<double> data);
    double computePercentile(std::vector<double> data, double percentile);
    double computeStdDev(const std::vector<double>& data, double mean);
};

#endif
