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
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  LinearProgress,
  Grid,
} from '@mui/material';
import PeopleIcon from '@mui/icons-material/People';
import FavoriteIcon from '@mui/icons-material/Favorite';
import api from '../services/api';

function RelationshipAnalyzer({ graphData, onRefresh }) {
  const [closenessData, setClosenessData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPerson1, setSelectedPerson1] = useState('');
  const [selectedPerson2, setSelectedPerson2] = useState('');
  const [pairAnalysis, setPairAnalysis] = useState(null);
  const [pairLoading, setPairLoading] = useState(false);

  const personNodes = (graphData?.nodes || []).filter(node => node.group === 'PERSON');

  const loadAllCloseness = async () => {
    setLoading(true);
    try {
      const result = await api.getAllCloseness();
      setClosenessData(result);
    } catch (err) {
      console.error('Failed to load closeness data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllCloseness();
  }, [onRefresh]);

  const handleAnalyzePair = async () => {
    if (!selectedPerson1 || !selectedPerson2) return;
    
    setPairLoading(true);
    try {
      const result = await api.calculateCloseness(selectedPerson1, selectedPerson2);
      setPairAnalysis(result);
    } catch (err) {
      console.error('Failed to analyze pair:', err);
    } finally {
      setPairLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPerson1 && selectedPerson2) {
      handleAnalyzePair();
    }
  }, [selectedPerson1, selectedPerson2]);

  const getClosenessColor = (score) => {
    if (score >= 0.8) return 'error';
    if (score >= 0.6) return 'warning';
    if (score >= 0.4) return 'primary';
    if (score >= 0.2) return 'info';
    return 'default';
  };

  const getClosenessBgColor = (score) => {
    if (score >= 0.8) return '#ef4444';
    if (score >= 0.6) return '#f59e0b';
    if (score >= 0.4) return '#3b82f6';
    if (score >= 0.2) return '#06b6d4';
    return '#9ca3af';
  };

  const getNodeName = (id) => {
    const node = (graphData?.nodes || []).find(n => n.id === id);
    return node?.name || id;
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        <PeopleIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
        Relationship Analyzer
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>
            Analyze Pair Relationship
          </Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Person 1</InputLabel>
                <Select
                  value={selectedPerson1}
                  label="Person 1"
                  onChange={(e) => setSelectedPerson1(e.target.value)}
                >
                  {personNodes.map((node) => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={2} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FavoriteIcon color="error" />
            </Grid>
            <Grid item xs={5}>
              <FormControl fullWidth size="small">
                <InputLabel>Person 2</InputLabel>
                <Select
                  value={selectedPerson2}
                  label="Person 2"
                  onChange={(e) => setSelectedPerson2(e.target.value)}
                >
                  {personNodes.filter(n => n.id !== selectedPerson1).map((node) => (
                    <MenuItem key={node.id} value={node.id}>
                      {node.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {pairLoading && <CircularProgress size={20} sx={{ display: 'block', mx: 'auto' }} />}

          {pairAnalysis && !pairLoading && (
            <Box>
              <Box sx={{ mb: 2, textAlign: 'center' }}>
                <Typography variant="h4" gutterBottom>
                  {Math.round(pairAnalysis.closeness_score * 100)}%
                </Typography>
                <Chip
                  label={pairAnalysis.closeness_level}
                  color={getClosenessColor(pairAnalysis.closeness_score)}
                />
              </Box>

              <Typography variant="subtitle2" gutterBottom>Score Breakdown:</Typography>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption">
                  Direct Score: {(pairAnalysis.breakdown.direct_score * 100).toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={pairAnalysis.breakdown.direct_score * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption">
                  Indirect Score: {(pairAnalysis.breakdown.indirect_score * 100).toFixed(0)}%
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={pairAnalysis.breakdown.indirect_score * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
              <Box sx={{ mb: 1 }}>
                <Typography variant="caption">
                  Shared Connections Bonus: {pairAnalysis.shared_connections_count}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(pairAnalysis.shared_connections_count * 20, 100)}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {pairAnalysis.direct_relation && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Direct Relationship:</Typography>
                  <Chip
                    label={`${pairAnalysis.source_name} → ${pairAnalysis.direct_relation.relation} → ${pairAnalysis.target_name}`}
                    color="primary"
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />
                </Box>
              )}

              {pairAnalysis.indirect_paths && pairAnalysis.indirect_paths.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">
                    Indirect Paths ({pairAnalysis.indirect_paths.length}):
                  </Typography>
                  {pairAnalysis.indirect_paths.slice(0, 3).map((path, idx) => (
                    <Box key={idx} sx={{ mt: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Typography variant="caption">
                        Path {idx + 1} ({path.length} steps):
                      </Typography>
                      <Typography variant="body2">
                        {path.map((step, i) => (
                          <span key={i}>
                            {i === 0 ? getNodeName(step.source) : ''}
                            {' → '}
                            <Chip label={step.relation} size="small" sx={{ mx: 0.5 }} />
                            {' → '}
                            {getNodeName(step.target)}
                          </span>
                        ))}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      <Typography variant="subtitle1" gutterBottom>
        All Relationship Scores
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : closenessData?.relationships?.length > 0 ? (
        <>
          {closenessData.summary && (
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Very Close: ${closenessData.summary.very_close}`} color="error" size="small" />
              <Chip label={`Close: ${closenessData.summary.close}`} color="warning" size="small" />
              <Chip label={`Moderate: ${closenessData.summary.moderate}`} color="primary" size="small" />
              <Chip label={`Distant: ${closenessData.summary.distant}`} color="info" size="small" />
            </Box>
          )}

          <List dense>
            {closenessData.relationships.slice(0, 20).map((rel, idx) => (
              <ListItem
                key={idx}
                sx={{
                  mb: 1,
                  bgcolor: 'background.paper',
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
                secondaryAction={
                  <Chip
                    label={`${Math.round(rel.closeness_score * 100)}%`}
                    size="small"
                    sx={{
                      bgcolor: getClosenessBgColor(rel.closeness_score),
                      color: 'white',
                    }}
                  />
                }
              >
                <ListItemText
                  primary={
                    <span>
                      <strong>{rel.source_name}</strong>
                      {' ↔ '}
                      <strong>{rel.target_name}</strong>
                    </span>
                  }
                  secondary={rel.closeness_level}
                />
              </ListItem>
            ))}
          </List>

          {closenessData.relationships.length > 20 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              ... and {closenessData.relationships.length - 20} more relationships
            </Typography>
          )}
        </>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Not enough person entities to analyze relationships. Add at least 2 PERSON entities.
        </Typography>
      )}
    </Box>
  );
}

export default RelationshipAnalyzer;
