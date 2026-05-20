pub mod parsers;
pub mod graph;
pub mod vulnerability;
pub mod output;
pub mod license;
pub mod fix_suggestion;

use std::path::Path;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct Dependency {
    pub name: String,
    pub version: String,
    pub language: Language,
    pub dependencies: Vec<Dependency>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum Language {
    Python,
    JavaScript,
    Java,
}

impl std::fmt::Display for Language {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Language::Python => write!(f, "Python"),
            Language::JavaScript => write!(f, "JavaScript"),
            Language::Java => write!(f, "Java"),
        }
    }
}

pub trait Parser {
    fn parse(&self, path: &Path) -> Result<Vec<Dependency>>;
    fn language(&self) -> Language;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::graph::DependencyGraph;

    #[test]
    fn test_circular_dependency_detection() {
        // A -> B -> A (circular)
        let mut dep_a = Dependency {
            name: "A".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: Vec::new(),
        };
        
        let mut dep_b = Dependency {
            name: "B".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: Vec::new(),
        };
        
        dep_b.dependencies.push(dep_a.clone());
        dep_a.dependencies.push(dep_b);
        
        let mut graph = DependencyGraph::new();
        graph.build(&[dep_a]);
        
        assert!(graph.cycles.len() >= 1, "Should detect circular dependency");
        assert_eq!(graph.node_count(), 2, "Should have 2 nodes despite circular dependency");
    }

    #[test]
    fn test_deep_circular_dependency() {
        // A -> B -> C -> A
        let mut dep_a = Dependency {
            name: "A".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: Vec::new(),
        };
        
        let mut dep_b = Dependency {
            name: "B".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: Vec::new(),
        };
        
        let mut dep_c = Dependency {
            name: "C".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: Vec::new(),
        };
        
        dep_c.dependencies.push(dep_a.clone());
        dep_b.dependencies.push(dep_c);
        dep_a.dependencies.push(dep_b);
        
        let mut graph = DependencyGraph::new();
        graph.build(&[dep_a]);
        
        assert!(graph.cycles.len() >= 1, "Should detect deep circular dependency");
        assert_eq!(graph.node_count(), 3, "Should have 3 nodes");
    }

    #[test]
    fn test_no_circular_dependency() {
        // A -> B -> C (no cycle)
        let dep_c = Dependency {
            name: "C".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: Vec::new(),
        };
        
        let dep_b = Dependency {
            name: "B".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: vec![dep_c],
        };
        
        let dep_a = Dependency {
            name: "A".to_string(),
            version: "1.0.0".to_string(),
            language: Language::JavaScript,
            dependencies: vec![dep_b],
        };
        
        let mut graph = DependencyGraph::new();
        graph.build(&[dep_a]);
        
        assert_eq!(graph.cycles.len(), 0, "Should not detect any circular dependencies");
        assert_eq!(graph.node_count(), 3, "Should have 3 nodes");
    }
}
