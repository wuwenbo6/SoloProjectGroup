import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../services/api';

function WorldSettingPanel({ settings, onSettingsUpdated, extractedEntities }) {
  const [newSettingName, setNewSettingName] = useState('');
  const [newSettingDesc, setNewSettingDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedEvents, setGeneratedEvents] = useState([]);
  const [focusArea, setFocusArea] = useState('');
  const [conflictCheck, setConflictCheck] = useState(null);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const handleCheckConflicts = async () => {
    if (!newSettingDesc.trim()) return;
    
    try {
      const result = await api.checkWorldSettingConflict(newSettingDesc);
      setConflictCheck(result);
    } catch (err) {
      showError('Failed to check for conflicts');
    }
  };

  const handleAddSetting = async () => {
    if (!newSettingName.trim() || !newSettingDesc.trim()) return;
    
    if (conflictCheck && conflictCheck.has_conflict) {
      const proceed = window.confirm(
        `Warning: Conflicts detected!\n${conflictCheck.conflicts.join('\n')}\n\nProceed anyway?`
      );
      if (!proceed) return;
    }
    
    setLoading(true);
    try {
      await api.addWorldSetting(newSettingName, newSettingDesc);
      setNewSettingName('');
      setNewSettingDesc('');
      setConflictCheck(null);
      onSettingsUpdated && onSettingsUpdated();
    } catch (err) {
      showError('Failed to add world setting');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandSetting = async () => {
    if (!newSettingDesc.trim()) return;
    
    setAiLoading(true);
    try {
      const result = await api.expandWorldSetting(newSettingDesc, focusArea);
      setNewSettingDesc(result.expanded_setting || newSettingDesc);
      setConflictCheck(null);
    } catch (err) {
      showError('Failed to expand world setting');
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateEvents = async () => {
    const allEntities = extractedEntities || {};
    const hasEntities = Object.values(allEntities).some(arr => arr && arr.length > 0);
    
    if (!hasEntities && settings.length === 0) {
      showError('Please extract entities or add world settings first');
      return;
    }

    const worldContext = settings.map(s => s.name + ': ' + s.description).join('\n');
    
    setAiLoading(true);
    try {
      const result = await api.generateEvents(allEntities, worldContext, 3);
      setGeneratedEvents(result.events || []);
    } catch (err) {
      showError('Failed to generate events');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>
        World Building
      </Typography>

      <TextField
        fullWidth
        label="Setting Name"
        value={newSettingName}
        onChange={(e) => setNewSettingName(e.target.value)}
        sx={{ mb: 2 }}
        placeholder="e.g., Kingdom of Eldoria"
      />
      
      <TextField
        fullWidth
        multiline
        rows={4}
        label="Description"
        value={newSettingDesc}
        onChange={(e) => {
          setNewSettingDesc(e.target.value);
          setConflictCheck(null);
        }}
        sx={{ mb: 2 }}
        placeholder="Describe your world setting..."
      />
      
      <TextField
        fullWidth
        label="Focus Area (for AI expansion)"
        value={focusArea}
        onChange={(e) => setFocusArea(e.target.value)}
        sx={{ mb: 2 }}
        placeholder="e.g., political structure, magic system, history"
      />

      <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          onClick={handleCheckConflicts}
          disabled={!newSettingDesc.trim()}
          size="small"
          startIcon={<WarningIcon />}
        >
          Check Conflicts
        </Button>
        <Button
          variant="outlined"
          startIcon={<AutoAwesomeIcon />}
          onClick={handleExpandSetting}
          disabled={aiLoading || !newSettingDesc.trim()}
          size="small"
        >
          {aiLoading ? <CircularProgress size={20} /> : 'AI Expand'}
        </Button>
      </Box>

      {conflictCheck && (
        <Alert 
          severity={conflictCheck.has_conflict ? "warning" : "success"} 
          sx={{ mb: 2 }}
        >
          <Typography variant="body2">
            {conflictCheck.has_conflict 
              ? `Potential conflicts (${conflictCheck.severity} severity):` 
              : 'No conflicts detected'}
          </Typography>
          {conflictCheck.conflicts && conflictCheck.conflicts.map((c, i) => (
            <Typography key={i} variant="caption" display="block">
              • {c}
            </Typography>
          ))}
          <Typography variant="caption" display="block" sx={{ mt: 1 }}>
            {conflictCheck.suggestion}
          </Typography>
        </Alert>
      )}

      <Button
        fullWidth
        variant="contained"
        startIcon={<AddIcon />}
        onClick={handleAddSetting}
        disabled={loading || !newSettingName.trim() || !newSettingDesc.trim()}
        sx={{ mb: 3 }}
      >
        {loading ? <CircularProgress size={20} /> : 'Add Setting'}
      </Button>

      <Divider sx={{ my: 2 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle1">Saved Settings</Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AutoAwesomeIcon />}
          onClick={handleGenerateEvents}
          disabled={aiLoading}
        >
          Generate Events
        </Button>
      </Box>

      {settings.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No world settings saved yet.
        </Typography>
      ) : (
        settings.map((setting) => (
          <Card key={setting.id} sx={{ mb: 2 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Typography variant="subtitle1">{setting.name}</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {setting.description}
              </Typography>
            </CardContent>
          </Card>
        ))
      )}

      {generatedEvents.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle1" gutterBottom>AI Generated Events</Typography>
          {generatedEvents.map((event, idx) => (
            <Card key={idx} sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2">{event.name}</Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {event.description}
                </Typography>
                {event.entities_involved && (
                  <Typography variant="caption" display="block">
                    <strong>Involved:</strong> {event.entities_involved.join(', ')}
                  </Typography>
                )}
                {event.impact && (
                  <Typography variant="caption" display="block">
                    <strong>Impact:</strong> {event.impact}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </Box>
  );
}

export default WorldSettingPanel;
