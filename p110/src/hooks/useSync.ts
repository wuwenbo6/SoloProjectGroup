import { useState, useEffect, useCallback } from 'react';
import useStore from '../store';
import { syncAPI } from '../services/api';
import {
  isOnline,
  addToSyncQueue,
  getSyncQueue,
  updateSyncQueueItem,
  removeFromSyncQueue,
  saveTextBlocks,
  saveAnnotations,
  saveImages,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
} from '../services/offlineStorage';

export function useSync() {
  const { user, textBlocks, setTextBlocks } = useStore();
  const [isOnlineState, setIsOnlineState] = useState(isOnline());
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnlineState(true);
    const handleOffline = () => setIsOnlineState(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (user) {
      getLastSyncTimestamp(user.id).then(setLastSyncTime);
      getSyncQueue(user.id, 'pending').then((items) => setPendingCount(items.length));
    }
  }, [user]);

  useEffect(() => {
    if (isOnlineState && user && pendingCount > 0) {
      syncPendingItems();
    }
  }, [isOnlineState, user?.id, pendingCount]);

  const syncPendingItems = useCallback(async () => {
    if (!user || syncing) return;

    setSyncing(true);
    try {
      const pendingItems = await getSyncQueue(user.id, 'pending');
      if (pendingItems.length === 0) return;

      for (const item of pendingItems) {
        await updateSyncQueueItem(item.id, { status: 'syncing' });
      }

      const result = await syncAPI.sync(
        user.id,
        pendingItems.map((item) => ({
          operation_type: item.operationType,
          entity_type: item.entityType,
          entity_id: item.entityId,
          data: item.data,
        }))
      );

      for (let i = 0; i < result.results.length; i++) {
        const item = pendingItems[i];
        const resultItem = result.results[i];
        if (resultItem.success) {
          await removeFromSyncQueue(item.id);
        } else {
          await updateSyncQueueItem(item.id, { status: 'error', errorMessage: resultItem.error });
        }
      }

      const timestamp = new Date().toISOString();
      await setLastSyncTimestamp(user.id, timestamp);
      setLastSyncTime(timestamp);

      const remainingItems = await getSyncQueue(user.id, 'pending');
      setPendingCount(remainingItems.length);
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [user, syncing]);

  const queueTextBlockUpdate = useCallback(
    async (blockId: string, updates: any) => {
      if (!user) return;

      if (isOnlineState) {
        return null;
      } else {
        await addToSyncQueue(user.id, 'update', 'text_block', blockId, updates);
        await updateSyncQueueItem(blockId, updates);
        const items = await getSyncQueue(user.id, 'pending');
        setPendingCount(items.length);
        return true;
      }
    },
    [user, isOnlineState]
  );

  const queueAnnotationCreate = useCallback(
    async (annotationData: any) => {
      if (!user) return;

      const annotationId = annotationData.id || crypto.randomUUID();
      if (isOnlineState) {
        return null;
      } else {
        await addToSyncQueue(user.id, 'create', 'annotation', annotationId, annotationData);
        await saveAnnotations([{ ...annotationData, id: annotationId, createdAt: new Date().toISOString() }]);
        const items = await getSyncQueue(user.id, 'pending');
        setPendingCount(items.length);
        return true;
      }
    },
    [user, isOnlineState]
  );

  const fullSync = useCallback(async () => {
    if (!user || !isOnlineState) return;

    setSyncing(true);
    try {
      const data = await syncAPI.getFullSyncData(user.id);

      await saveImages(data.images);
      await saveTextBlocks(data.text_blocks);
      await saveAnnotations(data.annotations);

      setTextBlocks(data.text_blocks);

      const timestamp = new Date().toISOString();
      await setLastSyncTimestamp(user.id, timestamp);
      setLastSyncTime(timestamp);
    } catch (error) {
      console.error('Full sync error:', error);
    } finally {
      setSyncing(false);
    }
  }, [user, isOnlineState, setTextBlocks]);

  return {
    isOnline: isOnlineState,
    syncing,
    pendingCount,
    lastSyncTime,
    syncPendingItems,
    queueTextBlockUpdate,
    queueAnnotationCreate,
    fullSync,
  };
}