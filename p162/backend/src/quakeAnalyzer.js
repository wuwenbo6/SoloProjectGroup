const P_WAVE_VELOCITY = 5.0;

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const calculateWeightedCenter = (detections) => {
  if (detections.length === 0) return null;
  
  let totalWeight = 0;
  let weightedLat = 0;
  let weightedLon = 0;
  
  detections.forEach(d => {
    const weight = d.intensity * d.intensity;
    weightedLat += d.latitude * weight;
    weightedLon += d.longitude * weight;
    totalWeight += weight;
  });
  
  return {
    latitude: weightedLat / totalWeight,
    longitude: weightedLon / totalWeight
  };
};

const estimateMagnitude = (detections, epicenter) => {
  if (detections.length === 0) return 0;
  
  const attenuationFactor = 0.001;
  
  let totalMagnitude = 0;
  let count = 0;
  
  detections.forEach(d => {
    const distance = haversineDistance(
      epicenter.latitude, epicenter.longitude,
      d.latitude, d.longitude
    );
    
    const estimatedAtSource = d.intensity * (1 + attenuationFactor * distance);
    totalMagnitude += estimatedAtSource;
    count++;
  });
  
  const avgIntensity = totalMagnitude / count;
  const magnitude = (avgIntensity / 10) * 9;
  
  return Math.min(Math.max(magnitude, 0), 10);
};

const estimateOriginTime = (detections, epicenter) => {
  if (!epicenter || detections.length === 0) return null;
  
  let totalOriginTime = 0;
  let count = 0;
  
  detections.forEach(d => {
    const distance = haversineDistance(
      epicenter.latitude, epicenter.longitude,
      d.latitude, d.longitude
    );
    
    const travelTime = (distance / P_WAVE_VELOCITY) * 1000;
    const originTime = d.timestamp - travelTime;
    
    totalOriginTime += originTime;
    count++;
  });
  
  return totalOriginTime / count;
};

const calculateTimeResiduals = (detections, epicenter, originTime) => {
  const residuals = [];
  
  detections.forEach(d => {
    const distance = haversineDistance(
      epicenter.latitude, epicenter.longitude,
      d.latitude, d.longitude
    );
    
    const expectedTravelTime = (distance / P_WAVE_VELOCITY) * 1000;
    const expectedArrivalTime = originTime + expectedTravelTime;
    const residual = d.timestamp - expectedArrivalTime;
    
    residuals.push({
      deviceId: d.deviceId,
      residual,
      distance
    });
  });
  
  return residuals;
};

const synchronizeDetections = (detections) => {
  if (detections.length < 3) {
    return detections.map(d => ({ ...d, synchronizedTime: d.timestamp }));
  }
  
  let initialEpicenter = calculateWeightedCenter(detections);
  if (!initialEpicenter) return detections;
  
  let originTime = estimateOriginTime(detections, initialEpicenter);
  
  for (let iteration = 0; iteration < 5; iteration++) {
    const residuals = calculateTimeResiduals(detections, initialEpicenter, originTime);
    
    const clockOffsets = {};
    detections.forEach((d, i) => {
      clockOffsets[d.deviceId] = residuals[i].residual;
    });
    
    const synchronized = detections.map(d => ({
      ...d,
      synchronizedTime: d.timestamp - (clockOffsets[d.deviceId] || 0)
    }));
    
    initialEpicenter = calculateWeightedCenter(synchronized);
    originTime = estimateOriginTime(synchronized, initialEpicenter);
  }
  
  return detections.map(d => {
    const distance = haversineDistance(
      initialEpicenter.latitude, initialEpicenter.longitude,
      d.latitude, d.longitude
    );
    const travelTime = (distance / P_WAVE_VELOCITY) * 1000;
    
    return {
      ...d,
      synchronizedTime: originTime + travelTime
    };
  });
};

const tdoaLocate = (detections) => {
  if (detections.length < 3) {
    return calculateWeightedCenter(detections);
  }
  
  const sorted = [...detections].sort((a, b) => a.timestamp - b.timestamp);
  const reference = sorted[0];
  
  let bestEpicenter = calculateWeightedCenter(detections);
  let bestError = Infinity;
  
  const center = calculateWeightedCenter(detections);
  const stepSize = 0.01;
  
  for (let dLat = -0.1; dLat <= 0.1; dLat += stepSize) {
    for (let dLon = -0.1; dLon <= 0.1; dLon += stepSize) {
      const testEpicenter = {
        latitude: center.latitude + dLat,
        longitude: center.longitude + dLon
      };
      
      let error = 0;
      
      detections.forEach(d => {
        const distRef = haversineDistance(
          testEpicenter.latitude, testEpicenter.longitude,
          reference.latitude, reference.longitude
        );
        const distD = haversineDistance(
          testEpicenter.latitude, testEpicenter.longitude,
          d.latitude, d.longitude
        );
        
        const expectedTimeDiff = ((distD - distRef) / P_WAVE_VELOCITY) * 1000;
        const actualTimeDiff = d.timestamp - reference.timestamp;
        
        error += Math.abs(expectedTimeDiff - actualTimeDiff) * d.intensity;
      });
      
      if (error < bestError) {
        bestError = error;
        bestEpicenter = testEpicenter;
      }
    }
  }
  
  return bestEpicenter;
};

const calculateEpicenter = (detections) => {
  if (detections.length < 3) {
    return calculateWeightedCenter(detections);
  }
  
  const synchronized = synchronizeDetections(detections);
  const tdoaResult = tdoaLocate(synchronized);
  const weightedResult = calculateWeightedCenter(synchronized);
  
  return {
    latitude: (tdoaResult.latitude * 0.7 + weightedResult.latitude * 0.3),
    longitude: (tdoaResult.longitude * 0.7 + weightedResult.longitude * 0.3)
  };
};

const groupDetectionsByTime = (detections, timeWindowMs = 60000) => {
  if (detections.length === 0) return [];
  
  const sorted = [...detections].sort((a, b) => a.timestamp - b.timestamp);
  const groups = [];
  let currentGroup = [sorted[0]];
  
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i];
    const groupStartTime = currentGroup[0].timestamp;
    
    if (d.timestamp - groupStartTime <= timeWindowMs) {
      currentGroup.push(d);
    } else {
      const uniqueDevices = new Set(currentGroup.map(g => g.deviceId));
      if (uniqueDevices.size >= 2) {
        groups.push([...currentGroup]);
      }
      currentGroup = [d];
    }
  }
  
  const uniqueDevices = new Set(currentGroup.map(g => g.deviceId));
  if (uniqueDevices.size >= 2) {
    groups.push(currentGroup);
  }
  
  return groups;
};

const filterOutliers = (detections) => {
  if (detections.length <= 3) return detections;
  
  const intensities = detections.map(d => d.intensity).sort((a, b) => a - b);
  const q1 = intensities[Math.floor(intensities.length * 0.25)];
  const q3 = intensities[Math.floor(intensities.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;
  
  return detections.filter(d => 
    d.intensity >= lowerBound && d.intensity <= upperBound
  );
};

const analyzeQuakeEvent = (detections) => {
  if (detections.length < 2) return null;
  
  const filtered = filterOutliers(detections);
  if (filtered.length < 2) return null;
  
  const synchronized = synchronizeDetections(filtered);
  const epicenter = calculateEpicenter(synchronized);
  const magnitude = estimateMagnitude(synchronized, epicenter);
  const originTime = estimateOriginTime(synchronized, epicenter);
  
  const maxIntensity = Math.max(...filtered.map(d => d.intensity));
  const avgIntensity = filtered.reduce((sum, d) => sum + d.intensity, 0) / filtered.length;
  
  const timeResiduals = calculateTimeResiduals(synchronized, epicenter, originTime);
  
  return {
    id: `quake_${Date.now()}`,
    timestamp: originTime || Math.min(...filtered.map(d => d.timestamp)),
    epicenter: {
      latitude: Math.round(epicenter.latitude * 10000) / 10000,
      longitude: Math.round(epicenter.longitude * 10000) / 10000
    },
    magnitude: Math.round(magnitude * 100) / 100,
    maxIntensity: Math.round(maxIntensity * 100) / 100,
    avgIntensity: Math.round(avgIntensity * 100) / 100,
    deviceCount: filtered.length,
    locationMethod: filtered.length >= 3 ? 'TDoA+Weighted' : 'WeightedCenter',
    timeSyncQuality: calculateTimeSyncQuality(timeResiduals),
    detections: filtered.map(d => ({
      deviceId: d.deviceId,
      latitude: d.latitude,
      longitude: d.longitude,
      intensity: d.intensity,
      timestamp: d.timestamp,
      synchronizedTime: d.synchronizedTime || d.timestamp
    }))
  };
};

const calculateTimeSyncQuality = (residuals) => {
  if (residuals.length === 0) return 0;
  
  const avgResidual = residuals.reduce((sum, r) => sum + Math.abs(r.residual), 0) / residuals.length;
  
  if (avgResidual < 500) return 'excellent';
  if (avgResidual < 1000) return 'good';
  if (avgResidual < 2000) return 'fair';
  return 'poor';
};

const generateHeatmapData = (detections, epicenter) => {
  const heatmap = [];
  
  detections.forEach(d => {
    heatmap.push({
      latitude: d.latitude,
      longitude: d.longitude,
      intensity: d.intensity,
      weight: d.intensity / 10
    });
  });
  
  if (epicenter) {
    heatmap.push({
      latitude: epicenter.latitude,
      longitude: epicenter.longitude,
      intensity: 10,
      weight: 1
    });
  }
  
  return heatmap;
};

module.exports = {
  haversineDistance,
  calculateWeightedCenter,
  estimateMagnitude,
  estimateOriginTime,
  synchronizeDetections,
  tdoaLocate,
  calculateEpicenter,
  groupDetectionsByTime,
  filterOutliers,
  analyzeQuakeEvent,
  generateHeatmapData,
  calculateTimeResiduals,
  P_WAVE_VELOCITY
};
