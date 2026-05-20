use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub category: String,
    pub path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct PluginParameter {
    pub id: u32,
    pub name: String,
    pub value: f64,
    pub normalized: f64,
    pub min: f64,
    pub max: f64,
    pub default: f64,
}

struct LoadedPlugin {
    info: PluginInfo,
    parameters: HashMap<u32, PluginParameter>,
    parameter_values: Vec<(u32, f64)>,
    is_loaded: Arc<AtomicBool>,
    gui_needs_update: Arc<AtomicBool>,
}

pub struct Vst3Host {
    plugin_paths: Vec<PathBuf>,
    loaded_plugins: HashMap<String, LoadedPlugin>,
    plugin_info_cache: Vec<PluginInfo>,
}

impl Vst3Host {
    pub fn new() -> Self {
        Self {
            plugin_paths: Vec::new(),
            loaded_plugins: HashMap::new(),
            plugin_info_cache: Vec::new(),
        }
    }

    pub fn scan_plugins(&mut self) -> Result<Vec<PluginInfo>, Box<dyn std::error::Error>> {
        let mut plugins = Vec::new();

        let demo_plugins = vec![
            PluginInfo {
                id: "synth-1".to_string(),
                name: "Synth One".to_string(),
                vendor: "P25 Audio".to_string(),
                category: "instrument".to_string(),
                path: PathBuf::from("/demo/synth1"),
            },
            PluginInfo {
                id: "reverb-1".to_string(),
                name: "Reverb Pro".to_string(),
                vendor: "P25 Audio".to_string(),
                category: "effect".to_string(),
                path: PathBuf::from("/demo/reverb"),
            },
            PluginInfo {
                id: "eq-1".to_string(),
                name: "EQ Master".to_string(),
                vendor: "P25 Audio".to_string(),
                category: "effect".to_string(),
                path: PathBuf::from("/demo/eq"),
            },
            PluginInfo {
                id: "comp-1".to_string(),
                name: "Compressor X".to_string(),
                vendor: "P25 Audio".to_string(),
                category: "effect".to_string(),
                path: PathBuf::from("/demo/compressor"),
            },
            PluginInfo {
                id: "drum-1".to_string(),
                name: "Drum Machine".to_string(),
                vendor: "P25 Audio".to_string(),
                category: "instrument".to_string(),
                path: PathBuf::from("/demo/drums"),
            },
        ];

        plugins.extend(demo_plugins);
        self.plugin_info_cache = plugins.clone();

        Ok(plugins)
    }

    pub fn load_plugin(&mut self, plugin_id: &str) -> Result<PluginParameter, Box<dyn std::error::Error>> {
        let info = self.plugin_info_cache
            .iter()
            .find(|p| p.id == plugin_id)
            .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?
            .clone();

        let mut parameters = HashMap::new();
        let param_values = vec![
            (0, 0.5),
            (1, 0.7),
            (2, 0.3),
            (3, 0.8),
        ];

        for (id, value) in &param_values {
            parameters.insert(*id, PluginParameter {
                id: *id,
                name: format!("Param {}", id),
                value: *value,
                normalized: *value,
                min: 0.0,
                max: 1.0,
                default: 0.5,
            });
        }

        let loaded = LoadedPlugin {
            info,
            parameters,
            parameter_values: param_values,
            is_loaded: Arc::new(AtomicBool::new(true)),
            gui_needs_update: Arc::new(AtomicBool::new(false)),
        };

        self.loaded_plugins.insert(plugin_id.to_string(), loaded);

        Ok(PluginParameter {
            id: 0,
            name: "Loaded".to_string(),
            value: 1.0,
            normalized: 1.0,
            min: 0.0,
            max: 1.0,
            default: 0.0,
        })
    }

    pub fn set_parameter_rt(&mut self, plugin_id: &str, param_id: u32, value: f64) -> Result<(), ()> {
        if let Some(plugin) = self.loaded_plugins.get_mut(plugin_id) {
            if let Some(param) = plugin.parameters.get_mut(&param_id) {
                param.value = value.clamp(param.min, param.max);
                param.normalized = (param.value - param.min) / (param.max - param.min);
                plugin.gui_needs_update.store(true, Ordering::Release);
                return Ok(());
            }
        }
        Err(())
    }

    pub fn get_parameter_rt(&self, plugin_id: &str, param_id: u32) -> Option<f64> {
        self.loaded_plugins
            .get(plugin_id)
            .and_then(|p| p.parameters.get(&param_id))
            .map(|p| p.value)
    }

    pub fn process_audio(&mut self, _plugin_id: &str, _input: &[f32], _output: &mut [f32]) {
    }

    pub fn needs_gui_update(&self, plugin_id: &str) -> bool {
        self.loaded_plugins
            .get(plugin_id)
            .map(|p| p.gui_needs_update.load(Ordering::Acquire))
            .unwrap_or(false)
    }

    pub fn clear_gui_update_flag(&self, plugin_id: &str) {
        if let Some(p) = self.loaded_plugins.get(plugin_id) {
            p.gui_needs_update.store(false, Ordering::Release);
        }
    }

    pub fn get_updated_params(&self, plugin_id: &str) -> Vec<(u32, f64, f64)> {
        let mut updates = Vec::new();
        if let Some(plugin) = self.loaded_plugins.get(plugin_id) {
            for (id, param) in &plugin.parameters {
                updates.push((*id, param.value, param.normalized));
            }
        }
        updates
    }

    pub fn get_available_plugins(&self) -> &[PluginInfo] {
        &self.plugin_info_cache
    }

    pub fn unload_plugin(&mut self, plugin_id: &str) {
        self.loaded_plugins.remove(plugin_id);
    }
}

impl Default for Vst3Host {
    fn default() -> Self {
        Self::new()
    }
}
