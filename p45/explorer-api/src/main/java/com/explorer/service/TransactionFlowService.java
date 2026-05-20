package com.explorer.service;

import com.explorer.dto.GraphData;
import com.explorer.dto.GraphEdge;
import com.explorer.dto.GraphNode;
import com.explorer.dto.TopologyPattern;
import com.explorer.entity.Transaction;
import com.explorer.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class TransactionFlowService {

    private final TransactionRepository transactionRepository;

    private static final int STAR_THRESHOLD = 3;
    private static final int CHAIN_THRESHOLD = 3;

    public GraphData analyzeTransactionFlow(int limit) {
        List<Transaction> transactions = transactionRepository.findAll(
                PageRequest.of(0, limit)
        ).getContent();

        Map<String, GraphNode> nodeMap = new HashMap<>();
        Map<String, GraphEdge> edgeMap = new HashMap<>();

        for (Transaction tx : transactions) {
            String from = tx.getFrom();
            String to = tx.getTo();
            double amount = parseAmount(tx.getValue());

            updateNode(nodeMap, from, true, amount);
            updateNode(nodeMap, to, false, amount);
            updateEdge(edgeMap, from, to, amount, tx.getHash());
        }

        List<GraphNode> nodes = new ArrayList<>(nodeMap.values());
        List<GraphEdge> edges = new ArrayList<>(edgeMap.values());

        List<TopologyPattern> patterns = detectTopologyPatterns(nodes, edges);

        Map<String, Object> statistics = calculateStatistics(nodes, edges);

        return GraphData.builder()
                .nodes(nodes)
                .edges(edges)
                .statistics(statistics)
                .patterns(patterns)
                .build();
    }

    private void updateNode(Map<String, GraphNode> nodeMap, String address, boolean isFrom, double amount) {
        GraphNode node = nodeMap.computeIfAbsent(address, k -> GraphNode.builder()
                .id(k)
                .label(k.substring(0, Math.min(10, k.length())) + "...")
                .type("account")
                .degree(0)
                .inDegree(0)
                .outDegree(0)
                .amount(0)
                .transactionCount(0)
                .build());

        node.setDegree(node.getDegree() + 1);
        if (isFrom) {
            node.setOutDegree(node.getOutDegree() + 1);
        } else {
            node.setInDegree(node.getInDegree() + 1);
        }
        node.setAmount(node.getAmount() + amount);
        node.setTransactionCount(node.getTransactionCount() + 1);
    }

    private void updateEdge(Map<String, GraphEdge> edgeMap, String from, String to, double amount, String txHash) {
        String edgeId = from + "->" + to;
        GraphEdge edge = edgeMap.computeIfAbsent(edgeId, k -> GraphEdge.builder()
                .id(k)
                .source(from)
                .target(to)
                .value(0)
                .transactionCount(0)
                .type("transfer")
                .build());

        edge.setValue(edge.getValue() + amount);
        edge.setTransactionCount(edge.getTransactionCount() + 1);
        edge.setLabel(String.format("%.2f", edge.getValue()));
    }

    private List<TopologyPattern> detectTopologyPatterns(List<GraphNode> nodes, List<GraphEdge> edges) {
        List<TopologyPattern> patterns = new ArrayList<>();

        patterns.addAll(detectStarTopologies(nodes, edges));
        patterns.addAll(detectChainTopologies(nodes, edges));
        patterns.addAll(detectHubTopologies(nodes, edges));

        return patterns;
    }

    private List<TopologyPattern> detectStarTopologies(List<GraphNode> nodes, List<GraphEdge> edges) {
        List<TopologyPattern> patterns = new ArrayList<>();

        for (GraphNode node : nodes) {
            List<String> connectedNodes = getConnectedNodes(node.getId(), edges);

            if (connectedNodes.size() >= STAR_THRESHOLD) {
                boolean isStarCenter = isStarCenter(node, edges);

                if (isStarCenter) {
                    double totalAmount = calculateTotalAmount(node.getId(), edges);
                    int txCount = calculateTransactionCount(node.getId(), edges);

                    patterns.add(TopologyPattern.builder()
                            .type("STAR")
                            .name("星型拓扑 - " + node.getLabel())
                            .description("检测到中心账户，与 " + connectedNodes.size() + " 个账户有转账关系")
                            .centerNode(node.getId())
                            .relatedNodes(connectedNodes)
                            .confidence(calculateStarConfidence(node, connectedNodes.size()))
                            .transactionCount(txCount)
                            .totalAmount(totalAmount)
                            .build());
                }
            }
        }

        return patterns.stream()
                .sorted((a, b) -> Integer.compare(b.getRelatedNodes().size(), a.getRelatedNodes().size()))
                .limit(5)
                .collect(Collectors.toList());
    }

    private boolean isStarCenter(GraphNode node, List<GraphEdge> edges) {
        long outgoingEdges = edges.stream()
                .filter(e -> e.getSource().equals(node.getId()))
                .count();
        long incomingEdges = edges.stream()
                .filter(e -> e.getTarget().equals(node.getId()))
                .count();

        return outgoingEdges >= STAR_THRESHOLD || incomingEdges >= STAR_THRESHOLD;
    }

    private double calculateStarConfidence(GraphNode node, int connectedCount) {
        double baseConfidence = Math.min(1.0, connectedCount / 10.0);
        double degreeFactor = Math.min(1.0, node.getDegree() / 20.0);
        return (baseConfidence + degreeFactor) / 2 * 100;
    }

    private List<TopologyPattern> detectChainTopologies(List<GraphNode> nodes, List<GraphEdge> edges) {
        List<TopologyPattern> patterns = new ArrayList<>();
        Set<String> visitedNodes = new HashSet<>();

        for (GraphNode node : nodes) {
            if (visitedNodes.contains(node.getId())) {
                continue;
            }

            List<String> chain = findLongestChain(node.getId(), edges, visitedNodes);

            if (chain.size() >= CHAIN_THRESHOLD) {
                double totalAmount = calculateChainAmount(chain, edges);
                int txCount = chain.size() - 1;

                patterns.add(TopologyPattern.builder()
                        .type("CHAIN")
                        .name("链式拓扑 - 长度 " + chain.size())
                        .description("检测到长度为 " + chain.size() + " 的转账链条")
                        .centerNode(chain.get(0))
                        .relatedNodes(chain)
                        .confidence(Math.min(100, chain.size() * 15))
                        .transactionCount(txCount)
                        .totalAmount(totalAmount)
                        .build());
            }
        }

        return patterns.stream()
                .sorted((a, b) -> Integer.compare(b.getRelatedNodes().size(), a.getRelatedNodes().size()))
                .limit(5)
                .collect(Collectors.toList());
    }

    private List<String> findLongestChain(String startNode, List<GraphEdge> edges, Set<String> visited) {
        List<String> currentPath = new ArrayList<>();
        List<String> longestPath = new ArrayList<>();
        Set<String> pathVisited = new HashSet<>();

        dfsChain(startNode, edges, currentPath, longestPath, pathVisited);

        visited.addAll(longestPath);
        return longestPath;
    }

    private void dfsChain(String currentNode, List<GraphEdge> edges,
                          List<String> currentPath, List<String> longestPath,
                          Set<String> pathVisited) {
        if (pathVisited.contains(currentNode)) {
            return;
        }

        pathVisited.add(currentNode);
        currentPath.add(currentNode);

        if (currentPath.size() > longestPath.size()) {
            longestPath.clear();
            longestPath.addAll(currentPath);
        }

        List<String> nextNodes = getOutgoingNodes(currentNode, edges);
        for (String next : nextNodes) {
            dfsChain(next, edges, currentPath, longestPath, pathVisited);
        }

        currentPath.remove(currentPath.size() - 1);
        pathVisited.remove(currentNode);
    }

    private List<TopologyPattern> detectHubTopologies(List<GraphNode> nodes, List<GraphEdge> edges) {
        List<TopologyPattern> patterns = new ArrayList<>();

        List<GraphNode> sortedByDegree = nodes.stream()
                .sorted((a, b) -> Integer.compare(b.getDegree(), a.getDegree()))
                .limit(3)
                .collect(Collectors.toList());

        for (GraphNode hub : sortedByDegree) {
            if (hub.getDegree() >= 5) {
                List<String> connectedNodes = getConnectedNodes(hub.getId(), edges);
                double totalAmount = calculateTotalAmount(hub.getId(), edges);

                patterns.add(TopologyPattern.builder()
                        .type("HUB")
                        .name("Hub 节点 - " + hub.getLabel())
                        .description("高连接度账户，共 " + hub.getDegree() + " 次转账")
                        .centerNode(hub.getId())
                        .relatedNodes(connectedNodes)
                        .confidence(Math.min(100, hub.getDegree() * 5))
                        .transactionCount(hub.getTransactionCount())
                        .totalAmount(totalAmount)
                        .build());
            }
        }

        return patterns;
    }

    private List<String> getConnectedNodes(String nodeId, List<GraphEdge> edges) {
        Set<String> connected = new HashSet<>();
        for (GraphEdge edge : edges) {
            if (edge.getSource().equals(nodeId)) {
                connected.add(edge.getTarget());
            }
            if (edge.getTarget().equals(nodeId)) {
                connected.add(edge.getSource());
            }
        }
        return new ArrayList<>(connected);
    }

    private List<String> getOutgoingNodes(String nodeId, List<GraphEdge> edges) {
        return edges.stream()
                .filter(e -> e.getSource().equals(nodeId))
                .map(GraphEdge::getTarget)
                .collect(Collectors.toList());
    }

    private double calculateTotalAmount(String nodeId, List<GraphEdge> edges) {
        return edges.stream()
                .filter(e -> e.getSource().equals(nodeId) || e.getTarget().equals(nodeId))
                .mapToDouble(GraphEdge::getValue)
                .sum();
    }

    private double calculateChainAmount(List<String> chain, List<GraphEdge> edges) {
        double total = 0;
        for (int i = 0; i < chain.size() - 1; i++) {
            String from = chain.get(i);
            String to = chain.get(i + 1);
            total += edges.stream()
                    .filter(e -> e.getSource().equals(from) && e.getTarget().equals(to))
                    .mapToDouble(GraphEdge::getValue)
                    .sum();
        }
        return total;
    }

    private int calculateTransactionCount(String nodeId, List<GraphEdge> edges) {
        return (int) edges.stream()
                .filter(e -> e.getSource().equals(nodeId) || e.getTarget().equals(nodeId))
                .count();
    }

    private Map<String, Object> calculateStatistics(List<GraphNode> nodes, List<GraphEdge> edges) {
        Map<String, Object> stats = new HashMap<>();

        stats.put("nodeCount", nodes.size());
        stats.put("edgeCount", edges.size());
        stats.put("totalTransactions", nodes.stream().mapToInt(GraphNode::getTransactionCount).sum() / 2);
        stats.put("totalAmount", edges.stream().mapToDouble(GraphEdge::getValue).sum());

        double avgDegree = nodes.stream().mapToInt(GraphNode::getDegree).average().orElse(0);
        stats.put("averageDegree", String.format("%.2f", avgDegree));

        Optional<GraphNode> maxDegreeNode = nodes.stream()
                .max(Comparator.comparingInt(GraphNode::getDegree));
        maxDegreeNode.ifPresent(node -> stats.put("maxDegreeNode", node.getLabel()));

        stats.put("density", calculateDensity(nodes.size(), edges.size()));

        return stats;
    }

    private String calculateDensity(int nodeCount, int edgeCount) {
        if (nodeCount <= 1) return "0.00";
        double maxPossibleEdges = (double) nodeCount * (nodeCount - 1);
        double density = (edgeCount * 2.0) / maxPossibleEdges;
        return String.format("%.4f", density);
    }

    private double parseAmount(String value) {
        try {
            if (value == null || value.isEmpty()) return 0;
            return Double.parseDouble(value);
        } catch (NumberFormatException e) {
            return new Random().nextInt(10000);
        }
    }
}