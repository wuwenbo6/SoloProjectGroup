const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/map/:mapId/json', (req, res) => {
  const { mapId } = req.params;
  
  db.get('SELECT * FROM maps WHERE id = ?', [mapId], (err, map) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!map) {
      return res.status(404).json({ error: '地图不存在' });
    }
    
    db.all('SELECT * FROM control_points WHERE map_id = ?', [mapId], (err, controlPoints) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      db.all('SELECT * FROM layers WHERE map_id = ? ORDER BY sort_order ASC', [mapId], (err, layers) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        db.all(
          `SELECT a.*, 
                  json_group_array(json_object(
                    'id', nr.id,
                    'ancientName', nr.ancient_name,
                    'modernName', nr.modern_name,
                    'relationType', nr.relation_type,
                    'confidence', nr.confidence,
                    'source', nr.source,
                    'notes', nr.notes
                  )) as name_relations
           FROM annotations a
           LEFT JOIN name_relations nr ON a.id = nr.annotation_id
           WHERE a.map_id = ? AND a.is_deleted = 0
           GROUP BY a.id`,
          [mapId],
          (err, annotations) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            const result = {
              map: {
                id: map.id,
                name: map.name,
                filename: map.filename,
                width: map.width,
                height: map.height,
                upload_date: map.upload_date
              },
              controlPoints: controlPoints,
              layers: layers,
              annotations: annotations.map(a => ({
                ...a,
                geometry: JSON.parse(a.geometry),
                style: a.style ? JSON.parse(a.style) : null,
                name_relations: JSON.parse(a.name_relations).filter(nr => nr.id !== null)
              })),
              exportDate: new Date().toISOString(),
              version: '1.0'
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${map.name.replace(/[^a-z0-9]/gi, '_')}.json"`);
            res.json(result);
          }
        );
      });
    });
  });
});

router.get('/map/:mapId/geojson', (req, res) => {
  const { mapId } = req.params;
  
  db.get('SELECT * FROM maps WHERE id = ?', [mapId], (err, map) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!map) {
      return res.status(404).json({ error: '地图不存在' });
    }
    
    db.all(
      `SELECT a.*, 
              json_group_array(json_object(
                'id', nr.id,
                'ancientName', nr.ancient_name,
                'modernName', nr.modern_name
              )) as name_relations
       FROM annotations a
       LEFT JOIN name_relations nr ON a.id = nr.annotation_id
       WHERE a.map_id = ? AND a.is_deleted = 0
       GROUP BY a.id`,
      [mapId],
      (err, annotations) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        const features = annotations.map(a => {
          const geometry = JSON.parse(a.geometry);
          let geoJsonGeometry;
          
          if (a.type === 'place') {
            geoJsonGeometry = {
              type: 'Point',
              coordinates: [geometry.x, geometry.y]
            };
          } else if (a.type === 'water' && geometry.points && geometry.points.length > 1) {
            geoJsonGeometry = {
              type: 'LineString',
              coordinates: geometry.points.map(p => [p.x, p.y])
            };
          } else {
            geoJsonGeometry = { type: 'GeometryCollection', geometries: [] };
          }
          
          const nameRelations = JSON.parse(a.name_relations).filter(nr => nr.id !== null);
          
          return {
            type: 'Feature',
            id: a.id,
            geometry: geoJsonGeometry,
            properties: {
              name: a.name,
              modernName: a.modern_name,
              description: a.description,
              type: a.type,
              layerId: a.layer_id,
              version: a.version,
              createdBy: a.created_by,
              createdAt: a.created_at,
              nameRelations: nameRelations
            }
          };
        });
        
        const result = {
          type: 'FeatureCollection',
          name: map.name,
          mapId: map.id,
          crs: {
            type: 'name',
            properties: {
              name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
            }
          },
          features: features
        };
        
        res.setHeader('Content-Type', 'application/geo+json');
        res.setHeader('Content-Disposition', `attachment; filename="${map.name.replace(/[^a-z0-9]/gi, '_')}.geojson"`);
        res.json(result);
      }
    );
  });
});

router.get('/map/:mapId/kml', (req, res) => {
  const { mapId } = req.params;
  
  db.get('SELECT * FROM maps WHERE id = ?', [mapId], (err, map) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!map) {
      return res.status(404).json({ error: '地图不存在' });
    }
    
    db.all(
      `SELECT a.*, 
              json_group_array(json_object(
                'ancientName', nr.ancient_name,
                'modernName', nr.modern_name
              )) as name_relations
       FROM annotations a
       LEFT JOIN name_relations nr ON a.id = nr.annotation_id
       WHERE a.map_id = ? AND a.is_deleted = 0
       GROUP BY a.id`,
      [mapId],
      (err, annotations) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        let placemarks = '';
        
        annotations.forEach(a => {
          const geometry = JSON.parse(a.geometry);
          const nameRelations = JSON.parse(a.name_relations).filter(nr => nr.ancientName !== null);
          
          let description = '';
          if (a.description) {
            description += `<p>${a.description}</p>`;
          }
          if (a.modern_name) {
            description += `<p>现代地名: ${a.modern_name}</p>`;
          }
          if (nameRelations.length > 0) {
            description += `<p>古今对照:</p><ul>`;
            nameRelations.forEach(nr => {
              description += `<li>${nr.ancientName} → ${nr.modernName || '未知'}</li>`;
            });
            description += `</ul>`;
          }
          
          if (a.type === 'place') {
            placemarks += `
      <Placemark>
        <name>${a.name || '未命名'}</name>
        <description><![CDATA[${description}]]></description>
        <Point>
          <coordinates>${geometry.x},${geometry.y},0</coordinates>
        </Point>
      </Placemark>`;
          } else if (a.type === 'water' && geometry.points && geometry.points.length > 1) {
            const coords = geometry.points.map(p => `${p.x},${p.y},0`).join(' ');
            placemarks += `
      <Placemark>
        <name>${a.name || '未命名水系'}</name>
        <description><![CDATA[${description}]]></description>
        <LineString>
          <coordinates>${coords}</coordinates>
        </LineString>
      </Placemark>`;
          }
        });
        
        const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${map.name}</name>
    <description>古地图标注导出 - ${new Date().toLocaleDateString()}</description>
    ${placemarks}
  </Document>
</kml>`;
        
        res.setHeader('Content-Type', 'application/vnd.google-earth.kml+xml');
        res.setHeader('Content-Disposition', `attachment; filename="${map.name.replace(/[^a-z0-9]/gi, '_')}.kml"`);
        res.send(kml);
      }
    );
  });
});

module.exports = router;
