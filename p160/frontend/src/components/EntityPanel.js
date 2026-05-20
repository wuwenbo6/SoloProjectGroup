import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import AddIcon from '@mui/icons-material/Add';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import WarningIcon from '@mui/icons-material/Warning';
import api from '../services/api';

const ENTITY_TYPES = ['PERSON', 'GPE', 'ORG', 'EVENT', 'WORK_OF_ART', 'PRODUCT'];

function EntityPanel({ extractedEntities, onEntitiesExtracted, onGraphUpdated, selectedNode }) {
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedRelations, setGeneratedRelations] = useState([]);
  
  const [resolvedEntities, setResolvedEntities] = useState([]);
  const [autoMerge, setAutoMerge] = useState(true);
  
  const [newEntityName, setNewEntityName] = useState('');
  const [newEntityType, setNewEntityType] = useState('PERSON');
  const [similarEntity, setSimilarEntity] = useState(null);
  
  const [relSource, setRelSource] = useState('');
  const [relSourceType, setRelSourceType] = useState('PERSON');
  const [relTarget, setRelTarget] = useState('');
  const [relTargetType, setRelTargetType] = useState('PERSON');
  const [relName, setRelName] = useState('');
  const [relConflict, setRelConflict] = useState(null);

  const showError = (msg) => {
    setError(msg);
    setTimeout(() => setError(null), 5000);
  };

  const handleExtract = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await api.extractEntities(inputText);
      onEntitiesExtracted && onEntitiesExtracted(result.entities, false);
    } catch (err) {
      showError('Failed to extract entities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAndExtract = async () => {
    if (!inputText.trim()) return;
    
    setLoading(true);
    setError(null);
    try {
      const result = await api.resolveEntitiesList(inputText);
      setResolvedEntities(result.resolved_entities || []);
      
      const entities = {};
      result.resolved_entities.forEach(ent => {
        if (!entities[ent.type]) {
          entities[ent.type] = [];
        }
        const displayName = ent.similar_entity 
          ? `${ent.original} → ${ent.similar_entity.name}` 
          : ent.original;
        if (!entities[ent.type].includes(displayName)) {
          entities[ent.type].push(displayName);
        }
      });
      onEntitiesExtracted && onEntitiesExtracted(entities, false);
    } catch (err) {
      showError('Failed to resolve entities');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToGraph = async () => {
    if (resolvedEntities.length === 0 && !extractedEntities) {
      showError('No entities to add');
      return;
    }
    
    setLoading(true);
    try {
      const entitiesToAdd = resolvedEntities.length > 0 
        ? resolvedEntities 
        : Object.entries(extractedEntities || {}).flatMap(([type, names]) =>
            names.map(name => ({ name, type, canonical: name }))
          );
      
      for (const ent of entitiesToAdd) {
        try {
          await api.addEntityWithResolution(
            ent.canonical || ent.name, 
            ent.type, 
            {}, 
            autoMerge
          );
        } catch (e) {
          console.error('Failed to add entity:', ent.name, e);
        }
      }
      
      setResolvedEntities([]);
      onGraphUpdated && onGraphUpdated();
    } catch (err) {
      showError('Failed to add entities');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRelations = async () => {
    if (!extractedEntities) return;
    
    setAiLoading(true);
    setError(null);
    try {
      const result = await api.generateRelationships(extractedEntities, inputText);
      setGeneratedRelations(result.relationships || []);
    } catch (err) {
      showError('Failed to generate relationships');
      console.error(err);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddRelation = async (rel) => {
    try {
      const conflictCheck = await api.checkRelationshipConflict(
        rel.source, rel.source_type,
        rel.relation,
        rel.target, rel.target_type
      );
      
      if (conflictCheck.has_conflict) {
        const proceed = window.confirm(
          `Warning: Conflicts detected!\n${conflictCheck.conflicts.join('\n')}\n\nProceed anyway?`
        );
        if (!proceed) return;
      }
      
      await api.addRelationship(
        rel.source, rel.source_type,
        rel.relation,
        rel.target, rel.target_type
      );
      setGeneratedRelations(prev => prev.filter(r => r !== rel));
      onGraphUpdated && onGraphUpdated();
    } catch (err) {
      showError('Failed to add relationship');
    }
  };

  const handleCheckSimilarEntity = async () => {
    if (!newEntityName.trim()) return;
    
    try {
      const result = await api.findSimilarEntity(newEntityName, newEntityType);
      setSimilarEntity(result.similar);
    } catch (err) {
      showError('Failed to check for duplicates');
    }
  };

  const handleAddEntity = async () => {
    if (!newEntityName.trim()) return;
    
    try {
      const result = await api.addEntityWithResolution(
        newEntityName, newEntityType, {}, autoMerge
      );
      
      if (result.merged) {
        alert(`Entity merged with existing: ${result.similar_entity.name}`);
      }
      
      setNewEntityName('');
      setSimilarEntity(null);
      onGraphUpdated && onGraphUpdated();
    } catch (err) {
      showError('Failed to add entity');
    }
  };

  const handleCheckRelationshipConflict = async () => {
    if (!relSource.trim() || !relTarget.trim() || !relName.trim()) return;
    
    try {
      const result = await api.checkRelationshipConflict(
        relSource, relSourceType,
        relName,
        relTarget, relTargetType
      );
      setRelConflict(result);
    } catch (err) {
      showError('Failed to check for conflicts');
    }
  };

  const handleCreateRelation = async () => {
    if (!relSource.trim() || !relTarget.trim() || !relName.trim()) return;
    
    if (relConflict && relConflict.has_conflict) {
      const proceed = window.confirm(
        `Warning: Conflicts detected!\n${relConflict.conflicts.join('\n')}\n\nProceed anyway?`
      );
      if (!proceed) return;
    }
    
    try {
      await api.addRelationship(
        relSource, relSourceType,
        relName,
        relTarget, relTargetType
      );
      setRelSource('');
      setRelTarget('');
      setRelName('');
      setRelConflict(null);
      onGraphUpdated && onGraphUpdated();
    } catch (err) {
      showError('Failed to create relationship');
    }
  };

  const handleAutoCompleteRelation = async () => {
    if (!relSource.trim() || !relTarget.trim()) return;
    
    try {
      const result = await api.autocompleteRelation(relSource, relTarget, inputText);
      setRelName(result.relation || '');
    } catch (err) {
      showError('Failed to autocomplete relation');
    }
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Text Input & Entity Extraction</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Enter text to extract entities"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="e.g., Elon Musk founded Tesla in Palo Alto. Musk also runs SpaceX."
            sx={{ mb: 2 }}
          />
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              onClick={handleExtract}
              disabled={loading || !inputText.trim()}
              size="small"
            >
              {loading ? <CircularProgress size={20} /> : 'Extract'}
            </Button>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleResolveAndExtract}
              disabled={loading || !inputText.trim()}
              size="small"
              startIcon={<MergeTypeIcon />}
            >
              Extract + Resolve
            </Button>
            {(extractedEntities || resolvedEntities.length > 0) && (
              <Button
                variant="outlined"
                onClick={handleAddToGraph}
                disabled={loading}
                size="small"
              >
                Add to Graph
              </Button>
            )}
          </Box>
          
          <FormControlLabel
            control={
              <Checkbox
                checked={autoMerge}
                onChange={(e) => setAutoMerge(e.target.checked)}
                size="small"
              />
            }
            label="Auto-merge aliases"
          />

          {extractedEntities && (
            <Box>
              {Object.entries(extractedEntities).map(([type, entities]) => (
                entities.length > 0 && (
                  <Box key={type} sx={{ mb: 1 }}>
                    <Typography variant="subtitle2">{type}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {entities.map((entity, idx) => (
                        <Chip key={idx} label={entity} size="small" />
                      ))}
                    </Box>
                  </Box>
                )
              ))}
              
              {resolvedEntities.length > 0 && (
                <Alert severity="info" sx={{ my: 2 }}>
                  <Typography variant="body2">
                    <strong>Resolution Results:</strong>
                  </Typography>
                  {resolvedEntities.map((ent, idx) => (
                    <Typography key={idx} variant="caption" display="block">
                      {ent.original} {ent.similar_entity ? `→ ${ent.similar_entity.name} (duplicate)` : ' (new)'}
                    </Typography>
                  ))}
                </Alert>
              )}
              
              <Button
                variant="outlined"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleGenerateRelations}
                disabled={aiLoading}
                sx={{ mt: 2 }}
              >
                {aiLoading ? <CircularProgress size={20} /> : 'AI Generate Relationships'}
              </Button>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {generatedRelations.length > 0 && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>AI Generated Relationships</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {generatedRelations.map((rel, idx) => (
              <Box key={idx} sx={{ mb: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="body2">
                  {rel.source} → <strong>{rel.relation}</strong> → {rel.target}
                </Typography>
                {rel.description && (
                  <Typography variant="caption" color="text.secondary">
                    {rel.description}
                  </Typography>
                )}
                <Button size="small" onClick={() => handleAddRelation(rel)} sx={{ mt: 1 }}>
                  Add to Graph
                </Button>
              </Box>
            ))}
          </AccordionDetails>
        </Accordion>
      )}

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Add Entity Manually</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TextField
            fullWidth
            label="Entity Name"
            value={newEntityName}
            onChange={(e) => {
              setNewEntityName(e.target.value);
              setSimilarEntity(null);
            }}
            sx={{ mb: 2 }}
          />
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={newEntityType}
              label="Type"
              onChange={(e) => {
                setNewEntityType(e.target.value);
                setSimilarEntity(null);
              }}
            >
              {ENTITY_TYPES.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCheckSimilarEntity}
              disabled={!newEntityName.trim()}
              size="small"
            >
              Check for Duplicates
            </Button>
          </Box>
          
          {similarEntity && (
            <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
              <Typography variant="body2">
                <strong>Possible duplicate found:</strong> {similarEntity.name}
              </Typography>
              <Typography variant="caption">
                Type: {similarEntity.group}, Similarity: {Math.round((similarEntity.similarity || 0) * 100)}%
              </Typography>
            </Alert>
          )}
          
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddEntity}
            disabled={!newEntityName.trim()}
          >
            Add Entity {autoMerge ? '(with auto-merge)' : ''}
          </Button>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Create Relationship</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="Source"
              value={relSource}
              onChange={(e) => {
                setRelSource(e.target.value);
                setRelConflict(null);
              }}
              sx={{ flex: 1 }}
            />
            <FormControl sx={{ minWidth: 100 }}>
              <Select
                value={relSourceType}
                onChange={(e) => setRelSourceType(e.target.value)}
                size="small"
              >
                {ENTITY_TYPES.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center' }}>
            <TextField
              label="Relationship"
              value={relName}
              onChange={(e) => {
                setRelName(e.target.value);
                setRelConflict(null);
              }}
              sx={{ flex: 1 }}
            />
            <Button onClick={handleAutoCompleteRelation} size="small">
              <AutoAwesomeIcon />
            </Button>
            <Button onClick={handleCheckRelationshipConflict} size="small" disabled={!relSource || !relTarget || !relName}>
              <WarningIcon />
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <TextField
              label="Target"
              value={relTarget}
              onChange={(e) => {
                setRelTarget(e.target.value);
                setRelConflict(null);
              }}
              sx={{ flex: 1 }}
            />
            <FormControl sx={{ minWidth: 100 }}>
              <Select
                value={relTargetType}
                onChange={(e) => setRelTargetType(e.target.value)}
                size="small"
              >
                {ENTITY_TYPES.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          
          {relConflict && (
            <Alert severity={relConflict.has_conflict ? "warning" : "success"} sx={{ mb: 2 }}>
              <Typography variant="body2">
                {relConflict.has_conflict ? 'Conflicts detected:' : 'No conflicts detected'}
              </Typography>
              {relConflict.conflicts && relConflict.conflicts.map((c, i) => (
                <Typography key={i} variant="caption" display="block">
                  • {c}
                </Typography>
              ))}
            </Alert>
          )}
          
          <Button
            fullWidth
            variant="contained"
            onClick={handleCreateRelation}
            disabled={!relSource.trim() || !relTarget.trim() || !relName.trim()}
          >
            Create Relationship
          </Button>
        </AccordionDetails>
      </Accordion>

      {selectedNode && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6">Selected Node</Typography>
          <Typography variant="body1"><strong>Name:</strong> {selectedNode.name}</Typography>
          <Typography variant="body2"><strong>Type:</strong> {selectedNode.group}</Typography>
          {selectedNode.properties && selectedNode.properties.aliases && (
            <Typography variant="caption" display="block">
              <strong>Aliases:</strong> {selectedNode.properties.aliases.join(', ')}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}

export default EntityPanel;
