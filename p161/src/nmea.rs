use crate::types::*;
use crate::utils::normalize_angle_deg;
use chrono::{Datelike, Timelike};

pub struct NmeaGenerator;

impl NmeaGenerator {
    pub fn generate_gga(pos: &ReceiverPosition) -> String {
        let time = pos.time;
        let lat = pos.lat;
        let lon = pos.lon;
        let alt = pos.alt;
        let hdop = pos.hdop;
        let num_sat = pos.num_satellites;

        let time_str = format!(
            "{:02}{:02}{:02}.{:03}",
            time.hour(),
            time.minute(),
            time.second(),
            time.nanosecond() / 1_000_000
        );

        let (lat_deg, lat_min, lat_dir) = Self::deg_to_dm(lat, true);
        let (lon_deg, lon_min, lon_dir) = Self::deg_to_dm(lon, false);

        let lat_str = format!("{:02}{:010.7},{}", lat_deg, lat_min, lat_dir);
        let lon_str = format!("{:03}{:010.7},{}", lon_deg, lon_min, lon_dir);

        let sentence = format!(
            "$GPGGA,{},{},{},1,{:02},{:.1},{:.2},M,0.0,M,,",
            time_str, lat_str, lon_str, num_sat.min(99), hdop, alt
        );

        let checksum = Self::calculate_checksum(&sentence[1..]);
        format!("{}*{:02X}\r\n", sentence, checksum)
    }

    pub fn generate_rmc(pos: &ReceiverPosition) -> String {
        let time = pos.time;
        let lat = pos.lat;
        let lon = pos.lon;
        let speed_knots = 0.0;
        let course = 0.0;

        let time_str = format!(
            "{:02}{:02}{:02}.{:02}",
            time.hour(),
            time.minute(),
            time.second(),
            time.nanosecond() / 10_000_000
        );

        let date_str = format!(
            "{:02}{:02}{:02}",
            time.day(),
            time.month(),
            time.year() % 100
        );

        let (lat_deg, lat_min, lat_dir) = Self::deg_to_dm(lat, true);
        let (lon_deg, lon_min, lon_dir) = Self::deg_to_dm(lon, false);

        let lat_str = format!("{:02}{:07.4},{}", lat_deg, lat_min, lat_dir);
        let lon_str = format!("{:03}{:07.4},{}", lon_deg, lon_min, lon_dir);

        let sentence = format!(
            "$GPRMC,{},A,{},{},{:.2},{:.2},{},{},,A",
            time_str, lat_str, lon_str, speed_knots, course, date_str, 0.0
        );

        let checksum = Self::calculate_checksum(&sentence[1..]);
        format!("{}*{:02X}\r\n", sentence, checksum)
    }

    pub fn generate_gsa(pos: &ReceiverPosition, sat_ids: &[SatelliteId]) -> String {
        let mut sat_prns: Vec<String> = sat_ids
            .iter()
            .take(12)
            .map(|s| format!("{:02}", s.prn))
            .collect();
        
        while sat_prns.len() < 12 {
            sat_prns.push(String::new());
        }

        let sentence = format!(
            "$GPGSA,A,3,{},,,,,,,,,,{:.1},{:.1},{:.1}",
            sat_prns.join(","),
            pos.pdop,
            pos.hdop,
            pos.vdop
        );

        let checksum = Self::calculate_checksum(&sentence[1..]);
        format!("{}*{:02X}\r\n", sentence, checksum)
    }

    pub fn generate_gsv(satellites: &[SatelliteId], elevations: &[f64], azimuths: &[f64], snrs: &[f64]) -> Vec<String> {
        let num_msgs = ((satellites.len() + 3) / 4).max(1);
        let mut messages = Vec::new();

        for msg_idx in 0..num_msgs {
            let start = msg_idx * 4;
            let end = (start + 4).min(satellites.len());

            let mut sat_data = String::new();
            for i in start..end {
                let elev = elevations.get(i).copied().unwrap_or(0.0);
                let az = azimuths.get(i).copied().unwrap_or(0.0);
                let snr = snrs.get(i).copied().unwrap_or(0.0);
                
                sat_data.push_str(&format!(
                    "{:02},{:02.0},{:03.0},{:02.0},",
                    satellites[i].prn,
                    elev,
                    az,
                    snr
                ));
            }
            sat_data.pop();

            let sentence = format!(
                "$GPGSV,{},{},{:02},{}",
                num_msgs,
                msg_idx + 1,
                satellites.len(),
                sat_data
            );

            let checksum = Self::calculate_checksum(&sentence[1..]);
            messages.push(format!("{}*{:02X}\r\n", sentence, checksum));
        }

        messages
    }

    pub fn generate_vtg(pos: &ReceiverPosition) -> String {
        let course = 0.0;
        let speed_knots = 0.0;
        let speed_kmh = speed_knots * 1.852;

        let sentence = format!(
            "$GPVTG,{:.2},T,,M,{:.2},N,{:.2},K,A",
            course, speed_knots, speed_kmh
        );

        let checksum = Self::calculate_checksum(&sentence[1..]);
        format!("{}*{:02X}\r\n", sentence, checksum)
    }

    fn deg_to_dm(deg: f64, is_lat: bool) -> (i32, f64, char) {
        let dir = if is_lat {
            if deg >= 0.0 { 'N' } else { 'S' }
        } else {
            if deg >= 0.0 { 'E' } else { 'W' }
        };

        let abs_deg = deg.abs();
        let deg_int = abs_deg.floor() as i32;
        let minutes = (abs_deg - deg_int as f64) * 60.0;

        (deg_int, minutes, dir)
    }

    fn calculate_checksum(s: &str) -> u8 {
        s.bytes().fold(0, |acc, b| acc ^ b)
    }

    pub fn generate_all(pos: &ReceiverPosition) -> Vec<String> {
        let mut output = Vec::new();
        output.push(Self::generate_rmc(pos));
        output.push(Self::generate_gga(pos));
        output.push(Self::generate_vtg(pos));
        output
    }
}
