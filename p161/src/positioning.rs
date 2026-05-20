use crate::types::*;
use crate::utils::*;
use log::{info, warn};

pub struct PositionSolver;

impl PositionSolver {
    pub fn solve_leastsquares(
        observations: &[(SatelliteId, f64, SatellitePosition)],
        approx_pos: Option<(f64, f64, f64)>,
    ) -> Result<ReceiverPosition, &'static str> {
        if observations.len() < 4 {
            return Err("Need at least 4 satellites for positioning");
        }

        let (mut x, mut y, mut z) = match approx_pos {
            Some(pos) => pos,
            None => Self::estimate_initial_position(observations),
        };
        let mut clk_bias = 0.0;

        info!("Initial position: ({:.1}, {:.1}, {:.1}) m", x, y, z);

        let mut converged = false;
        for iter in 0..30 {
            let mut h_matrix = Vec::new();
            let mut y_vector = Vec::new();

            for (_, pr, sat_pos) in observations {
                let dx = sat_pos.x - x;
                let dy = sat_pos.y - y;
                let dz = sat_pos.z - z;
                let range = (dx * dx + dy * dy + dz * dz).sqrt();

                if range < 1.0 {
                    continue;
                }

                let rho_c = range + SPEED_OF_LIGHT * clk_bias - SPEED_OF_LIGHT * sat_pos.clock_bias;

                h_matrix.push([
                    -dx / range,
                    -dy / range,
                    -dz / range,
                    1.0,
                ]);

                y_vector.push(pr - rho_c);
            }

            if h_matrix.len() < 4 {
                return Err("Not enough valid satellites");
            }

            let n = h_matrix.len();
            let m = 4;

            let mut ata = [[0.0; 4]; 4];
            let mut aty = [0.0; 4];

            for i in 0..n {
                for j in 0..m {
                    aty[j] += h_matrix[i][j] * y_vector[i];
                    for k in 0..m {
                        ata[j][k] += h_matrix[i][j] * h_matrix[i][k];
                    }
                }
            }

            let det = Self::determinant_4x4(&ata);
            if det.abs() < 1e-12 {
                return Err("Matrix singular");
            }

            let inv_ata = Self::inverse_4x4(&ata);
            let mut dx = [0.0; 4];

            for i in 0..4 {
                for j in 0..4 {
                    dx[i] += inv_ata[i][j] * aty[j];
                }
            }

            let step_size = (dx[0] * dx[0] + dx[1] * dx[1] + dx[2] * dx[2]).sqrt();
            if step_size > 10000.0 {
                let scale = 10000.0 / step_size;
                dx[0] *= scale;
                dx[1] *= scale;
                dx[2] *= scale;
                dx[3] *= scale;
                warn!("Iteration {}: Step size too large, scaled down", iter);
            }

            x += dx[0];
            y += dx[1];
            z += dx[2];
            clk_bias += dx[3] / SPEED_OF_LIGHT;

            let pos_mag = (x * x + y * y + z * z).sqrt();
            if pos_mag > EARTH_RADIUS + 100000.0 {
                let scale = (EARTH_RADIUS + 100000.0) / pos_mag;
                x *= scale;
                y *= scale;
                z *= scale;
                warn!("Iteration {}: Position outside Earth, constrained", iter);
            }

            if dx[0].abs() < 1e-3 && dx[1].abs() < 1e-3 && dx[2].abs() < 1e-3 {
                converged = true;
                info!("Converged after {} iterations", iter + 1);
                break;
            }
        }

        if !converged {
            warn!("Did not converge after max iterations");
        }

        let (lat, lon, alt) = xyz_to_lla(x, y, z);

        let mut h_matrix = Vec::new();
        for (_, _, sat_pos) in observations {
            let dx = sat_pos.x - x;
            let dy = sat_pos.y - y;
            let dz = sat_pos.z - z;
            let range = (dx * dx + dy * dy + dz * dz).sqrt();

            if range < 1.0 {
                continue;
            }

            h_matrix.push([
                -dx / range,
                -dy / range,
                -dz / range,
                1.0,
            ]);
        }

        let n = h_matrix.len();
        let mut ata = [[0.0; 4]; 4];
        for i in 0..n {
            for j in 0..4 {
                for k in 0..4 {
                    ata[j][k] += h_matrix[i][j] * h_matrix[i][k];
                }
            }
        }

        let q = Self::inverse_4x4(&ata);
        let gdop = (q[0][0] + q[1][1] + q[2][2] + q[3][3]).sqrt();
        let pdop = (q[0][0] + q[1][1] + q[2][2]).sqrt();
        
        let lat_rad = lat.to_radians();
        let lon_rad = lon.to_radians();
        let t = [
            [-lat_rad.sin() * lon_rad.cos(), -lat_rad.sin() * lon_rad.sin(), lat_rad.cos()],
            [-lon_rad.sin(), lon_rad.cos(), 0.0],
            [lat_rad.cos() * lon_rad.cos(), lat_rad.cos() * lon_rad.sin(), lat_rad.sin()],
        ];
        
        let mut q_enu = [[0.0; 3]; 3];
        for i in 0..3 {
            for j in 0..3 {
                for k in 0..3 {
                    for l in 0..3 {
                        q_enu[i][j] += t[i][k] * q[k][l] * t[j][l];
                    }
                }
            }
        }
        
        let hdop = (q_enu[0][0] + q_enu[1][1]).sqrt();
        let vdop = q_enu[2][2].sqrt();

        let mut residuals = Vec::new();
        for (sat_id, pr, sat_pos) in observations {
            let dx = sat_pos.x - x;
            let dy = sat_pos.y - y;
            let dz = sat_pos.z - z;
            let range = (dx * dx + dy * dy + dz * dz).sqrt();
            let rho_c = range + SPEED_OF_LIGHT * clk_bias - SPEED_OF_LIGHT * sat_pos.clock_bias;
            residuals.push((*sat_id, pr - rho_c));
        }

        Ok(ReceiverPosition {
            time: observations[0].2.time,
            x,
            y,
            z,
            lat,
            lon,
            alt,
            clock_bias: clk_bias,
            num_satellites: observations.len(),
            gdop,
            pdop,
            hdop,
            vdop,
            residuals,
        })
    }

    fn determinant_4x4(m: &[[f64; 4]; 4]) -> f64 {
        m[0][0] * (
            m[1][1] * (m[2][2] * m[3][3] - m[2][3] * m[3][2]) -
            m[1][2] * (m[2][1] * m[3][3] - m[2][3] * m[3][1]) +
            m[1][3] * (m[2][1] * m[3][2] - m[2][2] * m[3][1])
        ) -
        m[0][1] * (
            m[1][0] * (m[2][2] * m[3][3] - m[2][3] * m[3][2]) -
            m[1][2] * (m[2][0] * m[3][3] - m[2][3] * m[3][0]) +
            m[1][3] * (m[2][0] * m[3][2] - m[2][2] * m[3][0])
        ) +
        m[0][2] * (
            m[1][0] * (m[2][1] * m[3][3] - m[2][3] * m[3][1]) -
            m[1][1] * (m[2][0] * m[3][3] - m[2][3] * m[3][0]) +
            m[1][3] * (m[2][0] * m[3][1] - m[2][1] * m[3][0])
        ) -
        m[0][3] * (
            m[1][0] * (m[2][1] * m[3][2] - m[2][2] * m[3][1]) -
            m[1][1] * (m[2][0] * m[3][2] - m[2][2] * m[3][0]) +
            m[1][2] * (m[2][0] * m[3][1] - m[2][1] * m[3][0])
        )
    }

    fn inverse_4x4(m: &[[f64; 4]; 4]) -> [[f64; 4]; 4] {
        let det = Self::determinant_4x4(m);
        if det.abs() < 1e-20 {
            return [[0.0; 4]; 4];
        }

        let mut inv = [[0.0; 4]; 4];
        
        for i in 0..4 {
            for j in 0..4 {
                let sign = if (i + j) % 2 == 0 { 1.0 } else { -1.0 };
                inv[j][i] = sign * Self::cofactor_3x3(m, i, j) / det;
            }
        }
        
        inv
    }

    fn cofactor_3x3(m: &[[f64; 4]; 4], row: usize, col: usize) -> f64 {
        let mut sub = [[0.0; 3]; 3];
        let mut si = 0;
        for i in 0..4 {
            if i == row {
                continue;
            }
            let mut sj = 0;
            for j in 0..4 {
                if j == col {
                    continue;
                }
                sub[si][sj] = m[i][j];
                sj += 1;
            }
            si += 1;
        }
        
        sub[0][0] * (sub[1][1] * sub[2][2] - sub[1][2] * sub[2][1]) -
        sub[0][1] * (sub[1][0] * sub[2][2] - sub[1][2] * sub[2][0]) +
        sub[0][2] * (sub[1][0] * sub[2][1] - sub[1][1] * sub[2][0])
    }

    fn estimate_initial_position(observations: &[(SatelliteId, f64, SatellitePosition)]) -> (f64, f64, f64) {
        if observations.is_empty() {
            return (0.0, 0.0, 0.0);
        }

        let mut sum_x = 0.0;
        let mut sum_y = 0.0;
        let mut sum_z = 0.0;
        let mut sum_pr = 0.0;

        for (_, pr, sat_pos) in observations {
            sum_x += sat_pos.x;
            sum_y += sat_pos.y;
            sum_z += sat_pos.z;
            sum_pr += *pr;
        }

        let n = observations.len() as f64;
        let avg_x = sum_x / n;
        let avg_y = sum_y / n;
        let avg_z = sum_z / n;
        let avg_pr = sum_pr / n;

        let center_dist = (avg_x * avg_x + avg_y * avg_y + avg_z * avg_z).sqrt();
        if center_dist < 1.0 {
            return (EARTH_RADIUS, 0.0, 0.0);
        }

        let scale = (avg_pr - 26500000.0).max(EARTH_RADIUS) / center_dist;
        
        (avg_x * scale, avg_y * scale, avg_z * scale)
    }
}
