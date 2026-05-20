package com.fittrack.service;

import com.fittrack.dto.KeypointDTO;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class JointAngleCalculator {

    public Map<String, Double> calculateAllAngles(List<KeypointDTO> keypoints) {
        Map<String, Double> angles = new HashMap<>();

        Map<String, KeypointDTO> keypointMap = new HashMap<>();
        for (KeypointDTO kp : keypoints) {
            keypointMap.put(kp.getName(), kp);
        }

        angles.put("left_elbow", calculateAngle(
                keypointMap.get("left_shoulder"),
                keypointMap.get("left_elbow"),
                keypointMap.get("left_wrist")
        ));

        angles.put("right_elbow", calculateAngle(
                keypointMap.get("right_shoulder"),
                keypointMap.get("right_elbow"),
                keypointMap.get("right_wrist")
        ));

        angles.put("left_knee", calculateAngle(
                keypointMap.get("left_hip"),
                keypointMap.get("left_knee"),
                keypointMap.get("left_ankle")
        ));

        angles.put("right_knee", calculateAngle(
                keypointMap.get("right_hip"),
                keypointMap.get("right_knee"),
                keypointMap.get("right_ankle")
        ));

        angles.put("left_shoulder", calculateAngle(
                keypointMap.get("left_hip"),
                keypointMap.get("left_shoulder"),
                keypointMap.get("left_elbow")
        ));

        angles.put("right_shoulder", calculateAngle(
                keypointMap.get("right_hip"),
                keypointMap.get("right_shoulder"),
                keypointMap.get("right_elbow")
        ));

        angles.put("left_hip", calculateAngle(
                keypointMap.get("left_shoulder"),
                keypointMap.get("left_hip"),
                keypointMap.get("left_knee")
        ));

        angles.put("right_hip", calculateAngle(
                keypointMap.get("right_shoulder"),
                keypointMap.get("right_hip"),
                keypointMap.get("right_knee")
        ));

        return angles;
    }

    private Double calculateAngle(KeypointDTO a, KeypointDTO b, KeypointDTO c) {
        if (a == null || b == null || c == null) {
            return null;
        }

        double[] vectorBA = {
                a.getX() - b.getX(),
                a.getY() - b.getY(),
                a.getZ() - b.getZ()
        };

        double[] vectorBC = {
                c.getX() - b.getX(),
                c.getY() - b.getY(),
                c.getZ() - b.getZ()
        };

        double dotProduct = vectorBA[0] * vectorBC[0] + vectorBA[1] * vectorBC[1] + vectorBA[2] * vectorBC[2];

        double magnitudeBA = Math.sqrt(vectorBA[0] * vectorBA[0] + vectorBA[1] * vectorBA[1] + vectorBA[2] * vectorBA[2]);
        double magnitudeBC = Math.sqrt(vectorBC[0] * vectorBC[0] + vectorBC[1] * vectorBC[1] + vectorBC[2] * vectorBC[2]);

        if (magnitudeBA == 0 || magnitudeBC == 0) {
            return 0.0;
        }

        double cosAngle = dotProduct / (magnitudeBA * magnitudeBC);
        cosAngle = Math.max(-1.0, Math.min(1.0, cosAngle));

        return Math.toDegrees(Math.acos(cosAngle));
    }

    public double[] toFeatureVector(Map<String, Double> angles) {
        String[] jointOrder = {
                "left_elbow", "right_elbow",
                "left_knee", "right_knee",
                "left_shoulder", "right_shoulder",
                "left_hip", "right_hip"
        };

        double[] features = new double[jointOrder.length];
        for (int i = 0; i < jointOrder.length; i++) {
            Double angle = angles.get(jointOrder[i]);
            features[i] = (angle != null) ? angle : 0.0;
        }
        return features;
    }
}
