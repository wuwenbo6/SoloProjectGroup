package com.explorer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GraphNode {

    private String id;
    private String label;
    private String type;
    private int degree;
    private int inDegree;
    private int outDegree;
    private double amount;
    private int transactionCount;
    private String group;
    private double x;
    private double y;
}