import React, { useState, useEffect, useCallback } from 'react';
import { Box, Drawer, AppBar, Toolbar, Typography, IconButton, Tabs, Tab } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import GraphView from './components/GraphView';
import EntityPanel from './components/EntityPanel';
import WorldSettingPanel from './components/WorldSettingPanel';
import ExportPanel from './components/ExportPanel';
import TimelinePanel from './components/TimelinePanel';
import GeoMapPanel from './components/GeoMapPanel';
import RelationshipAnalyzer from './components/RelationshipAnalyzer';
import api from './services/api';

const drawerWidth = 400;

function App() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [extractedEntities, setExtractedEntities] = useState(null);
  const [worldSettings, setWorldSettings] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);

  const loadGraphData = useCallback(async () => {
    try {
      const data = await api.getGraph();
      setGraphData(data);
    } catch (error) {
      console.error('Failed to load graph:', error);
    }
  }, []);

  const loadWorldSettings = useCallback(async () => {
    try {
      const data = await api.getWorldSettings();
      setWorldSettings(data.settings || []);
    } catch (error) {
      console.error('Failed to load world settings:', error);
    }
  }, []);

  useEffect(() => {
    loadGraphData();
    loadWorldSettings();
  }, [loadGraphData, loadWorldSettings]);

  const handleNodeClick = (node) => {
    setSelectedNode(node);
  };

  const handleEntitiesExtracted = async (entities, addToGraph = false) => {
    setExtractedEntities(entities);
    
    if (addToGraph) {
      for (const [type, names] of Object.entries(entities)) {
        for (const name of names) {
          try {
            await api.addEntity(name, type);
          } catch (e) {
            console.error('Failed to add entity:', e);
          }
        }
      }
      loadGraphData();
    }
  };

  const handleGraphUpdated = () => {
    loadGraphData();
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          transition: (theme) =>
            theme.transitions.create(['margin', 'width'], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          ...(drawerOpen && {
            marginLeft: drawerWidth,
            width: `calc(100% - ${drawerWidth}px)`,
            transition: (theme) =>
              theme.transitions.create(['margin', 'width'], {
                easing: theme.transitions.easing.easeOut,
                duration: theme.transitions.duration.enteringScreen,
              }),
          }),
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            onClick={() => setDrawerOpen(!drawerOpen)}
            edge="start"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Knowledge Graph Studio
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="persistent"
        anchor="left"
        open={drawerOpen}
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant="fullWidth"
          >
            <Tab label="Entities" />
            <Tab label="World" />
            <Tab label="Export" />
          </Tabs>
          
          <Box sx={{ p: 2 }}>
            {activeTab === 0 && (
              <EntityPanel
                extractedEntities={extractedEntities}
                onEntitiesExtracted={handleEntitiesExtracted}
                onGraphUpdated={handleGraphUpdated}
                selectedNode={selectedNode}
              />
            )}
            {activeTab === 1 && (
              <WorldSettingPanel
                settings={worldSettings}
                onSettingsUpdated={loadWorldSettings}
                extractedEntities={extractedEntities}
              />
            )}
            {activeTab === 2 && (
              <ExportPanel graphData={graphData} worldSettings={worldSettings} />
            )}
          </Box>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          transition: (theme) =>
            theme.transitions.create('margin', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
          marginLeft: drawerOpen ? 0 : -drawerWidth,
          height: '100vh',
        }}
      >
        <Toolbar />
        <GraphView 
          graphData={graphData} 
          onNodeClick={handleNodeClick}
          onGraphUpdated={handleGraphUpdated}
        />
      </Box>
    </Box>
  );
}

export default App;
