import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  TextField,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import api from '../services/api';

function ExportPanel({ graphData, worldSettings }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [importData, setImportData] = useState('');

  const showSuccess = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleExportJson = async () => {
    setLoading(true);
    try {
      const result = await api.exportJson();
      const blob = new Blob([result.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-graph.json';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('JSON exported successfully');
    } catch (err) {
      setError('Failed to export JSON');
    } finally {
      setLoading(false);
    }
  };

  const handleExportMarkdown = async () => {
    setLoading(true);
    try {
      const result = await api.exportMarkdown();
      const blob = new Blob([result.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-graph.md';
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Markdown exported successfully');
    } catch (err) {
      setError('Failed to export Markdown');
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async () => {
    if (!importData.trim()) return;
    
    setLoading(true);
    try {
      const data = JSON.parse(importData);
      await api.importJson(data);
      setImportData('');
      showSuccess('Data imported successfully');
      window.location.reload();
    } catch (err) {
      setError('Failed to import: Invalid JSON or server error');
    } finally {
      setLoading(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!window.confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
      return;
    }
    
    setLoading(true);
    try {
      await api.clearDatabase();
      showSuccess('Database cleared successfully');
      window.location.reload();
    } catch (err) {
      setError('Failed to clear database');
    } finally {
      setLoading(false);
    }
  };

  const handleFileImport = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImportData(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Typography variant="h6" gutterBottom>
        Export Data
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {graphData.nodes?.length || 0} entities, {graphData.links?.length || 0} relationships
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <Button
          fullWidth
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExportJson}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Export as JSON'}
        </Button>
        <Button
          fullWidth
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleExportMarkdown}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Export as Markdown'}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom>
        Import Data
      </Typography>

      <Button
        fullWidth
        variant="outlined"
        component="label"
        startIcon={<UploadIcon />}
        sx={{ mb: 2 }}
      >
        Select JSON File
        <input
          type="file"
          accept=".json"
          hidden
          onChange={handleFileImport}
        />
      </Button>

      <TextField
        fullWidth
        multiline
        rows={6}
        label="Or paste JSON here"
        value={importData}
        onChange={(e) => setImportData(e.target.value)}
        sx={{ mb: 2 }}
        placeholder='{"graph": {"nodes": [...], "links": [...]}, ...}'
      />

      <Button
        fullWidth
        variant="contained"
        onClick={handleImportJson}
        disabled={loading || !importData.trim()}
        sx={{ mb: 3 }}
      >
        {loading ? <CircularProgress size={20} /> : 'Import Data'}
      </Button>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" gutterBottom color="error">
        Danger Zone
      </Typography>

      <Button
        fullWidth
        variant="outlined"
        color="error"
        startIcon={<DeleteSweepIcon />}
        onClick={handleClearDatabase}
        disabled={loading}
      >
        Clear All Data
      </Button>
    </Box>
  );
}

export default ExportPanel;
