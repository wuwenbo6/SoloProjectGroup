use crate::types::*;
use crate::utils::normalize_angle_deg;
use chrono::{DateTime, Utc};
use std::fs::File;
use std::io::Write;
use std::path::Path;

pub struct KmlWriter {
    positions: Vec<ReceiverPosition>,
    name: String,
}

impl KmlWriter {
    pub fn new(name: &str) -> Self {
        KmlWriter {
            positions: Vec::new(),
            name: name.to_string(),
        }
    }

    pub fn add_position(&mut self, pos: ReceiverPosition) {
        self.positions.push(pos);
    }

    pub fn write_to_file<P: AsRef<Path>>(&self, path: P) -> Result<(), Box<dyn std::error::Error>> {
        let mut file = File::create(path)?;
        self.write_header(&mut file)?;
        self.write_placemarks(&mut file)?;
        self.write_track(&mut file)?;
        self.write_footer(&mut file)?;
        Ok(())
    }

    fn write_header<W: Write>(&self, writer: &mut W) -> Result<(), Box<dyn std::error::Error>> {
        writeln!(writer, "<?xml version=\"1.0\" encoding=\"UTF-8\"?>")?;
        writeln!(writer, "<kml xmlns=\"http://www.opengis.net/kml/2.2\">")?;
        writeln!(writer, "  <Document>")?;
        writeln!(writer, "    <name>{}</name>", self.name)?;
        writeln!(writer, "    <description>GNSS Track from rinex2nmea</description>")?;
        
        writeln!(writer, "    <Style id=\"trackStyle\">")?;
        writeln!(writer, "      <LineStyle>")?;
        writeln!(writer, "        <color>ff0000ff</color>")?;
        writeln!(writer, "        <width>4</width>")?;
        writeln!(writer, "      </LineStyle>")?;
        writeln!(writer, "    </Style>")?;
        
        writeln!(writer, "    <Style id=\"pointStyle\">")?;
        writeln!(writer, "      <IconStyle>")?;
        writeln!(writer, "        <color>ff00ff00</color>")?;
        writeln!(writer, "        <scale>0.5</scale>")?;
        writeln!(writer, "        <Icon>")?;
        writeln!(writer, "          <href>http://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href>")?;
        writeln!(writer, "        </Icon>")?;
        writeln!(writer, "      </IconStyle>")?;
        writeln!(writer, "    </Style>")?;

        Ok(())
    }

    fn write_placemarks<W: Write>(&self, writer: &mut W) -> Result<(), Box<dyn std::error::Error>> {
        for (i, pos) in self.positions.iter().enumerate() {
            writeln!(writer, "    <Placemark>")?;
            writeln!(writer, "      <name>Point {}</name>", i + 1)?;
            writeln!(writer, "      <styleUrl>#pointStyle</styleUrl>")?;
            writeln!(writer, "      <description>")?;
            writeln!(writer, "        <![CDATA[")?;
            writeln!(writer, "          <b>Time:</b> {}<br/>", pos.time)?;
            writeln!(writer, "          <b>Latitude:</b> {:.8}°<br/>", pos.lat)?;
            writeln!(writer, "          <b>Longitude:</b> {:.8}°<br/>", pos.lon)?;
            writeln!(writer, "          <b>Altitude:</b> {:.2} m<br/>", pos.alt)?;
            writeln!(writer, "          <b>Satellites:</b> {}<br/>", pos.num_satellites)?;
            writeln!(writer, "          <b>HDOP:</b> {:.2}<br/>", pos.hdop)?;
            writeln!(writer, "          <b>VDOP:</b> {:.2}<br/>", pos.vdop)?;
            writeln!(writer, "          <b>Clock Bias:</b> {:.3} ns<br/>", pos.clock_bias * 1e9)?;
            writeln!(writer, "        ]]>")?;
            writeln!(writer, "      </description>")?;
            writeln!(writer, "      <Point>")?;
            writeln!(writer, "        <coordinates>{:.8},{:.8},{:.2}</coordinates>", 
                     normalize_angle_deg(pos.lon), pos.lat, pos.alt)?;
            writeln!(writer, "      </Point>")?;
            writeln!(writer, "    </Placemark>")?;
        }
        Ok(())
    }

    fn write_track<W: Write>(&self, writer: &mut W) -> Result<(), Box<dyn std::error::Error>> {
        if self.positions.len() < 2 {
            return Ok(());
        }

        writeln!(writer, "    <Placemark>")?;
        writeln!(writer, "      <name>Track</name>")?;
        writeln!(writer, "      <styleUrl>#trackStyle</styleUrl>")?;
        writeln!(writer, "      <LineString>")?;
        writeln!(writer, "        <extrude>0</extrude>")?;
        writeln!(writer, "        <tessellate>1</tessellate>")?;
        writeln!(writer, "        <altitudeMode>absolute</altitudeMode>")?;
        writeln!(writer, "        <coordinates>")?;

        for pos in &self.positions {
            writeln!(writer, "          {:.8},{:.8},{:.2}", 
                     normalize_angle_deg(pos.lon), pos.lat, pos.alt)?;
        }

        writeln!(writer, "        </coordinates>")?;
        writeln!(writer, "      </LineString>")?;
        writeln!(writer, "    </Placemark>")?;

        Ok(())
    }

    fn write_footer<W: Write>(&self, writer: &mut W) -> Result<(), Box<dyn std::error::Error>> {
        writeln!(writer, "  </Document>")?;
        writeln!(writer, "</kml>")?;
        Ok(())
    }

    pub fn positions(&self) -> &[ReceiverPosition] {
        &self.positions
    }
}

pub fn write_simple_track<P: AsRef<Path>>(
    path: P,
    positions: &[ReceiverPosition],
    name: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    let mut writer = KmlWriter::new(name);
    for pos in positions {
        writer.add_position(pos.clone());
    }
    writer.write_to_file(path)
}
