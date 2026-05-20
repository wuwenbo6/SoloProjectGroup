use crate::types::*;
use crate::rinex::RinexParser;
use chrono::{DateTime, Datelike, Utc, Timelike};
use std::fs::{self, File};
use std::io::{Cursor, Write};
use std::path::PathBuf;
use flate2::read::GzDecoder;
use log::{info, warn, error};

pub struct EphemerisDownloader {
    cache_dir: PathBuf,
}

impl EphemerisDownloader {
    pub fn new(cache_dir: Option<PathBuf>) -> Result<Self, Box<dyn std::error::Error>> {
        let cache_dir = cache_dir.unwrap_or_else(|| {
            std::env::temp_dir().join("rinex2nmea_cache")
        });
        
        fs::create_dir_all(&cache_dir)?;
        
        Ok(EphemerisDownloader { cache_dir })
    }

    pub async fn download_ultra_rapid(
        &self,
        time: DateTime<Utc>,
    ) -> Result<NavigationFile, Box<dyn std::error::Error>> {
        let gps_week = ((time - Utc::with_ymd_and_hms(&Utc, 1980, 1, 6, 0, 0, 0).unwrap())
            .num_seconds() / 604800) as i32;
        let day_of_week = time.weekday().num_days_from_sunday();
        let hour = time.hour();
        let gps_hour = (hour / 6) * 6;

        let filename = format!("IGU{gps_week:04}{day_of_week}{gps_hour:02}.SP3");
        let local_path = self.cache_dir.join(&filename);

        if local_path.exists() {
            info!("Using cached ephemeris: {}", filename);
            return RinexParser::parse_navigation_file(&local_path);
        }

        let urls = self.get_download_urls(gps_week, day_of_week, gps_hour, &filename);
        
        for url in &urls {
            match self.download_and_save(url, &local_path).await {
                Ok(_) => {
                    info!("Downloaded ephemeris: {}", url);
                    return RinexParser::parse_navigation_file(&local_path);
                }
                Err(e) => {
                    warn!("Failed to download from {}: {}", url, e);
                }
            }
        }

        Err("Failed to download ephemeris from all sources".into())
    }

    pub async fn download_rinex_nav(
        &self,
        time: DateTime<Utc>,
        constellation: Constellation,
    ) -> Result<NavigationFile, Box<dyn std::error::Error>> {
        let year = time.year();
        let doy = time.ordinal();
        let hour = time.hour();
        let session = match hour / 6 {
            0 => 'a',
            1 => 'b',
            2 => 'c',
            3 => 'd',
            _ => 'a',
        };

        let const_id = match constellation {
            Constellation::GPS => "G",
            Constellation::GLONASS => "R",
            Constellation::Galileo => "E",
        };

        let filename = format!("{}{:03}{}{}.{}n", const_id, doy, session, year % 100);
        let local_path = self.cache_dir.join(&filename);

        if local_path.exists() {
            info!("Using cached RINEX nav: {}", filename);
            return RinexParser::parse_navigation_file(&local_path);
        }

        let cddis_url = format!(
            "https://cddis.nasa.gov/archive/gps/data/{}/{:03}/{}n/{}{:03}{}.{}n.Z",
            year, doy, const_id.to_lowercase(), const_id, doy, session, year % 100
        );

        match self.download_compressed(&cddis_url, &local_path).await {
            Ok(_) => {
                info!("Downloaded RINEX nav: {}", cddis_url);
                RinexParser::parse_navigation_file(&local_path)
            }
            Err(e) => {
                error!("CDDIS download failed: {}", e);
                Err(e)
            }
        }
    }

    fn get_download_urls(&self, week: i32, dow: u32, hour: u32, filename: &str) -> Vec<String> {
        let mut urls = Vec::new();
        
        urls.push(format!(
            "https://cddis.nasa.gov/archive/gps/products/mgex/{}/{}.sp3.Z",
            week, filename
        ));
        urls.push(format!(
            "https://ftp.igs.org/pub/product/mgex/{}/{}.sp3.Z",
            week, filename
        ));
        urls.push(format!(
            "http://navigation-office.esa.int/products/gnss-products/{}/{}.sp3.Z",
            week, filename
        ));
        
        urls
    }

    async fn download_and_save(
        &self,
        url: &str,
        local_path: &PathBuf,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let response = client.get(url).send().await?;
        
        if !response.status().is_success() {
            return Err(format!("HTTP error: {}", response.status()).into());
        }

        let bytes = response.bytes().await?;
        
        if url.ends_with(".Z") || url.ends_with(".gz") {
            let decoder = GzDecoder::new(Cursor::new(bytes));
            let mut reader = std::io::BufReader::new(decoder);
            let mut file = File::create(local_path)?;
            std::io::copy(&mut reader, &mut file)?;
        } else {
            let mut file = File::create(local_path)?;
            file.write_all(&bytes)?;
        }

        Ok(())
    }

    async fn download_compressed(
        &self,
        url: &str,
        local_path: &PathBuf,
    ) -> Result<(), Box<dyn std::error::Error>> {
        self.download_and_save(url, local_path).await
    }

    pub fn get_cache_dir(&self) -> &PathBuf {
        &self.cache_dir
    }

    pub fn clear_cache(&self) -> Result<(), Box<dyn std::error::Error>> {
        fs::remove_dir_all(&self.cache_dir)?;
        fs::create_dir_all(&self.cache_dir)?;
        Ok(())
    }
}

pub fn get_brdc_url(time: DateTime<Utc>) -> String {
    let year = time.year();
    let doy = time.ordinal();
    format!(
        "https://cddis.nasa.gov/archive/gps/data/daily/{}/{:03}/brdc/brdc{:03}0.{}.gz",
        year, doy, doy, year % 100
    )
}
