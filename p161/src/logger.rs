use crate::types::*;
use chrono::Utc;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;

pub struct ResidualLogger {
    writer: Option<BufWriter<File>>,
}

impl ResidualLogger {
    pub fn new<P: AsRef<Path>>(path: Option<P>) -> Result<Self, Box<dyn std::error::Error>> {
        let writer = match path {
            Some(p) => {
                let file = File::create(p)?;
                let mut writer = BufWriter::new(file);
                writeln!(writer, "timestamp,satellite_id,pseudorange_residual_m")?;
                Some(writer)
            }
            None => None,
        };

        Ok(Self { writer })
    }

    pub fn log_residuals(&mut self, pos: &ReceiverPosition) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(writer) = &mut self.writer {
            let timestamp = pos.time.to_rfc3339();
            
            for (sat_id, residual) in &pos.residuals {
                writeln!(
                    writer,
                    "{},{},{:.6}",
                    timestamp, sat_id, residual
                )?;
            }
            
            writer.flush()?;
        }
        Ok(())
    }

    pub fn log_summary(&mut self, pos: &ReceiverPosition) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(writer) = &mut self.writer {
            let timestamp = pos.time.to_rfc3339();
            let mean_residual = if !pos.residuals.is_empty() {
                pos.residuals.iter().map(|(_, r)| r.abs()).sum::<f64>() / pos.residuals.len() as f64
            } else {
                0.0
            };
            
            writeln!(
                writer,
                "# SUMMARY: {} - Lat: {:.8}, Lon: {:.8}, Alt: {:.2}, Sats: {}, HDOP: {:.2}, MeanResidual: {:.3}m",
                timestamp, pos.lat, pos.lon, pos.alt, pos.num_satellites, pos.hdop, mean_residual
            )?;
            
            writer.flush()?;
        }
        Ok(())
    }
}

pub fn print_position_info(pos: &ReceiverPosition) {
    println!("========================================");
    println!("Time: {}", pos.time);
    println!("Position (lat, lon, alt):");
    println!("  {:.8}° N", pos.lat);
    println!("  {:.8}° E", pos.lon);
    println!("  {:.2} m", pos.alt);
    println!("XYZ: {:.2}, {:.2}, {:.2}", pos.x, pos.y, pos.z);
    println!("Clock bias: {:.3} ns", pos.clock_bias * 1e9);
    println!("Satellites: {}", pos.num_satellites);
    println!("DOP: GDOP={:.2}, PDOP={:.2}, HDOP={:.2}, VDOP={:.2}", 
             pos.gdop, pos.pdop, pos.hdop, pos.vdop);
    println!("\nPseudorange Residuals:");
    for (sat_id, residual) in &pos.residuals {
        println!("  {}: {:+.3} m", sat_id, residual);
    }
    println!("========================================");
}
