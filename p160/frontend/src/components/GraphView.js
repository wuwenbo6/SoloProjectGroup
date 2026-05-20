import React, { useEffect, useRef, useState } from 'react';
import ForceGraph3D from '3d-force-graph';
import * as THREE from 'three';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import ZoomOutMapIcon from '@mui/icons-material/ZoomOutMap';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../services/api';

const COLORS = {
  PERSON: '#4fc3f7',
  GPE: '#81c784',
  ORG: '#ffb74d',
  EVENT: '#ba68c8',
  WORK_OF_ART: '#f06292',
  PRODUCT: '#a1887f',
  WORLD_SETTING: '#e57373',
  UNKNOWN: '#90a4ae',
};

function GraphView({ graphData, onNodeClick, onGraphUpdated }) {
  const containerRef = useRef(null);
  const graphRef = useRef(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const Graph = ForceGraph3D()(containerRef.current)
      .graphData(graphData)
      .nodeColor(node => COLORS[node.group] || COLORS.UNKNOWN)
      .nodeLabel(node => `${node.name} (${node.group})`)
      .nodeVal(node => 8 + (node.group === 'PERSON' ? 2 : 0))
      .linkLabel(link => link.relation)
      .linkWidth(1.5)
      .linkOpacity(0.6)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleSpeed(0.005)
      .onNodeClick(node => {
        onNodeClick && onNodeClick(node);
      })
      .onNodeHover(node => {
        setHoveredNode(node);
      })
      .enableNodeDrag(true)
      .showNavInfo(false);

    Graph.d3Force('charge').strength(-120);
    Graph.d3Force('link').distance(100);

    graphRef.current = Graph;

    const lights = Graph.scene().children.filter(c => c.type === 'AmbientLight' || c.type === 'DirectionalLight');
    lights.forEach(l => l.intensity *= 1.5);

    return () => {
      if (graphRef.current) {
        graphRef.current._destructor();
      }
    };
  }, []);

  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.graphData(graphData);
    }
  }, [graphData]);

  const handleZoomToFit = () => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(1000, 40);
    }
  };

  const handleRefresh = () => {
    onGraphUpdated && onGraphUpdated();
  };

  const handleDeleteNode = async () => {
    if (hoveredNode) {
      try {
        await api.deleteEntity(hoveredNode.id);
        onGraphUpdated && onGraphUpdated();
      } catch (error) {
        console.error('Failed to delete node:', error);
      }
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      
      <Box sx={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 1 }}>
        <Tooltip title="Zoom to Fit">
          <IconButton onClick={handleZoomToFit} color="primary">
            <ZoomOutMapIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Refresh">
          <IconButton onClick={handleRefresh} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
        {hoveredNode && (
          <Tooltip title="Delete Node">
            <IconButton onClick={handleDeleteNode} color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ position: 'absolute', bottom: 16, left: 16, bgcolor: 'rgba(0,0,0,0.7)', p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle2" gutterBottom>Legend</Typography>
        {Object.entries(COLORS).slice(0, 6).map(([type, color]) => (
          <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: color }} />
            <Typography variant="caption">{type}</Typography>
          </Box>
        ))}
      </Box>

      {hoveredNode && (
        <Box sx={{ position: 'absolute', top: 16, left: 16, bgcolor: 'rgba(0,0,0,0.8)', p: 2, borderRadius: 2, maxWidth: 300 }}>
          <Typography variant="h6">{hoveredNode.name}</Typography>
          <Typography variant="body2" color="text.secondary">Type: {hoveredNode.group}</Typography>
          {hoveredNode.properties && Object.keys(hoveredNode.properties).length > 0 && (
            <Box sx={{ mt: 1 }}>
              {Object.entries(hoveredNode.properties).map(([key, value]) => (
                key !== 'name' && (
                  <Typography key={key} variant="caption" display="block">
                    {key}: {String(value)}
                  </Typography>
                )
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}

export default GraphView;
