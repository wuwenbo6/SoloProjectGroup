use crate::Dependency;
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::{HashMap, HashSet};
use std::fmt;

#[derive(Debug, Clone)]
pub struct NodeData {
    pub name: String,
    pub version: String,
    pub language: String,
}

impl NodeData {
    pub fn key(&self) -> String {
        format!("{}:{}:{}", self.name, self.version, self.language)
    }
}

impl fmt::Display for NodeData {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}@{} [{}]", self.name, self.version, self.language)
    }
}

pub struct NodeIter<'a> {
    graph: &'a DiGraph<NodeData, ()>,
    indices: std::vec::IntoIter<NodeIndex>,
}

impl<'a> Iterator for NodeIter<'a> {
    type Item = &'a NodeData;

    fn next(&mut self) -> Option<Self::Item> {
        self.indices.next().map(|idx| &self.graph[idx])
    }

    fn size_hint(&self) -> (usize, Option<usize>) {
        self.indices.size_hint()
    }
}

pub struct DependencyGraph {
    pub graph: DiGraph<NodeData, ()>,
    pub node_map: HashMap<String, NodeIndex>,
    pub cycles: Vec<(String, String)>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
            cycles: Vec::new(),
        }
    }

    pub fn build(&mut self, dependencies: &[Dependency]) {
        let mut visited = HashSet::new();
        for dep in dependencies {
            self.add_dependency_recursive(dep, None, &mut visited, &mut Vec::new());
        }
        
        if !self.cycles.is_empty() {
            eprintln!("Warning: Detected {} circular dependencies:", self.cycles.len());
            for (from, to) in &self.cycles {
                eprintln!("  {} -> {}", from, to);
            }
        }
    }

    fn add_dependency_recursive(
        &mut self,
        dep: &Dependency,
        parent: Option<NodeIndex>,
        visited: &mut HashSet<String>,
        recursion_stack: &mut Vec<String>,
    ) {
        let key = format!("{}:{}:{}", dep.name, dep.version, dep.language);
        
        if recursion_stack.contains(&key) {
            if let Some(parent_key) = recursion_stack.last() {
                self.cycles.push((parent_key.clone(), key.clone()));
            }
            eprintln!("Warning: Circular dependency detected at {}", key);
            return;
        }
        
        if visited.contains(&key) {
            if let Some(parent_idx) = parent {
                if let Some(&node_idx) = self.node_map.get(&key) {
                    self.graph.add_edge(parent_idx, node_idx, ());
                }
            }
            return;
        }
        
        recursion_stack.push(key.clone());
        
        let node_idx = if let Some(&idx) = self.node_map.get(&key) {
            idx
        } else {
            let node_data = NodeData {
                name: dep.name.clone(),
                version: dep.version.clone(),
                language: dep.language.to_string(),
            };
            let idx = self.graph.add_node(node_data);
            self.node_map.insert(key.clone(), idx);
            idx
        };
        
        if let Some(parent_idx) = parent {
            self.graph.add_edge(parent_idx, node_idx, ());
        }
        
        visited.insert(key.clone());
        
        for sub_dep in &dep.dependencies {
            self.add_dependency_recursive(sub_dep, Some(node_idx), visited, recursion_stack);
        }
        
        recursion_stack.pop();
    }

    pub fn iter_nodes(&self) -> NodeIter<'_> {
        let indices: Vec<_> = self.graph.node_indices().collect();
        NodeIter {
            graph: &self.graph,
            indices: indices.into_iter(),
        }
    }

    pub fn get_all_nodes(&self) -> Vec<&NodeData> {
        self.iter_nodes().collect()
    }

    pub fn get_dependencies_of(&self, name: &str, version: &str, language: &str) -> Vec<&NodeData> {
        let key = format!("{}:{}:{}", name, version, language);
        let mut deps = Vec::new();
        
        if let Some(&node_idx) = self.node_map.get(&key) {
            for neighbor in self.graph.neighbors(node_idx) {
                deps.push(&self.graph[neighbor]);
            }
        }
        
        deps
    }

    pub fn node_count(&self) -> usize {
        self.graph.node_count()
    }

    pub fn edge_count(&self) -> usize {
        self.graph.edge_count()
    }
}

impl Default for DependencyGraph {
    fn default() -> Self {
        Self::new()
    }
}
