package com.explorer.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GraphData {

    private List<GraphNode> nodes;
    private List<GraphEdge> edges;
    private Map<String, Object> statistics;
    private List<TopologyPattern> patterns;
}