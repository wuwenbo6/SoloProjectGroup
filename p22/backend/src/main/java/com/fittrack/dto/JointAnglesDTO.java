package com.fittrack.dto;

import lombok.Data;
import java.util.Map;

@Data
public class JointAnglesDTO {
    private Long timestamp;
    private Map<String, Double> angles;
}
