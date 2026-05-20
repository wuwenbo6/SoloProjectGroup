import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { CollabClient } from './services/collabClient.js';
import { 
  renderContentWithLatex, 
  debouncedRender, 
  cancelDebouncedRender,
  clearRenderCache,
  downloadSvg,
  downloadPng,
  extractLatexBlocks,
  validateLatexBlocks
} from './services/latexRenderer.js';
import { createDocument, getSnapshots, revertToSnapshot } from './services/api.js';

const DEFAULT_DOCUMENT = '550e8400-e29b-41d4-a716-446655440000';
const INITIAL_CONTENT = `% Welcome to LaTeX Collaborative Editor!

\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}

\\title{My LaTeX Document}
\\maketitle

\\section{Introduction}

This is a collaborative LaTeX editor with real-time preview.

\\section{Mathematics}

Here's a quadratic formula:

\\[
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
\\]

And an inline equation: \<inline_LaTeX_Formula>E = mc^2\<\inline_LaTeX_Formula>

\\section{Matrix Example}

\\[
\\begin{pmatrix}
a & b \\\\
c & d
\\end{pmatrix}
\\]

\\end{document}
`;

function App() {
  const [userName, setUserName] = useState(`User_${Math.floor(Math.random() * 1000)}`);
  const [userColor] = useState(`#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`);
  const [userId] = useState(() => crypto.randomUUID());
  const [collabClient, setCollabClient] = useState(null);
  const [connected, setConnected] = useState(false);
  const [content, setContent] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [latexBlocks, setLatexBlocks] = useState([]);
  const [latexErrors, setLatexErrors] = useState([]);
  const [isOffline, setIsOffline] = useState(false);
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const previewRef = useRef(null);
  const decorationsRef = useRef(null);

  useEffect(() => {
    const init = async () => {
      try {
        await createDocument('Shared Document', INITIAL_CONTENT);
      } catch (e) {}
      
      const client = new CollabClient(DEFAULT_DOCUMENT, userId, userName, userColor);
      await client.connect();
      
      client.on('sync', (data) => {
        setContent(data.content || '');
        setConnected(true);
        setLoading(false);
      });

      client.on('usersPresence', (users) => {
        setRemoteUsers(users);
      });

      client.on('snapshotCreated', () => {
        loadSnapshots();
      });

      client.on('documentReverted', (data) => {
        cancelDebouncedRender();
        clearRenderCache();
        setContent(data.content);
        const newHtml = renderContentWithLatex(data.content, true);
        setPreviewHtml(newHtml);
        
        if (editorRef.current) {
          const model = editorRef.current.getModel();
          if (model) {
            model.setValue(data.content);
          }
        }
      });

      client.ydoc.on('update', () => {
        const newContent = client.getContent();
        setContent(newContent);
        try {
          debouncedRender(newContent, (html) => {
            setPreviewHtml(html);
          }, 200);
        } catch (e) {
          console.error('Render error:', e);
        }
      });

      setCollabClient(client);
      loadSnapshots();
    };

    init();

    const handleOnline = () => {
      setIsOffline(false);
      if (collabClient) {
        collabClient.reconnect();
      }
    };
    const handleOffline = () => setIsOffline(true);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      cancelDebouncedRender();
      clearRenderCache();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (collabClient) {
        collabClient.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const blocks = extractLatexBlocks(content);
    setLatexBlocks(blocks);
    
    const errors = validateLatexBlocks(content);
    setLatexErrors(errors);
    
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        const newDecorations = errors.map(error => {
          const startPos = model.getPositionAt(error.start);
          const endPos = model.getPositionAt(error.end);
          return {
            range: new monacoRef.current.Range(
              startPos.lineNumber,
              startPos.column,
              endPos.lineNumber,
              endPos.column
            ),
            options: {
              isWholeLine: false,
              className: 'latex-error-decoration',
              inlineClassName: 'latex-error-inline',
              hoverMessage: { value: `LaTeX Error: ${error.message}`
            }
          };
        });
        
        decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current || [], newDecorations);
      }
    }
  }, [content]);

  const handleExportSvg = (latex, index) => {
    downloadSvg(latex, `formula_${index + 1}.svg`);
  };

  const handleExportPng = async (latex, index) => {
    try {
      await downloadPng(latex, `formula_${index + 1}.png`);
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const loadSnapshots = async () => {
    try {
      const data = await getSnapshots(DEFAULT_DOCUMENT);
      setSnapshots(data);
    } catch (e) {
      console.error('Failed to load snapshots:', e);
    }
  };

  const handleRevert = async (snapshotId) => {
    if (confirm('Are you sure you want to revert to this snapshot?')) {
      try {
        await revertToSnapshot(DEFAULT_DOCUMENT, snapshotId);
      } catch (e) {
        console.error('Failed to revert:', e);
      }
    }
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    if (collabClient) {
      collabClient.bindMonaco(editor, monaco);
    }
  };

  useEffect(() => {
    if (collabClient && editorRef.current && monacoRef.current) {
      collabClient.bindMonaco(editorRef.current, monacoRef.current);
    }
  }, [collabClient]);

  useEffect(() => {
    if (collabClient) {
      collabClient.userName = userName;
    }
  }, [userName, collabClient]);

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="loading" style={{ height: '100vh' }}>
        <div>Connecting to collaborative server...</div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>LaTeX Collaborative Editor</h1>
        {isOffline && (
          <div className="offline-badge">
            <span className="offline-dot" />
            Offline Mode
          </div>
        )}
        <div className="user-info">
          <input
            type="text"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Your name"
          />
          <div className="users-list">
            <div className="user-badge">
              <span className="user-color-dot" style={{ backgroundColor: userColor }} />
              {userName} (You)
            </div>
            {remoteUsers.map((user) => (
              <div key={user.id} className="user-badge">
                <span className="user-color-dot" style={{ backgroundColor: user.color }} />
                {user.name}
              </div>
            ))}
          </div>
        </div>
      </header>

      <div className="main-container">
        <div className="editor-panel">
          <div className="panel-header">Editor - LaTeX</div>
          <div className="editor-wrapper">
            <Editor
              height="100%"
              defaultLanguage="latex"
              defaultValue={content}
              onMount={handleEditorMount}
              theme="vs-dark"
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                automaticLayout: true,
                wordWrap: 'on',
              }}
            />
          </div>
        </div>

        <div className="preview-panel">
          <div className="panel-header">Preview - LaTeX Rendering</div>
          <div 
            className="preview-content"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>

        <div className="sidebar">
          <div className="sidebar-section">
            <h3>Online Users</h3>
            <div style={{ gap: '8px', display: 'flex', flexDirection: 'column' }}>
              <div className="user-badge">
                <span className="user-color-dot" style={{ backgroundColor: userColor }} />
                {userName} (You)
              </div>
              {remoteUsers.map((user) => (
                <div key={user.id} className="user-badge">
                  <span className="user-color-dot" style={{ backgroundColor: user.color }} />
                  {user.name}
                </div>
              ))}
              {remoteUsers.length === 0 && (
                <div style={{ color: '#888', fontSize: '12px' }}>No other users online</div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>LaTeX Formulas ({latexBlocks.length})</h3>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {latexBlocks.map((block, index) => {
                const hasError = latexErrors.some(e => e.start === block.start);
                return (
                  <div key={index} className="formula-item" style={{ borderColor: hasError ? '#ff5555' : '#444' }}>
                    <div className="formula-preview">
                      F{index + 1}: {block.latex.substring(0, 40)}
                      {block.latex.length > 40 ? '...' : ''}
                    </div>
                    {hasError && (
                      <div className="formula-error">
                        ⚠️ Syntax error
                      </div>
                    )}
                    <div className="formula-actions">
                      <button 
                        className="btn-small"
                        onClick={() => handleExportSvg(block.latex, index)}
                      >
                        SVG
                      </button>
                      <button 
                        className="btn-small"
                        onClick={() => handleExportPng(block.latex, index)}
                      >
                        PNG
                      </button>
                    </div>
                  </div>
                );
              })}
              {latexBlocks.length === 0 && (
                <div style={{ color: '#888', fontSize: '12px' }}>No formulas found</div>
              )}
            </div>
          </div>

          <div className="sidebar-section">
            <h3>Snapshots ({snapshots.length})</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {snapshots.map((snapshot) => (
                <div
                  key={snapshot.id}
                  className="snapshot-item"
                  onClick={() => handleRevert(snapshot.id)}
                >
                  <div className="snapshot-version">Version {snapshot.version}</div>
                  <div className="snapshot-time">{formatTime(snapshot.created_at)}</div>
                </div>
              ))}
              {snapshots.length === 0 && (
                <div style={{ color: '#888', fontSize: '12px' }}>No snapshots yet</div>
              )}
            </div>
          </div>

          {latexErrors.length > 0 && (
            <div className="sidebar-section error-section">
              <h3 style={{ color: '#ff5555' }}>Errors ({latexErrors.length})</h3>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {latexErrors.map((error, index) => (
                  <div key={index} className="error-item">
                    <div className="error-message">{error.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="status-bar">
        <div className="status-connected">
          <span className="status-dot" />
          {connected ? 'Connected' : 'Disconnected'}
        </div>
        <div>{remoteUsers.length + 1} user(s) online</div>
      </div>
    </div>
  );
}

export default App;
