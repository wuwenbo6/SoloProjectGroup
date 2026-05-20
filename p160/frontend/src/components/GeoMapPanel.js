import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
import BusinessIcon from '@mui/icons-material/Business';
import api from '../services/api';

function GeoMapPanel({ onRefresh }) {
  const [mapData, setMapData] = useState({ locations: [], center: { lat: 0, lng: 0 } });
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [showFullMap, setShowFullMap] = useState(false);

  const loadMapData = async () => {
    setLoading(true);
    try {
      const result = await api.getGeoMap();
      setMapData(result || { locations: [], center: { lat: 0, lng: 0 } });
    } catch (err) {
      console.error('Failed to load map data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapData();
  }, [onRefresh]);

  const getEntityIcon = (type) => {
    switch (type) {
      case 'PERSON':
        return <PersonIcon fontSize="small" />;
      case 'ORG':
        return <BusinessIcon fontSize="small" />;
      default:
        return <LocationOnIcon fontSize="small" />;
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <MapIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Geographic Map
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Locations ({mapData.locations.length})
          </Typography>

          {mapData.locations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No geographic locations found in the graph. Add GPE (place) entities to see them here.
            </Typography>
          ) : (
            <>
              {mapData.locations.map((loc, idx) => (
                <Card
                  key={idx}
                  sx={{
                    mb: 2,
                    cursor: 'pointer',
                    border: selectedLocation === idx ? '2px solid primary.main' : 'none'
                  }}
                  onClick={() => setSelectedLocation(selectedLocation === idx ? null : idx)}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <LocationOnIcon color="error" sx={{ mr: 1 }} />
                        <Typography variant="subtitle1">{loc.name}</Typography>
                      </Box>
                      <Chip
                        label={loc.country}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Lat: {loc.lat.toFixed(4)}, Lng: {loc.lng.toFixed(4)}
                    </Typography>

                    {selectedLocation === idx && loc.related_entities && loc.related_entities.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" gutterBottom>
                          Related Entities ({loc.related_entities.length})
                        </Typography>
                        <List dense disablePadding>
                          {loc.related_entities.map((rel, i) => (
                            <ListItem key={i} disablePadding sx={{ py: 0.5 }}>
                              <ListItemIcon sx={{ minWidth: 30 }}>
                                {getEntityIcon(rel.entity.type)}
                              </ListItemIcon>
                              <ListItemText
                                primary={
                                  <span>
                                    <strong>{rel.entity.name}</strong>
                                    {' '}
                                    <Chip
                                      label={rel.relation}
                                      size="small"
                                      variant="outlined"
                                      sx={{ ml: 1 }}
                                    />
                                  </span>
                                }
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}

              <Divider sx={{ my: 2 }} />
              <Card variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Note:</strong> Install <code>leaflet</code> and <code>react-leaflet</code> packages to enable interactive map view.
                  Run: <code>npm install leaflet react-leaflet</code>
                </Typography>
              </Card>
            </>
          )}
        </>
      )}
    </Box>
  );
}

export default GeoMapPanel;
