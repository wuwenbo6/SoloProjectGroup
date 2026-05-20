# RINEX2NMEA - RINEX to NMEA Converter

A Rust CLI tool that reads RINEX 3.04 observation and navigation files, simulates GPS satellite motion, calculates receiver position using least squares, outputs NMEA 0183 sentences, and supports TCP/UDP broadcasting.

## Features

- **RINEX 3.04 Support**: Parse both observation (OBS) and navigation (NAV) files
- **Multi-Constellation**: GPS, GLONASS, and Galileo support
- **Precise Orbit Calculation**: Keplerian orbit propagation with relativistic corrections
- **Least Squares Positioning**: Weighted least squares solver with DOP calculation
- **NMEA 0183 Output**: GGA, RMC, VTG, GSA, GSV sentences
- **Network Broadcast**: TCP server and UDP broadcast support
- **Residual Logging**: CSV logging of pseudorange residuals for analysis

## Installation

### Prerequisites

- Rust 1.70+ (https://rustup.rs/)

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Build

```bash
cargo build --release
```

The binary will be available at `target/release/rinex2nmea`

## Usage

### Basic Usage

```bash
rinex2nmea --obs observations.obs --nav navigation.nav
```

### With NMEA Broadcast

```bash
# TCP server on port 10110
rinex2nmea --obs data.obs --nav data.nav --tcp 0.0.0.0:10110

# UDP broadcast
rinex2nmea --obs data.obs --nav data.nav --udp 255.255.255.255:10110
```

### Select Constellation

```bash
rinex2nmea --obs data.obs --nav data.nav --constellation gps
rinex2nmea --obs data.obs --nav data.nav --constellation glonass
rinex2nmea --obs data.obs --nav data.nav --constellation galileo
rinex2nmea --obs data.obs --nav data.nav --constellation all
```

### Log Residuals

```bash
rinex2nmea --obs data.obs --nav data.nav --log-residuals residuals.csv
```

### Full Options

```bash
rinex2nmea \
  --obs observations.obs \
  --nav navigation.nav \
  --constellation all \
  --interval 1000 \
  --tcp 0.0.0.0:10110 \
  --log-residuals residuals.csv \
  --print-nmea \
  --verbose \
  --start-epoch 0 \
  --end-epoch 100
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--obs` | Path to RINEX observation file (required) | - |
| `--nav` | Path to RINEX navigation file (required) | - |
| `--constellation` | GNSS constellation: gps, glonass, galileo, all | all |
| `--interval` | Epoch interval in milliseconds | 1000 |
| `--tcp` | TCP server address (host:port) | - |
| `--udp` | UDP broadcast address (host:port) | - |
| `--log-residuals` | CSV file path for pseudorange residuals | - |
| `--print-nmea` | Print NMEA sentences to stdout | false |
| `--verbose` | Enable verbose logging | false |
| `--start-epoch` | Start processing from epoch index | 0 |
| `--end-epoch` | Stop processing at epoch index | last |

## Output Format

### NMEA Sentences

The tool generates standard NMEA 0183 sentences:

- **$GPGGA**: Global Positioning System Fix Data
- **$GPRMC**: Recommended Minimum Specific GPS/TRANSIT Data
- **$GPVTG**: Track Made Good and Ground Speed

### Residual Log Format

CSV file format:
```
timestamp,satellite_id,pseudorange_residual_m
2024-01-01T12:00:00+00:00,G01,2.345678
2024-01-01T12:00:00+00:00,G02,-1.234567
```

## Project Structure

```
src/
├── main.rs          # CLI entry point
├── lib.rs           # Library exports
├── types.rs         # Data structures and types
├── rinex.rs         # RINEX 3.04 file parser
├── orbit.rs         # Satellite orbit calculation
├── positioning.rs   # Least squares positioning
├── nmea.rs          # NMEA 0183 sentence generation
├── broadcast.rs     # TCP/UDP network broadcasting
├── logger.rs        # Residual logging utilities
└── utils.rs         # Helper functions (coordinate transforms, etc.)
```

## Technical Details

### Positioning Algorithm

1. **Satellite Position Calculation**: Keplerian orbit propagation using broadcast ephemeris
2. **Pseudorange Correction**: Clock bias correction, relativistic correction
3. **Least Squares Solver**: Gauss-Newton iteration with convergence criteria
4. **DOP Calculation**: GDOP, PDOP, HDOP, VDOP from covariance matrix

### Coordinate Systems

- ECEF (Earth-Centered, Earth-Fixed) for satellite positions
- WGS84 geodetic coordinates (latitude, longitude, altitude) for output

## Testing

```bash
cargo test
```

## Performance

Typical processing rate: ~1000 epochs/second with 10 satellites each (single-threaded)

## License

MIT
