use chrono::{DateTime, Utc};
use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Constellation {
    GPS,
    GLONASS,
    Galileo,
}

impl Constellation {
    pub fn from_gnss_id(id: &str) -> Option<Self> {
        match id {
            "G" => Some(Constellation::GPS),
            "R" => Some(Constellation::GLONASS),
            "E" => Some(Constellation::Galileo),
            _ => None,
        }
    }

    pub fn speed_of_light(&self) -> f64 {
        299792458.0
    }

    pub fn freq_l1(&self) -> f64 {
        match self {
            Constellation::GPS => 1575420000.0,
            Constellation::GLONASS => 1602000000.0,
            Constellation::Galileo => 1575420000.0,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct SatelliteId {
    pub constellation: Constellation,
    pub prn: u8,
}

impl SatelliteId {
    pub fn new(constellation: Constellation, prn: u8) -> Self {
        Self { constellation, prn }
    }
}

impl std::fmt::Display for SatelliteId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let c = match self.constellation {
            Constellation::GPS => 'G',
            Constellation::GLONASS => 'R',
            Constellation::Galileo => 'E',
        };
        write!(f, "{}{:02}", c, self.prn)
    }
}

#[derive(Debug, Clone)]
pub struct EpochData {
    pub time: DateTime<Utc>,
    pub observations: HashMap<SatelliteId, Observation>,
}

#[derive(Debug, Clone)]
pub struct Observation {
    pub pr: f64,
    pub cp: Option<f64>,
    pub snr: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct Ephemeris {
    pub sat_id: SatelliteId,
    pub toe: f64,
    pub toc: f64,
    pub week: i32,
    pub sqrt_a: f64,
    pub e: f64,
    pub i0: f64,
    pub omega0: f64,
    pub omega_dot: f64,
    pub omega: f64,
    pub m0: f64,
    pub delta_n: f64,
    pub cuc: f64,
    pub cus: f64,
    pub crc: f64,
    pub crs: f64,
    pub cic: f64,
    pub cis: f64,
    pub idot: f64,
    pub af0: f64,
    pub af1: f64,
    pub af2: f64,
}

#[derive(Debug, Clone)]
pub struct SatellitePosition {
    pub sat_id: SatelliteId,
    pub time: DateTime<Utc>,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub clock_bias: f64,
}

#[derive(Debug, Clone)]
pub struct ReceiverPosition {
    pub time: DateTime<Utc>,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub lat: f64,
    pub lon: f64,
    pub alt: f64,
    pub clock_bias: f64,
    pub num_satellites: usize,
    pub gdop: f64,
    pub pdop: f64,
    pub hdop: f64,
    pub vdop: f64,
    pub residuals: Vec<(SatelliteId, f64)>,
}

#[derive(Debug, Clone)]
pub struct KlobucharParams {
    pub alpha: [f64; 4],
    pub beta: [f64; 4],
}

impl Default for KlobucharParams {
    fn default() -> Self {
        KlobucharParams {
            alpha: [1.67e-8, 0.0, -1.19e-7, 0.0],
            beta: [1.31e+5, 0.0, -2.62e+5, 0.0],
        }
    }
}

#[derive(Debug, Clone)]
pub struct RinexHeader {
    pub version: String,
    pub constellations: Vec<Constellation>,
    pub first_time: Option<DateTime<Utc>>,
    pub last_time: Option<DateTime<Utc>>,
    pub interval: Option<f64>,
    pub marker_name: String,
    pub observer: String,
    pub agency: String,
    pub approx_pos: Option<(f64, f64, f64)>,
    pub klobuchar: Option<KlobucharParams>,
}

#[derive(Debug, Clone)]
pub struct ObservationFile {
    pub header: RinexHeader,
    pub epochs: Vec<EpochData>,
}

#[derive(Debug, Clone)]
pub struct NavigationFile {
    pub header: RinexHeader,
    pub ephemerides: HashMap<SatelliteId, Vec<Ephemeris>>,
}

#[derive(Debug, Clone)]
pub enum BroadcastProtocol {
    TCP,
    UDP,
}

#[derive(Debug, Clone)]
pub struct BroadcastConfig {
    pub protocol: BroadcastProtocol,
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone)]
pub struct DgpsCorrection {
    pub sat_id: SatelliteId,
    pub pseudorange_correction: f64,
    pub pseudorange_rate_correction: f64,
    pub iod: u8,
    pub update_time: f64,
}

#[derive(Debug, Clone)]
pub struct DgpsStation {
    pub id: u16,
    pub name: String,
    pub position: (f64, f64, f64),
    pub corrections: std::collections::HashMap<SatelliteId, DgpsCorrection>,
}

#[derive(Debug, Clone)]
pub struct DgpsCorrections {
    pub station: Option<DgpsStation>,
    pub reference_time: Option<chrono::DateTime<chrono::Utc>>,
}

impl Default for DgpsCorrections {
    fn default() -> Self {
        DgpsCorrections {
            station: None,
            reference_time: None,
        }
    }
}
