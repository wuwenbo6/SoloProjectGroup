use crate::types::*;
use crate::utils::*;
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use log::{info, warn};

pub struct DgpsCorrector {
    corrections: DgpsCorrections,
}

impl DgpsCorrector {
    pub fn new() -> Self {
        DgpsCorrector {
            corrections: DgpsCorrections::default(),
        }
    }

    pub fn from_rtcm_file<P: AsRef<Path>>(path: P) -> Result<Self, Box<dyn std::error::Error>> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let mut corrector = Self::new();
        
        corrector.parse_rtcm_text(reader)?;
        Ok(corrector)
    }

    pub fn from_simple_corrections(corrections: HashMap<SatelliteId, f64>) -> Self {
        let mut dgps_corrections = DgpsCorrections::default();
        let mut corr_map = HashMap::new();
        
        for (sat_id, pr_corr) in corrections {
            corr_map.insert(sat_id, DgpsCorrection {
                sat_id,
                pseudorange_correction: pr_corr,
                pseudorange_rate_correction: 0.0,
                iod: 0,
                update_time: 0.0,
            });
        }
        
        dgps_corrections.station = Some(DgpsStation {
            id: 0,
            name: "SIMPLE".to_string(),
            position: (0.0, 0.0, 0.0),
            corrections: corr_map,
        });
        
        DgpsCorrector {
            corrections: dgps_corrections,
        }
    }

    fn parse_rtcm_text<R: BufRead>(&mut self, reader: R) -> Result<(), Box<dyn std::error::Error>> {
        let mut corrections = HashMap::new();
        let mut station_id = 0u16;
        let mut station_pos = (0.0, 0.0, 0.0);

        for line in reader.lines() {
            let line = line?;
            let parts: Vec<&str> = line.split_whitespace().collect();
            
            if parts.is_empty() {
                continue;
            }

            match parts[0] {
                "STATION" => {
                    if parts.len() >= 5 {
                        station_id = parts[1].parse().unwrap_or(0);
                        station_pos.0 = parts[2].parse().unwrap_or(0.0);
                        station_pos.1 = parts[3].parse().unwrap_or(0.0);
                        station_pos.2 = parts[4].parse().unwrap_or(0.0);
                    }
                }
                "CORR" => {
                    if parts.len() >= 4 {
                        let sat_id = Self::parse_satellite_id(parts[1]);
                        if let Some(sat_id) = sat_id {
                            let pr_corr: f64 = parts[2].parse().unwrap_or(0.0);
                            let pr_rate: f64 = parts[3].parse().unwrap_or(0.0);
                            
                            corrections.insert(sat_id, DgpsCorrection {
                                sat_id,
                                pseudorange_correction: pr_corr,
                                pseudorange_rate_correction: pr_rate,
                                iod: parts.get(4).and_then(|s| s.parse().ok()).unwrap_or(0),
                                update_time: 0.0,
                            });
                        }
                    }
                }
                _ => {}
            }
        }

        self.corrections.station = Some(DgpsStation {
            id: station_id,
            name: format!("DGPS_{}", station_id),
            position: station_pos,
            corrections,
        });

        info!("Loaded DGPS corrections for {} satellites", corrections.len());
        Ok(())
    }

    fn parse_satellite_id(s: &str) -> Option<SatelliteId> {
        if s.len() < 2 {
            return None;
        }
        
        let constellation = Constellation::from_gnss_id(&s[0..1])?;
        let prn: u8 = s[1..].parse().ok()?;
        Some(SatelliteId::new(constellation, prn))
    }

    pub fn apply_correction(
        &self,
        sat_id: &SatelliteId,
        pr: f64,
        time: f64,
    ) -> f64 {
        if let Some(station) = &self.corrections.station {
            if let Some(corr) = station.corrections.get(sat_id) {
                let dt = time - corr.update_time;
                let total_corr = corr.pseudorange_correction + corr.pseudorange_rate_correction * dt;
                pr + total_corr
            } else {
                pr
            }
        } else {
            pr
        }
    }

    pub fn has_correction(&self, sat_id: &SatelliteId) -> bool {
        self.corrections.station.as_ref()
            .and_then(|s| s.corrections.get(sat_id))
            .is_some()
    }

    pub fn correction_count(&self) -> usize {
        self.corrections.station.as_ref()
            .map(|s| s.corrections.len())
            .unwrap_or(0)
    }
}

pub fn generate_simulated_dgps(
    true_position: (f64, f64, f64),
    sat_positions: &[SatellitePosition],
) -> HashMap<SatelliteId, f64> {
    let mut corrections = HashMap::new();
    
    for sat_pos in sat_positions {
        let dx = sat_pos.x - true_position.0;
        let dy = sat_pos.y - true_position.1;
        let dz = sat_pos.z - true_position.2;
        let true_range = (dx * dx + dy * dy + dz * dz).sqrt();
        
        let iono_error = 5.0 + 3.0 * rand::random::<f64>();
        let tropo_error = 2.0 + 1.0 * rand::random::<f64>();
        
        let correction = -(iono_error + tropo_error);
        corrections.insert(sat_pos.sat_id, correction);
    }
    
    corrections
}
