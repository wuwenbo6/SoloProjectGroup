package com.explorer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TopologyPattern {

    private String type;
    private String name;
    private String description;
    private String centerNode;
    private List<String> relatedNodes;
    private double confidence;
    private int transactionCount;
    private double totalAmount;
}