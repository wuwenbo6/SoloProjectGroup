#ifndef KDTREE_H
#define KDTREE_H

#include "point_cloud.h"
#include <vector>
#include <algorithm>
#include <queue>
#include <limits>

class KDTree {
private:
    struct Node {
        size_t pointIndex;
        int axis;
        Node* left;
        Node* right;
        
        Node(size_t idx, int a) : pointIndex(idx), axis(a), left(nullptr), right(nullptr) {}
        ~Node() {
            delete left;
            delete right;
        }
    };
    
    Node* root;
    const PointCloud* cloud;
    
    Node* buildRecursive(std::vector<size_t>& indices, int depth) {
        if (indices.empty()) return nullptr;
        
        int axis = depth % 3;
        
        std::sort(indices.begin(), indices.end(), [&](size_t a, size_t b) {
            return (*cloud)[a].xyz[axis] < (*cloud)[b].xyz[axis];
        });
        
        size_t median = indices.size() / 2;
        Node* node = new Node(indices[median], axis);
        
        std::vector<size_t> leftIndices(indices.begin(), indices.begin() + median);
        std::vector<size_t> rightIndices(indices.begin() + median + 1, indices.end());
        
        node->left = buildRecursive(leftIndices, depth + 1);
        node->right = buildRecursive(rightIndices, depth + 1);
        
        return node;
    }
    
    void nearestRecursive(Node* node, const Eigen::Vector3d& query,
                          size_t& bestIndex, double& bestDist, int depth) const {
        if (!node) return;
        
        double dist = ((*cloud)[node->pointIndex].xyz - query).squaredNorm();
        if (dist < bestDist) {
            bestDist = dist;
            bestIndex = node->pointIndex;
        }
        
        int axis = depth % 3;
        double axisDist = query[axis] - (*cloud)[node->pointIndex].xyz[axis];
        
        Node* first = (axisDist < 0) ? node->left : node->right;
        Node* second = (axisDist < 0) ? node->right : node->left;
        
        nearestRecursive(first, query, bestIndex, bestDist, depth + 1);
        
        if (axisDist * axisDist < bestDist) {
            nearestRecursive(second, query, bestIndex, bestDist, depth + 1);
        }
    }
    
    void kNearestRecursive(Node* node, const Eigen::Vector3d& query, int k,
                          std::priority_queue<std::pair<double, size_t>>& heap,
                          int depth) const {
        if (!node) return;
        
        double dist = ((*cloud)[node->pointIndex].xyz - query).squaredNorm();
        if (heap.size() < k) {
            heap.emplace(dist, node->pointIndex);
        } else if (dist < heap.top().first) {
            heap.pop();
            heap.emplace(dist, node->pointIndex);
        }
        
        int axis = depth % 3;
        double axisDist = query[axis] - (*cloud)[node->pointIndex].xyz[axis];
        
        Node* first = (axisDist < 0) ? node->left : node->right;
        Node* second = (axisDist < 0) ? node->right : node->left;
        
        kNearestRecursive(first, query, k, heap, depth + 1);
        
        if (heap.size() < k || axisDist * axisDist < heap.top().first) {
            kNearestRecursive(second, query, k, heap, depth + 1);
        }
    }
    
public:
    KDTree(const PointCloud* pc) : root(nullptr), cloud(pc) {}
    
    ~KDTree() {
        delete root;
    }
    
    void build() {
        if (!cloud || cloud->empty()) return;
        
        std::vector<size_t> indices(cloud->size());
        for (size_t i = 0; i < cloud->size(); ++i) {
            indices[i] = i;
        }
        
        root = buildRecursive(indices, 0);
    }
    
    size_t nearest(const Eigen::Vector3d& query) const {
        if (!root) return std::numeric_limits<size_t>::max();
        
        size_t bestIndex = 0;
        double bestDist = std::numeric_limits<double>::max();
        nearestRecursive(root, query, bestIndex, bestDist, 0);
        return bestIndex;
    }
    
    std::vector<size_t> kNearest(const Eigen::Vector3d& query, int k) const {
        if (!root || k <= 0) return {};
        
        std::priority_queue<std::pair<double, size_t>> heap;
        kNearestRecursive(root, query, k, heap, 0);
        
        std::vector<size_t> result;
        result.reserve(heap.size());
        while (!heap.empty()) {
            result.push_back(heap.top().second);
            heap.pop();
        }
        std::reverse(result.begin(), result.end());
        return result;
    }
    
    std::vector<size_t> radiusSearch(const Eigen::Vector3d& query, double radius) const {
        std::vector<size_t> result;
        if (!root) return result;
        
        double radiusSq = radius * radius;
        
        std::queue<Node*> q;
        q.push(root);
        
        while (!q.empty()) {
            Node* node = q.front();
            q.pop();
            
            if (!node) continue;
            
            double dist = ((*cloud)[node->pointIndex].xyz - query).squaredNorm();
            if (dist <= radiusSq) {
                result.push_back(node->pointIndex);
            }
            
            int axis = node->axis;
            double axisDist = query[axis] - (*cloud)[node->pointIndex].xyz[axis];
            
            if (axisDist < 0 || axisDist * axisDist <= radiusSq) {
                q.push(node->left);
            }
            if (axisDist >= 0 || axisDist * axisDist <= radiusSq) {
                q.push(node->right);
            }
        }
        
        return result;
    }
};

#endif