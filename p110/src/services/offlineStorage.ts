import { v4 as uuidv4 } from 'uuid';
import { TextBlock, Annotation, OfflineSyncItem } from '../../shared/types';

const DB_NAME = 'AncientOCROfflineDB';
const DB_VERSION = 1;

const STORES = {
  TEXT_BLOCKS: 'text_blocks',
  ANNOTATIONS: 'annotations',
  SYNC_QUEUE: 'sync_queue',
  IMAGES: 'images',
  METADATA: 'metadata',
};

let db: IDBDatabase | null = null;

export async function initOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains(STORES.TEXT_BLOCKS)) {
        const blockStore = database.createObjectStore(STORES.TEXT_BLOCKS, { keyPath: 'id' });
        blockStore.createIndex('imageId', 'imageId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.ANNOTATIONS)) {
        const annotationStore = database.createObjectStore(STORES.ANNOTATIONS, { keyPath: 'id' });
        annotationStore.createIndex('imageId', 'imageId', { unique: false });
        annotationStore.createIndex('blockId', 'blockId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const queueStore = database.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'id' });
        queueStore.createIndex('userId', 'userId', { unique: false });
        queueStore.createIndex('status', 'status', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.IMAGES)) {
        const imageStore = database.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
        imageStore.createIndex('projectId', 'projectId', { unique: false });
      }

      if (!database.objectStoreNames.contains(STORES.METADATA)) {
        database.createObjectStore(STORES.METADATA, { keyPath: 'key' });
      }
    };
  });
}

export async function getDB(): Promise<IDBDatabase> {
  if (!db) {
    await initOfflineDB();
  }
  return db!;
}

export async function saveTextBlocks(blocks: TextBlock[]): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.TEXT_BLOCKS, 'readwrite');
    const store = transaction.objectStore(STORES.TEXT_BLOCKS);

    blocks.forEach((block) => store.put(block));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getTextBlocksByImage(imageId: string): Promise<TextBlock[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.TEXT_BLOCKS, 'readonly');
    const store = transaction.objectStore(STORES.TEXT_BLOCKS);
    const index = store.index('imageId');
    const request = index.getAll(imageId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updateTextBlock(blockId: string, updates: Partial<TextBlock>): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.TEXT_BLOCKS, 'readwrite');
    const store = transaction.objectStore(STORES.TEXT_BLOCKS);
    const getRequest = store.get(blockId);

    getRequest.onsuccess = () => {
      const block = getRequest.result;
      if (block) {
        store.put({ ...block, ...updates, updatedAt: new Date().toISOString() });
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function saveAnnotations(annotations: Annotation[]): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ANNOTATIONS, 'readwrite');
    const store = transaction.objectStore(STORES.ANNOTATIONS);

    annotations.forEach((annotation) => store.put(annotation));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getAnnotationsByImage(imageId: string): Promise<Annotation[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.ANNOTATIONS, 'readonly');
    const store = transaction.objectStore(STORES.ANNOTATIONS);
    const index = store.index('imageId');
    const request = index.getAll(imageId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addToSyncQueue(
  userId: string,
  operationType: 'create' | 'update' | 'delete',
  entityType: 'text_block' | 'annotation',
  entityId: string,
  data: any
): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);

    const syncItem: OfflineSyncItem = {
      id: uuidv4(),
      userId,
      operationType,
      entityType,
      entityId,
      data,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    store.put(syncItem);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getSyncQueue(userId: string, status?: string): Promise<OfflineSyncItem[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);

    if (status) {
      const index = store.index('status');
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    } else {
      const index = store.index('userId');
      const request = index.getAll(userId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  });
}

export async function updateSyncQueueItem(id: string, updates: Partial<OfflineSyncItem>): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        store.put({ ...item, ...updates });
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function removeFromSyncQueue(id: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function setLastSyncTimestamp(userId: string, timestamp: string): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.METADATA, 'readwrite');
    const store = transaction.objectStore(STORES.METADATA);
    store.put({ key: `lastSync_${userId}`, value: timestamp });

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getLastSyncTimestamp(userId: string): Promise<string | null> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.METADATA, 'readonly');
    const store = transaction.objectStore(STORES.METADATA);
    const request = store.get(`lastSync_${userId}`);

    request.onsuccess = () => resolve(request.result?.value || null);
    request.onerror = () => reject(request.error);
  });
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function saveImages(images: any[]): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.IMAGES, 'readwrite');
    const store = transaction.objectStore(STORES.IMAGES);

    images.forEach((image) => store.put(image));

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function getImagesByProject(projectId: string): Promise<any[]> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.IMAGES, 'readonly');
    const store = transaction.objectStore(STORES.IMAGES);
    const index = store.index('projectId');
    const request = index.getAll(projectId);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function clearOfflineData(): Promise<void> {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const stores = Object.values(STORES);
    let completed = 0;

    stores.forEach((storeName) => {
      const transaction = database.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        completed++;
        if (completed === stores.length) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  });
}