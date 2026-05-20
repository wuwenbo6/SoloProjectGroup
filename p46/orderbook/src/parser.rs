use super::*;
use csv::Reader;
use std::fs::File;
use std::path::Path;

pub fn parse_level2_csv<P: AsRef<Path>>(path: P, symbol: &str) -> Result<Vec<Level2Tick>, Box<dyn std::error::Error>> {
    let file = File::open(path)?;
    let mut rdr = Reader::from_reader(file);
    let mut ticks = Vec::new();

    for result in rdr.records() {
        let record = result?;
        if record.len() < 4 {
            continue;
        }

        let timestamp: DateTime<Utc> = record[0].parse()?;
        let price: f64 = record[1].parse()?;
        let quantity: f64 = record[2].parse()?;
        let side_str = &record[3];

        let side = match side_str.to_lowercase().as_str() {
            "buy" | "bid" | "b" => Side::Buy,
            "sell" | "ask" | "s" => Side::Sell,
            _ => continue,
        };

        ticks.push(Level2Tick {
            timestamp,
            price,
            quantity,
            side,
            symbol: symbol.to_string(),
        });
    }

    ticks.sort_by_key(|t| t.timestamp);
    Ok(ticks)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_csv() {
    }
}
