use chrono::{DateTime, Datelike, Timelike, Utc};
use std::f64::consts::PI;

pub const EARTH_RADIUS: f64 = 6378137.0;
pub const EARTH_FLATTENING: f64 = 1.0 / 298.257223563;
pub const EARTH_ECC2: f64 = EARTH_FLATTENING * (2.0 - EARTH_FLATTENING);
pub const EARTH_OMEGA: f64 = 7.2921151467e-5;
pub const SPEED_OF_LIGHT: f64 = 299792458.0;
pub const GPS_WEEK_SECONDS: f64 = 604800.0;
pub const MU: f64 = 3.986005e14;

pub fn datetime_to_gps_time(dt: DateTime<Utc>) -> (i32, f64) {
    let gps_epoch = Utc::with_ymd_and_hms(&Utc, 1980, 1, 6, 0, 0, 0).unwrap();
    let duration = dt.signed_duration_since(gps_epoch);
    let total_seconds = duration.num_seconds() as f64 + duration.subsec_nanos() as f64 / 1e9;
    let week = (total_seconds / GPS_WEEK_SECONDS).floor() as i32;
    let seconds = total_seconds - (week as f64) * GPS_WEEK_SECONDS;
    (week, seconds)
}

pub fn gps_time_to_datetime(week: i32, seconds: f64) -> DateTime<Utc> {
    let gps_epoch = Utc::with_ymd_and_hms(&Utc, 1980, 1, 6, 0, 0, 0).unwrap();
    let total_seconds = week as f64 * GPS_WEEK_SECONDS + seconds;
    let secs = total_seconds.floor() as i64;
    let nanos = ((total_seconds - secs as f64) * 1e9) as u32;
    gps_epoch + chrono::Duration::seconds(secs) + chrono::Duration::nanoseconds(nanos as i64)
}

pub fn xyz_to_lla(x: f64, y: f64, z: f64) -> (f64, f64, f64) {
    let p = (x * x + y * y).sqrt();
    let theta = (z * EARTH_RADIUS / (p * (1.0 - EARTH_ECC2))).atan();
    
    let lon = y.atan2(x);
    let mut lat = (z + EARTH_ECC2 * (1.0 - EARTH_ECC2) * EARTH_RADIUS * theta.sin().powi(3)).atan2(
        p - EARTH_ECC2 * EARTH_RADIUS * theta.cos().powi(3),
    );
    
    let mut n = EARTH_RADIUS / (1.0 - EARTH_ECC2 * lat.sin().powi(2)).sqrt();
    let mut alt = p / lat.cos() - n;
    
    for _ in 0..5 {
        n = EARTH_RADIUS / (1.0 - EARTH_ECC2 * lat.sin().powi(2)).sqrt();
        alt = p / lat.cos() - n;
        lat = (z / p / (1.0 - EARTH_ECC2 * n / (n + alt))).atan();
    }
    
    (lat.to_degrees(), lon.to_degrees(), alt)
}

pub fn lla_to_xyz(lat: f64, lon: f64, alt: f64) -> (f64, f64, f64) {
    let lat_rad = lat.to_radians();
    let lon_rad = lon.to_radians();
    
    let n = EARTH_RADIUS / (1.0 - EARTH_ECC2 * lat_rad.sin().powi(2)).sqrt();
    
    let x = (n + alt) * lat_rad.cos() * lon_rad.cos();
    let y = (n + alt) * lat_rad.cos() * lon_rad.sin();
    let z = (n * (1.0 - EARTH_ECC2) + alt) * lat_rad.sin();
    
    (x, y, z)
}

pub fn wrap_pi(angle: f64) -> f64 {
    let mut a = angle;
    while a > PI {
        a -= 2.0 * PI;
    }
    while a < -PI {
        a += 2.0 * PI;
    }
    a
}

pub fn wrap_2pi(angle: f64) -> f64 {
    let mut a = angle;
    while a >= 2.0 * PI {
        a -= 2.0 * PI;
    }
    while a < 0.0 {
        a += 2.0 * PI;
    }
    a
}

pub fn normalize_angle_deg(angle: f64) -> f64 {
    let mut a = angle;
    while a >= 360.0 {
        a -= 360.0;
    }
    while a < 0.0 {
        a += 360.0;
    }
    a
}

pub fn klobuchar_ionospheric_delay(
    params: &crate::types::KlobucharParams,
    lat: f64,
    lon: f64,
    az: f64,
    el: f64,
    tow: f64,
    freq: f64,
) -> f64 {
    let lat_rad = lat.to_radians();
    let lon_rad = lon.to_radians();
    let az_rad = az.to_radians();
    let el_rad = el.to_radians();

    let a = (0.1352 + (el_rad / PI).abs()).powi(-3);
    let psi = 0.0137 * a - 0.0225;

    let phi_i = lat_rad / PI + psi * az_rad.cos();
    let phi_i = phi_i.clamp(-0.416, 0.416);

    let lambda_i = lon_rad / PI + psi * az_rad.sin() / phi_i.cos();

    let phi_m = phi_i + 0.064 * (lambda_i - 1.617).cos();

    let t = 4.32e4 * lambda_i + tow;
    let t = t.rem_euclid(86400.0);

    let amp = params.alpha[0] + params.alpha[1] * phi_m 
            + params.alpha[2] * phi_m.powi(2) + params.alpha[3] * phi_m.powi(3);
    let amp = amp.max(0.0);

    let period = params.beta[0] + params.beta[1] * phi_m 
               + params.beta[2] * phi_m.powi(2) + params.beta[3] * phi_m.powi(3);
    let period = period.max(72000.0);

    let x = 2.0 * PI * (t - 50400.0) / period;

    let f_iono = if x.abs() < 1.57 {
        5e-9 + amp * (1.0 - x * x / 2.0 + x.powi(4) / 24.0)
    } else {
        5e-9
    };

    let f = 1575420000.0 / freq;
    let delay = f_iono * f * f * SPEED_OF_LIGHT;

    delay.max(0.0)
}

pub fn satellite_azimuth_elevation(
    rx_x: f64,
    rx_y: f64,
    rx_z: f64,
    sat_x: f64,
    sat_y: f64,
    sat_z: f64,
) -> (f64, f64) {
    let (rx_lat, rx_lon, _) = xyz_to_lla(rx_x, rx_y, rx_z);
    let lat_rad = rx_lat.to_radians();
    let lon_rad = rx_lon.to_radians();

    let dx = sat_x - rx_x;
    let dy = sat_y - rx_y;
    let dz = sat_z - rx_z;

    let sin_lat = lat_rad.sin();
    let cos_lat = lat_rad.cos();
    let sin_lon = lon_rad.sin();
    let cos_lon = lon_rad.cos();

    let e = -sin_lon * dx + cos_lon * dy;
    let n = -sin_lat * cos_lon * dx - sin_lat * sin_lon * dy + cos_lat * dz;
    let u = cos_lat * cos_lon * dx + cos_lat * sin_lon * dy + sin_lat * dz;

    let az = e.atan2(n);
    let mut az_deg = az.to_degrees();
    if az_deg < 0.0 {
        az_deg += 360.0;
    }

    let dist = (e * e + n * n + u * u).sqrt();
    let el = if dist > 0.0 { (u / dist).asin() } else { 0.0 };
    let el_deg = el.to_degrees();

    (az_deg, el_deg)
}
