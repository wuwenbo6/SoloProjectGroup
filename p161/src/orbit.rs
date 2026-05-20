use crate::types::*;
use crate::utils::*;
use std::f64::consts::PI;

pub struct OrbitCalculator;

impl OrbitCalculator {
    pub fn calculate_satellite_position(
        ephemeris: &Ephemeris,
        time: f64,
        week: i32,
    ) -> SatellitePosition {
        let a = ephemeris.sqrt_a * ephemeris.sqrt_a;
        let n0 = (MU / (a * a * a)).sqrt();
        let tk = time - ephemeris.toe;
        
        let mut t_k = tk;
        if t_k > 302400.0 {
            t_k -= 604800.0;
        }
        if t_k < -302400.0 {
            t_k += 604800.0;
        }
        
        let n = n0 + ephemeris.delta_n;
        let mut mk = ephemeris.m0 + n * t_k;
        mk = wrap_2pi(mk);
        
        let mut ek = mk;
        for _ in 0..10 {
            ek = mk + ephemeris.e * ek.sin();
        }
        
        let sin_e = ek.sin();
        let cos_e = ek.cos();
        let vk = ((1.0 - ephemeris.e * ephemeris.e).sqrt() * sin_e / (1.0 - ephemeris.e * cos_e)).atan2(
            (cos_e - ephemeris.e) / (1.0 - ephemeris.e * cos_e),
        );
        
        let phi_k = vk + ephemeris.omega;
        let phi_k = wrap_2pi(phi_k);
        
        let sin_2phi = (2.0 * phi_k).sin();
        let cos_2phi = (2.0 * phi_k).cos();
        
        let delta_uk = ephemeris.cus * sin_2phi + ephemeris.cuc * cos_2phi;
        let delta_rk = ephemeris.crs * sin_2phi + ephemeris.crc * cos_2phi;
        let delta_ik = ephemeris.cis * sin_2phi + ephemeris.cic * cos_2phi;
        
        let uk = phi_k + delta_uk;
        let rk = a * (1.0 - ephemeris.e * cos_e) + delta_rk;
        let ik = ephemeris.i0 + delta_ik + ephemeris.idot * t_k;
        
        let x_p = rk * uk.cos();
        let y_p = rk * uk.sin();
        
        let omega_k = ephemeris.omega0 + (ephemeris.omega_dot - EARTH_OMEGA) * t_k - EARTH_OMEGA * ephemeris.toe;
        let omega_k = wrap_2pi(omega_k);
        
        let cos_omega = omega_k.cos();
        let sin_omega = omega_k.sin();
        let cos_i = ik.cos();
        let sin_i = ik.sin();
        
        let x = x_p * cos_omega - y_p * cos_i * sin_omega;
        let y = x_p * sin_omega + y_p * cos_i * cos_omega;
        let z = y_p * sin_i;
        
        let dt = time - ephemeris.toc;
        let clock_bias = ephemeris.af0 + ephemeris.af1 * dt + ephemeris.af2 * dt * dt;
        let relativistic = -4.442807633e-10 * ephemeris.e * ephemeris.sqrt_a * ek.sin();
        let total_clock_bias = clock_bias + relativistic;
        
        SatellitePosition {
            sat_id: ephemeris.sat_id,
            time: gps_time_to_datetime(week, time),
            x,
            y,
            z,
            clock_bias: total_clock_bias,
        }
    }

    pub fn find_ephemeris_for_time<'a>(
        ephemerides: &'a [Ephemeris],
        time: f64,
    ) -> Option<&'a Ephemeris> {
        if ephemerides.is_empty() {
            return None;
        }
        
        let mut best_idx = 0;
        let mut best_diff = f64::INFINITY;
        
        for (i, eph) in ephemerides.iter().enumerate() {
            let diff = (time - eph.toe).abs();
            if diff < best_diff {
                best_diff = diff;
                best_idx = i;
            }
        }
        
        Some(&ephemerides[best_idx])
    }

    pub fn get_satellite_positions(
        nav_file: &NavigationFile,
        time: f64,
        week: i32,
        constellations: &[Constellation],
    ) -> Vec<SatellitePosition> {
        let mut positions = Vec::new();
        
        for (sat_id, ephemerides) in &nav_file.ephemerides {
            if !constellations.is_empty() && !constellations.contains(&sat_id.constellation) {
                continue;
            }
            
            if let Some(eph) = Self::find_ephemeris_for_time(ephemerides, time) {
                let pos = Self::calculate_satellite_position(eph, time, week);
                positions.push(pos);
            }
        }
        
        positions
    }
}
