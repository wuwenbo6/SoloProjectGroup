import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { AuthContext } from '../App';

function AnnotationPage() {
  const { bookId, pageId } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(null);
  const [lines, setLines] = useState([]);
  const [editingLine, setEditingLine] = useState(null);
  const [editingVersion, setEditingVersion] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [selectedLineForHistory, setSelectedLineForHistory] = useState(null);
  const { user } = useContext(AuthContext);

  const [permissions, setPermissions] = useState(null);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [permissionsList, setPermissionsList] = useState([]);
  const [users, setUsers] = useState([]);
  const [newPermission, setNewPermission] = useState({ userId: '', permissionLevel: 'annotator' });

  const [variantChars, setVariantChars] = useState([]);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [textToAnalyze, setTextToAnalyze] = useState('');
  const [recognizedVariants, setRecognizedVariants] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState('json');
  const [exporting, setExporting] = useState(false);

  const [modelPerformance, setModelPerformance] = useState(null);
  const [showModelStats, setShowModelStats] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const fetchPage = async () => {
    try {
      const response = await axios.get(`${API_BASE}/pages/${pageId}`);
      setPage(response.data);
    } catch (err) {
      console.error('获取页面信息失败:', err);
    }
  };

  const fetchLines = async () => {
    try {
      const response = await axios.get(`${API_BASE}/pages/${pageId}/lines`);
      setLines(response.data);
    } catch (err) {
      console.error('获取文字行失败:', err);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await axios.get(`${API_BASE}/permissions/${bookId}/${user.id}`);
      setPermissions(response.data);
    } catch (err) {
      console.error('获取权限失败:', err);
    }
  };

  const fetchPermissionsList = async () => {
    try {
      const response = await axios.get(`${API_BASE}/permissions/${bookId}`);
      setPermissionsList(response.data);
    } catch (err) {
      console.error('获取权限列表失败:', err);
    }
  };

  const fetchModelPerformance = async () => {
    try {
      const response = await axios.get(`${API_BASE}/model/performance`);
      setModelPerformance(response.data);
    } catch (err) {
      console.error('获取模型性能失败:', err);
    }
  };

  useEffect(() => {
    fetchPage();
    fetchLines();
    fetchPermissions();
    fetchUsers();
  }, [pageId, bookId]);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API_BASE}/users`);
      setUsers(response.data);
    } catch (err) {
      console.error('获取用户列表失败:', err);
    }
  };

  const handleEdit = async (line) => {
    if (!permissions?.can_annotate) {
      setError('您没有标注权限，请联系管理员');
      return;
    }

    if (editingLine && editingLine !== line.id) {
      await unlockLine(editingLine);
    }

    try {
      const response = await axios.post(`${API_BASE}/lines/${line.id}/lock`, { userId: user.id });

      if (response.data.locked) {
        setEditingLine(line.id);
        setEditingVersion(response.data.version);
        setEditContent(line.content || '');
        setError(null);
      }
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data.error + '，请稍后再试');
      } else {
        setError('锁定失败，请稍后再试');
      }
    }
  };

  const unlockLine = async (lineId) => {
    try {
      await axios.post(`${API_BASE}/lines/${lineId}/unlock`, { userId: user.id });
    } catch (err) {
      console.error('解锁失败:', err);
    }
  };

  const handleSave = async () => {
    if (!editingLine) return;

    setSaving(true);
    setError(null);
    try {
      await axios.put(`${API_BASE}/lines/${editingLine}/annotate`, {
        content: editContent,
        punctuation: '',
        userId: user.id,
        expectedVersion: editingVersion,
      });
      setEditingLine(null);
      setEditingVersion(null);
      setEditContent('');
      fetchLines();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data.error + '，请刷新页面获取最新版本');
      } else {
        setError('保存失败，请稍后再试');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (editingLine) {
      await unlockLine(editingLine);
    }
    setEditingLine(null);
    setEditingVersion(null);
    setEditContent('');
    setError(null);
  };

  const addPunctuation = (punct) => {
    setEditContent(prev => prev + punct);
  };

  const fetchVersionHistory = async (line) => {
    try {
      setSelectedLineForHistory(line);
      const response = await axios.get(`${API_BASE}/annotations/${line.id}/versions`);
      setVersionHistory(response.data);
      setShowVersionHistory(true);
    } catch (err) {
      console.error('获取版本历史失败:', err);
    }
  };

  const handleRollback = async (version) => {
    if (!selectedLineForHistory) return;

    try {
      await axios.post(`${API_BASE}/annotations/${selectedLineForHistory.id}/rollback`, {
        targetVersion: version,
        userId: user.id,
        changeNote: '回滚到历史版本',
      });
      setShowVersionHistory(false);
      setVersionHistory([]);
      setSelectedLineForHistory(null);
      fetchLines();
    } catch (err) {
      if (err.response?.status === 409) {
        setError(err.response.data.error);
      } else {
        setError('回滚失败，请稍后再试');
      }
    }
  };

  const analyzeVariants = async () => {
    setAnalyzing(true);
    try {
      const response = await axios.post('http://localhost:3004/variant/recognize', {
        text: textToAnalyze,
      });
      setRecognizedVariants(response.data.variants_found);
    } catch (err) {
      console.error('异体字识别失败:', err);
      setError('异体字识别失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await axios.post(`${API_BASE}/annotations/export`, {
        bookId,
        format: exportFormat,
        includePunctuation: true,
      });

      if (exportFormat === 'json') {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotations_${bookId}.json`;
        a.click();
      } else if (exportFormat === 'txt' || exportFormat === 'csv') {
        const blob = new Blob([response.data], { type: exportFormat === 'csv' ? 'text/csv' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotations_${bookId}.${exportFormat}`;
        a.click();
      }

      setShowExportModal(false);
    } catch (err) {
      console.error('导出失败:', err);
      setError('导出失败，请重试');
    } finally {
      setExporting(false);
    }
  };

  const grantPermission = async () => {
    try {
      await axios.post(`${API_BASE}/permissions/${bookId}`, {
        userId: newPermission.userId,
        permissionLevel: newPermission.permissionLevel,
        grantedBy: user.id,
      });
      fetchPermissionsList();
      setNewPermission({ userId: '', permissionLevel: 'annotator' });
    } catch (err) {
      console.error('授权失败:', err);
      setError('授权失败，请重试');
    }
  };

  const submitFeedback = async (annotation, feedbackType) => {
    try {
      await axios.post(`${API_BASE}/model-feedback`, {
        annotationId: annotation.id,
        originalContent: annotation.content,
        correctedContent: annotation.content,
        feedbackType,
        userId: user.id,
      });
    } catch (err) {
      console.error('提交反馈失败:', err);
    }
  };

  if (!page) {
    return <div>加载中...</div>;
  }

  const imageUrl = page.corrected_image_url
    ? `http://localhost:9000/ancient-books/${page.corrected_image_url}`
    : `http://localhost:9000/ancient-books/${page.original_image_url}`;

  const styles = {
    container: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '20px',
      minHeight: 'calc(100vh - 120px)',
    },
    imagePanel: {
      background: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
    },
    annotationPanel: {
      background: 'white',
      borderRadius: '8px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      display: 'flex',
      flexDirection: 'column',
    },
    panelTitle: {
      margin: '0 0 15px 0',
      color: '#2c3e50',
      fontSize: '18px',
    },
    imageContainer: {
      flex: 1,
      overflow: 'auto',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'flex-start',
    },
    image: {
      maxWidth: '100%',
      border: '1px solid #ddd',
    },
    linesList: {
      flex: 1,
      overflowY: 'auto',
    },
    lineItem: {
      padding: '12px 15px',
      borderBottom: '1px solid #ecf0f1',
      cursor: 'pointer',
      transition: 'background 0.2s',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    lineContentWrapper: {
      flex: 1,
    },
    lineNumber: {
      fontSize: '12px',
      color: '#95a5a6',
      marginBottom: '4px',
    },
    lineContent: {
      fontSize: '16px',
      color: '#2c3e50',
      lineHeight: '1.6',
    },
    confidence: {
      fontSize: '11px',
      color: '#bdc3c7',
      marginTop: '4px',
    },
    versionBadge: {
      fontSize: '11px',
      background: '#3498db',
      color: 'white',
      padding: '2px 8px',
      borderRadius: '10px',
    },
    historyButton: {
      padding: '4px 8px',
      fontSize: '12px',
      background: '#9b59b6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      marginLeft: '10px',
    },
    editArea: {
      padding: '15px',
      background: '#f8f9fa',
      borderRadius: '8px',
      marginBottom: '15px',
    },
    textarea: {
      width: '100%',
      minHeight: '80px',
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      fontSize: '16px',
      fontFamily: 'inherit',
      resize: 'vertical',
      marginBottom: '10px',
    },
    punctuationBar: {
      display: 'flex',
      gap: '8px',
      marginBottom: '10px',
      flexWrap: 'wrap',
    },
    punctButton: {
      padding: '6px 12px',
      background: 'white',
      border: '1px solid #ddd',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '16px',
    },
    buttonGroup: {
      display: 'flex',
      gap: '10px',
    },
    saveButton: {
      padding: '8px 20px',
      background: '#27ae60',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    cancelButton: {
      padding: '8px 20px',
      background: '#95a5a6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    backButton: {
      marginBottom: '20px',
      padding: '8px 16px',
      background: '#95a5a6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
    },
    empty: {
      textAlign: 'center',
      padding: '40px',
      color: '#7f8c8d',
    },
    editing: {
      background: '#e8f4f8',
    },
    locked: {
      background: '#ffeaa7',
    },
    error: {
      padding: '12px',
      background: '#ffebee',
      color: '#c0392b',
      borderRadius: '4px',
      marginBottom: '15px',
      fontSize: '14px',
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      background: 'white',
      padding: '25px',
      borderRadius: '8px',
      width: '500px',
      maxHeight: '80vh',
      overflowY: 'auto',
    },
    modalTitle: {
      margin: '0 0 20px 0',
      color: '#2c3e50',
    },
    versionItem: {
      padding: '12px',
      borderBottom: '1px solid #ecf0f1',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    versionInfo: {
      flex: 1,
    },
    versionText: {
      fontSize: '14px',
      color: '#2c3e50',
      marginBottom: '4px',
    },
    versionMeta: {
      fontSize: '12px',
      color: '#95a5a6',
    },
    rollbackButton: {
      padding: '6px 12px',
      background: '#e74c3c',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '12px',
    },
    closeButton: {
      marginTop: '15px',
      padding: '8px 20px',
      background: '#95a5a6',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      width: '100%',
    },
    toolbar: {
      display: 'flex',
      gap: '10px',
      marginBottom: '15px',
      flexWrap: 'wrap',
    },
    toolButton: {
      padding: '8px 14px',
      background: '#3498db',
      color: 'white',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '13px',
    },
    select: {
      padding: '8px 12px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginRight: '10px',
    },
    input: {
      padding: '10px',
      border: '1px solid #ddd',
      borderRadius: '4px',
      marginBottom: '10px',
      width: '100%',
    },
    variantItem: {
      padding: '10px',
      background: '#f8f9fa',
      borderRadius: '4px',
      marginBottom: '8px',
      borderLeft: '4px solid #3498db',
    },
    permissionItem: {
      padding: '12px',
      borderBottom: '1px solid #ecf0f1',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    permissionBadge: {
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '12px',
      fontWeight: 'bold',
    },
    ruleItem: {
      padding: '10px',
      background: '#f8f9fa',
      borderRadius: '4px',
      marginBottom: '8px',
    },
    feedbackButtons: {
      display: 'flex',
      gap: '5px',
      marginLeft: '10px',
    },
    feedbackButton: {
      padding: '4px 8px',
      fontSize: '11px',
      border: 'none',
      borderRadius: '3px',
      cursor: 'pointer',
    },
  };

  const punctuationMarks = ['，', '。', '、', '；', '：', '？', '！', '「', '」', '『', '』', '（', '）', '〔', '〕'];

  const getPermissionColor = (level) => {
    const colors = {
      admin: '#e74c3c',
      owner: '#e74c3c',
      editor: '#f39c12',
      reviewer: '#3498db',
      annotator: '#27ae60',
      viewer: '#95a5a6',
    };
    return colors[level] || '#95a5a6';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <button onClick={() => navigate(-1)} style={styles.backButton}>
          ← 返回
        </button>
        {permissions && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#7f8c8d' }}>
              当前权限: {permissions.permission_level}
            </span>
            {permissions.can_annotate && (
              <button
                onClick={() => setShowVariantModal(true)}
                style={{ ...styles.toolButton, background: '#9b59b6' }}
              >
                异体字识别
              </button>
            )}
            {permissions.can_manage && (
              <button
                onClick={() => {
                  fetchPermissionsList();
                  setShowPermissionsModal(true);
                }}
                style={{ ...styles.toolButton, background: '#f39c12' }}
              >
                权限管理
              </button>
            )}
            <button
              onClick={() => {
                fetchModelPerformance();
                setShowModelStats(true);
              }}
              style={{ ...styles.toolButton, background: '#1abc9c' }}
            >
              模型状态
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              style={{ ...styles.toolButton, background: '#e74c3c' }}
            >
              导出标注
            </button>
          </div>
        )}
      </div>

      <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>
        {page.book_title} - 第 {page.page_number} 页
      </h2>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.container}>
        <div style={styles.imagePanel}>
          <h3 style={styles.panelTitle}>原图</h3>
          <div style={styles.imageContainer}>
            <img src={imageUrl} alt="古籍页面" style={styles.image} />
          </div>
        </div>

        <div style={styles.annotationPanel}>
          <h3 style={styles.panelTitle}>文字标注 ({lines.length} 行)</h3>

          {editingLine && (
            <div style={styles.editArea}>
              <div style={styles.punctuationBar}>
                {punctuationMarks.map((p) => (
                  <button
                    key={p}
                    onClick={() => addPunctuation(p)}
                    style={styles.punctButton}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={styles.textarea}
                autoFocus
              />
              <div style={styles.buttonGroup}>
                <button onClick={handleSave} style={styles.saveButton} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </button>
                <button onClick={handleCancel} style={styles.cancelButton}>
                  取消
                </button>
              </div>
            </div>
          )}

          <div style={styles.linesList}>
            {lines.length === 0 ? (
              <div style={styles.empty}>暂无文字行数据</div>
            ) : (
              lines.map((line) => (
                <div
                  key={line.id}
                  style={{
                    ...styles.lineItem,
                    ...(editingLine === line.id ? styles.editing : {}),
                  }}
                >
                  <div style={styles.lineContentWrapper} onClick={() => handleEdit(line)}>
                    <div style={styles.lineNumber}>第 {line.line_number} 行</div>
                    <div style={styles.lineContent}>
                      {line.content || '(未识别)'}
                    </div>
                    <div style={styles.confidence}>
                      置信度: {Math.round((line.confidence_score || 0) * 100)}% | 
                      版本: v{line.annotation_version || 1}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {permissions?.can_review && (
                      <div style={styles.feedbackButtons}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            submitFeedback(line, 'accept');
                          }}
                          style={{ ...styles.feedbackButton, background: '#27ae60', color: 'white' }}
                        >
                          ✓
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            submitFeedback(line, 'correction');
                          }}
                          style={{ ...styles.feedbackButton, background: '#e74c3c', color: 'white' }}
                        >
                          ✗
                        </button>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchVersionHistory(line);
                      }}
                      style={styles.historyButton}
                    >
                      历史
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showVersionHistory && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>版本历史</h3>
            {versionHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#95a5a6' }}>
                暂无历史版本
              </div>
            ) : (
              versionHistory.map((version) => (
                <div key={version.id} style={styles.versionItem}>
                  <div style={styles.versionInfo}>
                    <div style={styles.versionText}>
                      {version.content.substring(0, 50)}
                      {version.content.length > 50 ? '...' : ''}
                    </div>
                    <div style={styles.versionMeta}>
                      v{version.version} | {version.created_by_name || '未知用户'} | 
                      {new Date(version.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRollback(version.version)}
                    style={styles.rollbackButton}
                  >
                    回滚
                  </button>
                </div>
              ))
            )}
            <button
              onClick={() => {
                setShowVersionHistory(false);
                setVersionHistory([]);
                setSelectedLineForHistory(null);
              }}
              style={styles.closeButton}
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {showVariantModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>异体字识别</h3>
            <textarea
              value={textToAnalyze}
              onChange={(e) => setTextToAnalyze(e.target.value)}
              placeholder="请输入要识别的文字..."
              style={{ ...styles.textarea, minHeight: '100px' }}
            />
            <button
              onClick={analyzeVariants}
              style={{ ...styles.saveButton, marginBottom: '15px' }}
              disabled={analyzing}
            >
              {analyzing ? '识别中...' : '开始识别'}
            </button>

            {recognizedVariants.length > 0 && (
              <div>
                <h4 style={{ marginBottom: '10px', color: '#2c3e50' }}>
                  发现 {recognizedVariants.length} 个异体字:
                </h4>
                {recognizedVariants.map((v, idx) => (
                  <div key={idx} style={styles.variantItem}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>
                      {v.variant_char} → {v.standard_char}
                    </div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>
                      置信度: {Math.round(v.confidence * 100)}% | 来源: {v.source}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setShowVariantModal(false)} style={styles.closeButton}>
              关闭
            </button>
          </div>
        </div>
      )}

      {showPermissionsModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>权限管理</h3>
            
            <div style={{ marginBottom: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px' }}>
              <h4 style={{ marginBottom: '10px' }}>添加新权限</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <select
                  value={newPermission.userId}
                  onChange={(e) => setNewPermission({ ...newPermission, userId: e.target.value })}
                  style={styles.select}
                >
                  <option value="">选择用户</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
                <select
                  value={newPermission.permissionLevel}
                  onChange={(e) => setNewPermission({ ...newPermission, permissionLevel: e.target.value })}
                  style={styles.select}
                >
                  <option value="viewer">浏览者</option>
                  <option value="annotator">标注者</option>
                  <option value="reviewer">审核者</option>
                  <option value="editor">编辑者</option>
                  <option value="owner">所有者</option>
                </select>
                <button onClick={grantPermission} style={styles.saveButton}>授权</button>
              </div>
            </div>

            <h4 style={{ marginBottom: '10px' }}>已授权用户</h4>
            {permissionsList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#95a5a6' }}>
                暂无授权记录
              </div>
            ) : (
              permissionsList.map((p) => (
                <div key={p.id} style={styles.permissionItem}>
                  <div>
                    <div style={{ fontWeight: 'bold' }}>{p.username}</div>
                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>{p.email}</div>
                  </div>
                  <span style={{
                    ...styles.permissionBadge,
                    background: getPermissionColor(p.permission_level) + '20',
                    color: getPermissionColor(p.permission_level),
                  }}>
                    {p.permission_level}
                  </span>
                </div>
              ))
            )}

            <button onClick={() => setShowPermissionsModal(false)} style={styles.closeButton}>
              关闭
            </button>
          </div>
        </div>
      )}

      {showExportModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>导出标注</h3>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px' }}>导出格式:</label>
              <div style={{ display: 'flex', gap: '15px' }}>
                {['json', 'txt', 'csv'].map((fmt) => (
                  <label key={fmt} style={{ cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="format"
                      value={fmt}
                      checked={exportFormat === fmt}
                      onChange={(e) => setExportFormat(e.target.value)}
                      style={{ marginRight: '5px' }}
                    />
                    {fmt.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <button
              onClick={handleExport}
              style={{ ...styles.saveButton, width: '100%' }}
              disabled={exporting}
            >
              {exporting ? '导出中...' : '开始导出'}
            </button>
            <button onClick={() => setShowExportModal(false)} style={styles.closeButton}>
              取消
            </button>
          </div>
        </div>
      )}

      {showModelStats && modelPerformance && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>模型性能状态</h3>
            
            <div style={{ marginBottom: '20px', padding: '15px', background: '#e8f8f5', borderRadius: '8px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#27ae60' }}>
                    {modelPerformance.summary?.total_annotations || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>总标注数</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e74c3c' }}>
                    {modelPerformance.summary?.corrections || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>人工修正数</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3498db' }}>
                    {Math.round((modelPerformance.summary?.avg_confidence || 0) * 100)}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#7f8c8d' }}>平均置信度</div>
                </div>
              </div>
            </div>

            <h4 style={{ marginBottom: '10px' }}>断句规则性能</h4>
            {modelPerformance.rules?.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#95a5a6' }}>
                暂无规则数据
              </div>
            ) : (
              modelPerformance.rules?.map((rule, idx) => (
                <div key={idx} style={styles.ruleItem}>
                  <div style={{ fontSize: '13px', fontFamily: 'monospace', marginBottom: '5px' }}>
                    {rule.rule_pattern}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: '#27ae60' }}>{rule.punctuation_type}</span>
                    <span style={{ color: '#7f8c8d' }}>
                      置信度: {Math.round(rule.confidence_score * 100)}% | 
                      使用: {rule.usage_count}次 | 
                      成功: {rule.success_count}次
                    </span>
                  </div>
                </div>
              ))
            )}

            <button onClick={() => setShowModelStats(false)} style={styles.closeButton}>
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnnotationPage;
