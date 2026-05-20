#include "quality_evaluation.h"
#include "kd_tree.h"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <sstream>
#include <iomanip>

QualityEvaluator::QualityEvaluator() {}

RegistrationStatistics QualityEvaluator::evaluateRegistration(
    const PointCloud& source,
    const PointCloud& target,
    double outlierThreshold,
    size_t histogramBins
) {
    RegistrationStatistics stats;
    stats.totalPoints = source.size();
    
    if (source.empty() || target.empty()) {
        return stats;
    }
    
    KDTree kdTree(&target);
    kdTree.build();
    
    std::vector<double> errors;
    errors.reserve(source.size());
    
    for (size_t i = 0; i < source.size(); ++i) {
        size_t nearestIdx = kdTree.nearest(source[i].xyz);
        if (nearestIdx < target.size()) {
            double dist = (source[i].xyz - target[nearestIdx].xyz).norm();
            errors.push_back(dist);
        }
    }
    
    stats.validCorrespondences = errors.size();
    stats.overlapRatio = static_cast<double>(errors.size()) / source.size();
    
    if (errors.empty()) {
        return stats;
    }
    
    stats.allErrors = errors;
    
    stats.meanError = std::accumulate(errors.begin(), errors.end(), 0.0) / errors.size();
    
    double sumSq = 0.0;
    for (double e : errors) {
        sumSq += e * e;
    }
    stats.rmse = std::sqrt(sumSq / errors.size());
    
    stats.stdDev = computeStdDev(errors, stats.meanError);
    
    std::vector<double> sortedErrors = errors;
    std::sort(sortedErrors.begin(), sortedErrors.end());
    
    stats.minError = sortedErrors.front();
    stats.maxError = sortedErrors.back();
    stats.medianError = computeMedian(sortedErrors);
    stats.q25 = computePercentile(sortedErrors, 0.25);
    stats.q75 = computePercentile(sortedErrors, 0.75);
    stats.q95 = computePercentile(sortedErrors, 0.95);
    stats.q99 = computePercentile(sortedErrors, 0.99);
    
    detectOutliers(errors, stats.outlierIndices, outlierThreshold);
    stats.outlierCount = stats.outlierIndices.size();
    stats.outlierRatio = static_cast<double>(stats.outlierCount) / errors.size();
    
    computeHistogram(errors, stats.histogramBins, stats.histogramCounts, histogramBins);
    
    return stats;
}

void QualityEvaluator::computeHistogram(
    const std::vector<double>& errors,
    std::vector<double>& bins,
    std::vector<size_t>& counts,
    size_t numBins
) {
    if (errors.empty()) {
        return;
    }
    
    double minErr = *std::min_element(errors.begin(), errors.end());
    double maxErr = *std::max_element(errors.begin(), errors.end());
    double range = maxErr - minErr;
    
    if (range < 1e-10) {
        range = 1e-10;
    }
    
    bins.resize(numBins);
    counts.resize(numBins, 0);
    
    double binWidth = range / numBins;
    for (size_t i = 0; i < numBins; ++i) {
        bins[i] = minErr + (i + 0.5) * binWidth;
    }
    
    for (double e : errors) {
        size_t binIdx = static_cast<size_t>(std::floor((e - minErr) / binWidth));
        binIdx = std::min(binIdx, numBins - 1);
        counts[binIdx]++;
    }
}

void QualityEvaluator::detectOutliers(
    const std::vector<double>& errors,
    std::vector<size_t>& outlierIndices,
    double threshold
) {
    if (errors.empty()) return;
    
    double mean = std::accumulate(errors.begin(), errors.end(), 0.0) / errors.size();
    double stdDev = computeStdDev(errors, mean);
    double outlierLimit = mean + threshold * stdDev;
    
    outlierIndices.clear();
    for (size_t i = 0; i < errors.size(); ++i) {
        if (errors[i] > outlierLimit) {
            outlierIndices.push_back(i);
        }
    }
}

double QualityEvaluator::computeMedian(std::vector<double> data) {
    if (data.empty()) return 0.0;
    
    size_t n = data.size();
    std::sort(data.begin(), data.end());
    
    if (n % 2 == 0) {
        return (data[n/2 - 1] + data[n/2]) / 2.0;
    } else {
        return data[n/2];
    }
}

double QualityEvaluator::computePercentile(std::vector<double> data, double percentile) {
    if (data.empty()) return 0.0;
    
    std::sort(data.begin(), data.end());
    
    double idx = percentile * (data.size() - 1);
    size_t lowerIdx = static_cast<size_t>(std::floor(idx));
    size_t upperIdx = static_cast<size_t>(std::ceil(idx));
    
    if (lowerIdx == upperIdx) {
        return data[lowerIdx];
    }
    
    double weight = idx - lowerIdx;
    return data[lowerIdx] * (1 - weight) + data[upperIdx] * weight;
}

double QualityEvaluator::computeStdDev(const std::vector<double>& data, double mean) {
    if (data.empty()) return 0.0;
    
    double sum = 0.0;
    for (double d : data) {
        sum += (d - mean) * (d - mean);
    }
    return std::sqrt(sum / data.size());
}

std::string QualityEvaluator::generateJSONReport(const RegistrationStatistics& stats) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(6);
    
    oss << "{\n";
    oss << "  \"summary\": {\n";
    oss << "    \"totalPoints\": " << stats.totalPoints << ",\n";
    oss << "    \"validCorrespondences\": " << stats.validCorrespondences << ",\n";
    oss << "    \"overlapRatio\": " << stats.overlapRatio << "\n";
    oss << "  },\n";
    
    oss << "  \"statistics\": {\n";
    oss << "    \"meanError\": " << stats.meanError << ",\n";
    oss << "    \"medianError\": " << stats.medianError << ",\n";
    oss << "    \"rmse\": " << stats.rmse << ",\n";
    oss << "    \"stdDev\": " << stats.stdDev << ",\n";
    oss << "    \"minError\": " << stats.minError << ",\n";
    oss << "    \"maxError\": " << stats.maxError << ",\n";
    oss << "    \"q25\": " << stats.q25 << ",\n";
    oss << "    \"q75\": " << stats.q75 << ",\n";
    oss << "    \"q95\": " << stats.q95 << ",\n";
    oss << "    \"q99\": " << stats.q99 << "\n";
    oss << "  },\n";
    
    oss << "  \"outliers\": {\n";
    oss << "    \"count\": " << stats.outlierCount << ",\n";
    oss << "    \"ratio\": " << stats.outlierRatio << "\n";
    oss << "  },\n";
    
    oss << "  \"histogram\": {\n";
    oss << "    \"bins\": [";
    for (size_t i = 0; i < stats.histogramBins.size(); ++i) {
        if (i > 0) oss << ", ";
        oss << stats.histogramBins[i];
    }
    oss << "],\n";
    
    oss << "    \"counts\": [";
    for (size_t i = 0; i < stats.histogramCounts.size(); ++i) {
        if (i > 0) oss << ", ";
        oss << stats.histogramCounts[i];
    }
    oss << "]\n";
    oss << "  }\n";
    oss << "}\n";
    
    return oss.str();
}
