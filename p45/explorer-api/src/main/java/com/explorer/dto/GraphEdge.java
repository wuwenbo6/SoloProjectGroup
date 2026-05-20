package com.explorer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GraphEdge {

    private String id;
    private String source;
    private String target;
    private double value;
    private int transactionCount;
    private String label;
    private String type;
}