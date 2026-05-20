use clap::Parser;
use rinex2nmea::*;
use rinex2nmea::utils::EARTH_RADIUS;
use std::path::PathBuf;
use std::time::Duration;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    obs: PathBuf,

    #[arg(short, long)]
    nav: Option<PathBuf>,

    #[arg(long, value_enum, default_value = "all")]
    constellation: ConstellationArg,

    #[arg(long, default_value = "1000")]
    interval: u64,

    #[arg(long)]
    tcp: Option<String>,

    #[arg(long)]
    udp: Option<String>,

    #[arg(long)]
    log_residuals: Option<PathBuf>,

    #[arg(long, default_value_t = false)]
    verbose: bool,

    #[arg(long, default_value_t = false)]
    print_nmea: bool,

    #[arg(long)]
    start_epoch: Option<usize>,

    #[arg(long)]
    end_epoch: Option<usize>,

    #[arg(long)]
    dgps: Option<PathBuf>,

    #[arg(long)]
    kml: Option<PathBuf>,

    #[arg(long)]
    cache_dir: Option<PathBuf>,

    #[arg(long, default_value_t = false)]
    download_nav: bool,
}

#[derive(clap::ValueEnum, Debug, Clone, Copy)]
enum ConstellationArg {
    Gps,
    Glonass,
    Galileo,
    All,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args = Args::parse();

    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(
        if args.verbose { "debug" } else { "info" },
    )).init();

    log::info!("Parsing RINEX observation file: {:?}", args.obs);
    let obs_file = rinex::RinexParser::parse_observation_file(&args.obs)?;
    log::info!("Loaded {} epochs", obs_file.epochs.len());

    let nav_file = if let Some(nav_path) = args.nav {
        log::info!("Parsing RINEX navigation file: {:?}", nav_path);
        rinex::RinexParser::parse_navigation_file(&nav_path)?
    } else if args.download_nav {
        log::info!("Downloading navigation ephemerides...");
        let downloader = download::EphemerisDownloader::new(args.cache_dir.clone())?;
        let first_time = obs_file.header.first_time.ok_or("No first time in observation file")?;
        downloader.download_rinex_nav(first_time, Constellation::GPS).await?
    } else {
        return Err("Either --nav or --download-nav must be provided".into());
    };
    
    let num_sats: usize = nav_file.ephemerides.values().map(|v| v.len()).sum();
    log::info!("Loaded {} ephemerides for {} satellites", num_sats, nav_file.ephemerides.len());

    let dgps_corrector = if let Some(dgps_path) = args.dgps {
        log::info!("Loading DGPS corrections from: {:?}", dgps_path);
        Some(dgps::DgpsCorrector::from_rtcm_file(dgps_path)?)
    } else {
        None
    };

    let constellations = match args.constellation {
        ConstellationArg::Gps => vec![Constellation::GPS],
        ConstellationArg::Glonass => vec![Constellation::GLONASS],
        ConstellationArg::Galileo => vec![Constellation::Galileo],
        ConstellationArg::All => vec![Constellation::GPS, Constellation::GLONASS, Constellation::Galileo],
    };

    let broadcast_config = if let Some(tcp_addr) = args.tcp {
        let parts: Vec<&str> = tcp_addr.split(':').collect();
        let host = parts[0].to_string();
        let port: u16 = parts.get(1).unwrap_or(&"10110").parse()?;
        Some(BroadcastConfig {
            protocol: BroadcastProtocol::TCP,
            host,
            port,
        })
    } else if let Some(udp_addr) = args.udp {
        let parts: Vec<&str> = udp_addr.split(':').collect();
        let host = parts[0].to_string();
        let port: u16 = parts.get(1).unwrap_or(&"10110").parse()?;
        Some(BroadcastConfig {
            protocol: BroadcastProtocol::UDP,
            host,
            port,
        })
    } else {
        None
    };

    let _nmea_server = if let Some(config) = broadcast_config {
        log::info!("Starting NMEA broadcast server on {:?}", config);
        let server = broadcast::NmeaServer::new(config, args.interval)?;
        Some(server)
    } else {
        None
    };

    let mut residual_logger = logger::ResidualLogger::new(args.log_residuals.as_ref())?;
    let mut kml_writer = args.kml.as_ref().map(|_| kml::KmlWriter::new("GNSS Track"));

    let start_idx = args.start_epoch.unwrap_or(0);
    let end_idx = args.end_epoch.unwrap_or(obs_file.epochs.len());
    let epochs = &obs_file.epochs[start_idx.min(obs_file.epochs.len())..end_idx.min(obs_file.epochs.len())];

    log::info!("Processing {} epochs ({} to {})", epochs.len(), start_idx, end_idx.min(obs_file.epochs.len()));

    let approx_pos = obs_file.header.approx_pos;
    let klobuchar = obs_file.header.klobuchar.clone()
        .or_else(|| nav_file.header.klobuchar.clone())
        .unwrap_or_default();
    log::info!("Using Klobuchar ionospheric model");

    let (mut rx_x, mut rx_y, mut rx_z) = approx_pos.unwrap_or_else(|| {
        (EARTH_RADIUS, 0.0, 0.0)
    });

    for (i, epoch) in epochs.iter().enumerate() {
        log::debug!("Processing epoch {}/{}", i + 1, epochs.len());

        let (week, gps_time) = utils::datetime_to_gps_time(epoch.time);
        let tow = gps_time.rem_euclid(86400.0);
        let (rx_lat, rx_lon, _) = utils::xyz_to_lla(rx_x, rx_y, rx_z);

        let sat_positions = orbit::OrbitCalculator::get_satellite_positions(
            &nav_file,
            gps_time,
            week,
            &constellations,
        );

        let mut observations = Vec::new();
        for sat_pos in &sat_positions {
            if let Some(obs) = epoch.observations.get(&sat_pos.sat_id) {
                let (az, el) = utils::satellite_azimuth_elevation(
                    rx_x, rx_y, rx_z,
                    sat_pos.x, sat_pos.y, sat_pos.z,
                );

                let freq = sat_pos.sat_id.constellation.freq_l1();
                let iono_delay = utils::klobuchar_ionospheric_delay(
                    &klobuchar, rx_lat, rx_lon, az, el, tow, freq,
                );

                let mut corrected_pr = obs.pr - iono_delay;
                
                if let Some(dgps) = &dgps_corrector {
                    corrected_pr = dgps.apply_correction(&sat_pos.sat_id, corrected_pr, gps_time);
                }

                observations.push((sat_pos.sat_id, corrected_pr, sat_pos.clone()));
            }
        }

        if observations.len() < 4 {
            log::warn!("Epoch {}: Only {} satellites, need at least 4", i, observations.len());
            continue;
        }

        match positioning::PositionSolver::solve_leastsquares(&observations, Some((rx_x, rx_y, rx_z))) {
            Ok(pos) => {
                rx_x = pos.x;
                rx_y = pos.y;
                rx_z = pos.z;
                
                logger::print_position_info(&pos);
                
                let _ = residual_logger.log_residuals(&pos);
                let _ = residual_logger.log_summary(&pos);

                if let Some(kml) = &mut kml_writer {
                    kml.add_position(pos.clone());
                }

                let nmea_sentences = nmea::NmeaGenerator::generate_all(&pos);
                
                if args.print_nmea {
                    for sentence in &nmea_sentences {
                        print!("{}", sentence);
                    }
                }

                if let Some(server) = &_nmea_server {
                    let _ = server.send_nmea(&nmea_sentences);
                }
            }
            Err(e) => {
                log::error!("Positioning failed for epoch {}: {}", i, e);
            }
        }

        if i < epochs.len() - 1 {
            std::thread::sleep(Duration::from_millis(args.interval));
        }
    }

    if let (Some(kml), Some(kml_path)) = (kml_writer, args.kml) {
        log::info!("Writing KML to: {:?}", kml_path);
        kml.write_to_file(kml_path)?;
    }

    log::info!("Processing complete");
    Ok(())
}
