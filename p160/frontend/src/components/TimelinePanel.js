import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
  Divider,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import EventIcon from '@mui/icons-material/Event';
import api from '../services/api';

function TimelinePanel({ onRefresh }) {
  const [inputText, setInputText] = useState('');
  const [extractedEvents, setExtractedEvents] = useState([]);
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const handleExtractEvents = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    try {
      const result = await api.extractTimeline(inputText);
      setExtractedEvents(result.events || []);
    } catch (err) {
      showError('Failed to extract events from text');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async () => {
    try {
      const result = await api.getTimeline();
      setTimelineEvents(result.events || []);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    }
  };

  useEffect(() => {
    loadTimeline();
  }, [onRefresh]);

  const getImportanceColor = (importance) => {
    if (importance >= 80) return 'error';
    if (importance >= 60) return 'warning';
    if (importance >= 40) return 'primary';
    return 'default';
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>
        <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Event Timeline
      </Typography>

      <TextField
        fullWidth
        multiline
        rows={4}
        label="Extract events from text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        sx={{ mb: 2 }}
        placeholder="Paste text containing dates and events... e.g., 'In 2003, Elon Musk founded SpaceX. Tesla was founded in 2003 and released the Model S in 2012.'"
      />

      <Button
        fullWidth
        variant="contained"
        startIcon={<EventIcon />}
        onClick={handleExtractEvents}
        disabled={loading || !inputText.trim()}
        sx={{ mb: 3 }}
      >
        {loading ? <CircularProgress size={20} /> : 'Extract Events'}
      </Button>

      {extractedEvents.length > 0 && (
        <>
          <Typography variant="subtitle1" gutterBottom>
            Extracted Events ({extractedEvents.length})
          </Typography>
          {extractedEvents.map((event, idx) => (
            <Card key={idx} sx={{ mb: 2 }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Typography variant="subtitle1">{event.name}</Typography>
                  <Chip
                    label={event.date}
                    size="small"
                    color="primary"
                    variant="outlined"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {event.description}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {event.involved_entities && event.involved_entities.map((ent, i) => (
                    <Chip key={i} label={ent} size="small" />
                  ))}
                  {event.location && (
                    <Chip label={`📍 ${event.location}`} size="small" color="secondary" />
                  )}
                  <Chip
                    label={`Importance: ${event.importance}%`}
                    size="small"
                    color={getImportanceColor(event.importance)}
                  />
                </Box>
              </CardContent>
            </Card>
          ))}
          <Divider sx={{ my: 3 }} />
        </>
      )}

      <Typography variant="subtitle1" gutterBottom>
        Graph Timeline ({timelineEvents.length})
      </Typography>
      
      {timelineEvents.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No events in the graph yet. Add entities with date properties to see them here.
        </Typography>
      ) : (
        timelineEvents.map((event, idx) => (
          <Box key={idx} sx={{ display: 'flex', mb: 2 }}>
            <Box sx={{ mr: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: getImportanceColor(event.importance) === 'error' ? 'error.main' : 
                           getImportanceColor(event.importance) === 'warning' ? 'warning.main' : 'primary.main',
                }}
              />
              {idx < timelineEvents.length - 1 && (
                <Box sx={{ width: 2, flexGrow: 1, bgcolor: 'divider', my: 0.5 }} />
              )}
            </Box>
            <Card sx={{ flexGrow: 1 }}>
              <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2">{event.name}</Typography>
                  <Chip label={event.date} size="small" variant="outlined" />
                </Box>
                {event.description && (
                  <Typography variant="caption" color="text.secondary">
                    {event.description}
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        ))
      )}
    </Box>
  );
}

export default TimelinePanel;
