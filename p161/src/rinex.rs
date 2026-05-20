use crate::types::*;
use crate::utils::*;
use chrono::{TimeZone, Utc};
use std::collections::HashMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum RinexError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Unsupported RINEX version: {0}")]
    UnsupportedVersion(String),
}

pub struct RinexParser;

impl RinexParser {
    pub fn parse_observation_file<P: AsRef<Path>>(path: P) -> Result<ObservationFile, RinexError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let lines: Vec<String> = reader.lines().collect::<Result<_, _>>()?;
        
        let (header_end, header) = Self::parse_header(&lines)?;
        let epochs = Self::parse_observation_epochs(&lines, header_end)?;
        
        Ok(ObservationFile { header, epochs })
    }

    pub fn parse_navigation_file<P: AsRef<Path>>(path: P) -> Result<NavigationFile, RinexError> {
        let file = File::open(path)?;
        let reader = BufReader::new(file);
        let lines: Vec<String> = reader.lines().collect::<Result<_, _>>()?;
        
        let (header_end, header) = Self::parse_header(&lines)?;
        let ephemerides = Self::parse_navigation_data(&lines, header_end)?;
        
        Ok(NavigationFile { header, ephemerides })
    }

    fn parse_header(lines: &[String]) -> Result<(usize, RinexHeader), RinexError> {
        let mut version = String::new();
        let mut constellations = Vec::new();
        let mut first_time = None;
        let mut last_time = None;
        let mut interval = None;
        let mut marker_name = String::new();
        let mut observer = String::new();
        let mut agency = String::new();
        let mut approx_pos = None;
        let mut klobuchar_alpha = None;
        let mut klobuchar_beta = None;
        
        let mut header_end = 0;
        
        for (i, line) in lines.iter().enumerate() {
            if line.len() < 60 {
                continue;
            }
            
            let label = &line[60..].trim();
            
            match label {
                "RINEX VERSION / TYPE" => {
                    version = line[0..20].trim().to_string();
                    if !version.starts_with("3.04") {
                        return Err(RinexError::UnsupportedVersion(version));
                    }
                }
                "PGM / RUN BY / DATE" => {}
                "MARKER NAME" => {
                    marker_name = line[0..60].trim().to_string();
                }
                "OBSERVER / AGENCY" => {
                    observer = line[0..20].trim().to_string();
                    agency = line[20..60].trim().to_string();
                }
                "APPROX POSITION XYZ" => {
                    let x: f64 = line[0..14].trim().parse().map_err(|_| RinexError::Parse("approx X".into()))?;
                    let y: f64 = line[14..28].trim().parse().map_err(|_| RinexError::Parse("approx Y".into()))?;
                    let z: f64 = line[28..42].trim().parse().map_err(|_| RinexError::Parse("approx Z".into()))?;
                    approx_pos = Some((x, y, z));
                }
                "TIME OF FIRST OBS" => {
                    first_time = Some(Self::parse_datetime(line)?);
                }
                "TIME OF LAST OBS" => {
                    last_time = Some(Self::parse_datetime(line)?);
                }
                "INTERVAL" => {
                    interval = line[0..10].trim().parse().ok();
                }
                "SYS / # / OBS TYPES" => {
                    if let Some(c) = line.chars().next() {
                        if let Some(con) = Constellation::from_gnss_id(&c.to_string()) {
                            if !constellations.contains(&con) {
                                constellations.push(con);
                            }
                        }
                    }
                }
                "IONOSPHERIC CORR" => {
                    if line.starts_with('G') || line.starts_with("GPS") {
                        if klobuchar_alpha.is_none() {
                            let a0: f64 = Self::parse_float(&line[2..14]);
                            let a1: f64 = Self::parse_float(&line[14..26]);
                            let a2: f64 = Self::parse_float(&line[26..38]);
                            let a3: f64 = Self::parse_float(&line[38..50]);
                            klobuchar_alpha = Some([a0, a1, a2, a3]);
                        } else {
                            let b0: f64 = Self::parse_float(&line[2..14]);
                            let b1: f64 = Self::parse_float(&line[14..26]);
                            let b2: f64 = Self::parse_float(&line[26..38]);
                            let b3: f64 = Self::parse_float(&line[38..50]);
                            klobuchar_beta = Some([b0, b1, b2, b3]);
                        }
                    }
                }
                "ION ALPHA" => {
                    let a0: f64 = Self::parse_float(&line[2..14]);
                    let a1: f64 = Self::parse_float(&line[14..26]);
                    let a2: f64 = Self::parse_float(&line[26..38]);
                    let a3: f64 = Self::parse_float(&line[38..50]);
                    klobuchar_alpha = Some([a0, a1, a2, a3]);
                }
                "ION BETA" => {
                    let b0: f64 = Self::parse_float(&line[2..14]);
                    let b1: f64 = Self::parse_float(&line[14..26]);
                    let b2: f64 = Self::parse_float(&line[26..38]);
                    let b3: f64 = Self::parse_float(&line[38..50]);
                    klobuchar_beta = Some([b0, b1, b2, b3]);
                }
                "END OF HEADER" => {
                    header_end = i + 1;
                    break;
                }
                _ => {}
            }
        }
        
        let klobuchar = match (klobuchar_alpha, klobuchar_beta) {
            (Some(alpha), Some(beta)) => Some(KlobucharParams { alpha, beta }),
            _ => None,
        };
        
        Ok((header_end, RinexHeader {
            version,
            constellations,
            first_time,
            last_time,
            interval,
            marker_name,
            observer,
            agency,
            approx_pos,
            klobuchar,
        }))
    }

    fn parse_float(s: &str) -> f64 {
        let s = s.trim().replace('D', "E");
        s.parse().unwrap_or(0.0)
    }

    fn parse_datetime(line: &str) -> Result<DateTime<Utc>, RinexError> {
        let year: i32 = line[0..6].trim().parse().map_err(|_| RinexError::Parse("year".into()))?;
        let month: u32 = line[6..12].trim().parse().map_err(|_| RinexError::Parse("month".into()))?;
        let day: u32 = line[12..18].trim().parse().map_err(|_| RinexError::Parse("day".into()))?;
        let hour: u32 = line[18..24].trim().parse().map_err(|_| RinexError::Parse("hour".into()))?;
        let min: u32 = line[24..30].trim().parse().map_err(|_| RinexError::Parse("min".into()))?;
        let sec: f64 = line[30..43].trim().parse().map_err(|_| RinexError::Parse("sec".into()))?;
        
        let sec_int = sec.floor() as u32;
        let nanos = ((sec - sec.floor()) * 1e9) as u32;
        
        Utc.with_ymd_and_hms(year, month, day, hour, min, sec_int)
            .map(|dt| dt + chrono::Duration::nanoseconds(nanos as i64))
            .single()
            .ok_or_else(|| RinexError::Parse("datetime".into()))
    }

    fn parse_observation_epochs(lines: &[String], start_idx: usize) -> Result<Vec<EpochData>, RinexError> {
        let mut epochs = Vec::new();
        let mut i = start_idx;
        
        while i < lines.len() {
            let line = &lines[i];
            if line.len() < 32 {
                i += 1;
                continue;
            }
            
            if !line.starts_with('>') {
                i += 1;
                continue;
            }
            
            let year: i32 = line[2..7].trim().parse().map_err(|_| RinexError::Parse("epoch year".into()))?;
            let month: u32 = line[7..12].trim().parse().map_err(|_| RinexError::Parse("epoch month".into()))?;
            let day: u32 = line[12..17].trim().parse().map_err(|_| RinexError::Parse("epoch day".into()))?;
            let hour: u32 = line[17..22].trim().parse().map_err(|_| RinexError::Parse("epoch hour".into()))?;
            let min: u32 = line[22..27].trim().parse().map_err(|_| RinexError::Parse("epoch min".into()))?;
            let sec: f64 = line[27..42].trim().parse().map_err(|_| RinexError::Parse("epoch sec".into()))?;
            let _epoch_flag: u8 = line[42..45].trim().parse().unwrap_or(0);
            let num_sat: usize = line[45..50].trim().parse().unwrap_or(0);
            
            let sec_int = sec.floor() as u32;
            let nanos = ((sec - sec.floor()) * 1e9) as u32;
            
            let time = Utc.with_ymd_and_hms(year, month, day, hour, min, sec_int)
                .map(|dt| dt + chrono::Duration::nanoseconds(nanos as i64))
                .single()
                .ok_or_else(|| RinexError::Parse("epoch datetime".into()))?;
            
            i += 1;
            
            let mut observations = HashMap::new();
            
            for _ in 0..num_sat {
                if i >= lines.len() {
                    break;
                }
                
                let obs_line = &lines[i];
                if obs_line.len() < 3 {
                    i += 1;
                    continue;
                }
                
                let constellation = match Constellation::from_gnss_id(&obs_line[0..1]) {
                    Some(c) => c,
                    None => {
                        i += 1;
                        continue;
                    }
                };
                
                let prn: u8 = obs_line[1..3].trim().parse().unwrap_or(0);
                let sat_id = SatelliteId::new(constellation, prn);
                
                let mut pr = 0.0;
                let mut cp = None;
                let mut snr = None;
                
                if obs_line.len() >= 17 {
                    if let Ok(p) = obs_line[3..17].trim().parse::<f64>() {
                        pr = p;
                    }
                }
                if obs_line.len() >= 31 {
                    cp = obs_line[17..31].trim().parse().ok();
                }
                if obs_line.len() >= 33 {
                    snr = obs_line[31..33].trim().parse::<f64>().ok().map(|x| x);
                }
                
                if pr > 0.0 {
                    observations.insert(sat_id, Observation { pr, cp, snr });
                }
                
                i += 1;
            }
            
            if !observations.is_empty() {
                epochs.push(EpochData { time, observations });
            }
        }
        
        Ok(epochs)
    }

    fn parse_navigation_data(lines: &[String], start_idx: usize) -> Result<HashMap<SatelliteId, Vec<Ephemeris>>, RinexError> {
        let mut ephemerides: HashMap<SatelliteId, Vec<Ephemeris>> = HashMap::new();
        let mut i = start_idx;
        
        while i < lines.len() {
            if i + 7 >= lines.len() {
                break;
            }
            
            let line0 = &lines[i];
            if line0.len() < 23 {
                i += 1;
                continue;
            }
            
            let constellation = match Constellation::from_gnss_id(&line0[0..1]) {
                Some(c) => c,
                None => {
                    i += 1;
                    continue;
                }
            };
            
            let prn: u8 = line0[1..3].trim().parse().unwrap_or(0);
            let sat_id = SatelliteId::new(constellation, prn);
            
            let year: i32 = line0[4..8].trim().parse().unwrap_or(0);
            let month: u32 = line0[9..11].trim().parse().unwrap_or(1);
            let day: u32 = line0[12..14].trim().parse().unwrap_or(1);
            let hour: u32 = line0[15..17].trim().parse().unwrap_or(0);
            let min: u32 = line0[18..20].trim().parse().unwrap_or(0);
            let sec: f64 = line0[21..23].trim().parse().unwrap_or(0.0);
            
            let toc_dt = Utc.with_ymd_and_hms(year, month, day, hour, min, sec.floor() as u32)
                .single()
                .unwrap_or_else(|| Utc::now());
            let (week, toc) = datetime_to_gps_time(toc_dt);
            
            let af0: f64 = Self::parse_nav_value(line0, 23);
            let af1: f64 = Self::parse_nav_value(line0, 42);
            let af2: f64 = Self::parse_nav_value(line0, 61);
            
            i += 1;
            
            let line1 = &lines[i];
            let crs: f64 = Self::parse_nav_value(line1, 4);
            let delta_n: f64 = Self::parse_nav_value(line1, 23);
            let m0: f64 = Self::parse_nav_value(line1, 42);
            
            i += 1;
            
            let line2 = &lines[i];
            let cuc: f64 = Self::parse_nav_value(line2, 4);
            let e: f64 = Self::parse_nav_value(line2, 23);
            let cus: f64 = Self::parse_nav_value(line2, 42);
            let sqrt_a: f64 = Self::parse_nav_value(line2, 61);
            
            i += 1;
            
            let line3 = &lines[i];
            let toe: f64 = Self::parse_nav_value(line3, 4);
            let cic: f64 = Self::parse_nav_value(line3, 23);
            let omega0: f64 = Self::parse_nav_value(line3, 42);
            let cis: f64 = Self::parse_nav_value(line3, 61);
            
            i += 1;
            
            let line4 = &lines[i];
            let i0: f64 = Self::parse_nav_value(line4, 4);
            let crc: f64 = Self::parse_nav_value(line4, 23);
            let omega: f64 = Self::parse_nav_value(line4, 42);
            let omega_dot: f64 = Self::parse_nav_value(line4, 61);
            
            i += 1;
            
            let line5 = &lines[i];
            let idot: f64 = Self::parse_nav_value(line5, 4);
            
            i += 3;
            
            let ephemeris = Ephemeris {
                sat_id,
                toe,
                toc,
                week,
                sqrt_a,
                e,
                i0,
                omega0,
                omega_dot,
                omega,
                m0,
                delta_n,
                cuc,
                cus,
                crc,
                crs,
                cic,
                cis,
                idot,
                af0,
                af1,
                af2,
            };
            
            ephemerides.entry(sat_id).or_default().push(ephemeris);
        }
        
        for eps in ephemerides.values_mut() {
            eps.sort_by(|a, b| a.toe.partial_cmp(&b.toe).unwrap_or(std::cmp::Ordering::Equal));
        }
        
        Ok(ephemerides)
    }

    fn parse_nav_value(line: &str, start: usize) -> f64 {
        if line.len() < start + 19 {
            return 0.0;
        }
        let s = &line[start..start + 19].trim();
        if s.is_empty() {
            return 0.0;
        }
        let s = s.replace('D', "E");
        s.parse().unwrap_or(0.0)
    }
}
