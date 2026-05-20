using UnityEngine;
using UnityEngine.SceneManagement;
using System.Collections;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.ResourceOptimization
{
    public class ResourceLoader : Singleton<ResourceLoader>
    {
        [Header("资源分级设置")]
        public ResourceQualityLevel currentQuality = ResourceQualityLevel.Medium;
        public bool enableStreamingLoad = true;
        public int maxConcurrentLoads = 3;

        [Header("内存设置")]
        public int maxPoolSizePerType = 20;
        public float autoCleanupInterval = 30f;

        [Header("加载统计")]
        public int totalLoadedAssets = 0;
        public int cachedAssetsCount = 0;
        public float lastCleanupTime = 0f;

        private Dictionary<string, Object> assetCache = new Dictionary<string, Object>();
        private Dictionary<string, AsyncOperation> pendingOperations = new Dictionary<string, AsyncOperation>();
        private Dictionary<System.Type, Queue<GameObject>> objectPools = new Dictionary<System.Type, Queue<GameObject>>();
        private Queue<LoadRequest> loadRequestQueue = new Queue<LoadRequest>();
        private List<string> scenePreloadList = new List<string>();
        private bool isProcessingQueue = false;

        public System.Action<string, float> OnLoadProgress;
        public System.Action<string> OnLoadComplete;
        public System.Action<int> OnCacheCleanup;

        private IEnumerator Start()
        {
            DontDestroyOnLoad(gameObject);
            InitializeQualitySettings();
            StartCoroutine(AutoCleanupCoroutine());

            while (true)
            {
                if (loadRequestQueue.Count > 0 && !isProcessingQueue)
                {
                    yield return StartCoroutine(ProcessLoadQueue());
                }
                yield return null;
            }
        }

        private void InitializeQualitySettings()
        {
#if UNITY_ANDROID || UNITY_IOS
            currentQuality = ResourceQualityLevel.Low;
#elif UNITY_STANDALONE
            currentQuality = ResourceQualityLevel.High;
#else
            currentQuality = ResourceQualityLevel.Medium;
#endif

            Debug.Log($"[资源管理] 初始化质量等级: {currentQuality}");
        }

        public void PreloadSceneAssets(string sceneName)
        {
            if (!scenePreloadList.Contains(sceneName))
            {
                scenePreloadList.Add(sceneName);
                Debug.Log($"[资源管理] 标记场景预加载: {sceneName}");
            }
        }

        public Coroutine LoadSceneAsyncOptimized(string sceneName, LoadSceneMode mode = LoadSceneMode.Single)
        {
            return StartCoroutine(LoadSceneCoroutine(sceneName, mode));
        }

        private IEnumerator LoadSceneCoroutine(string sceneName, LoadSceneMode mode)
        {
            string progressKey = $"Scene_{sceneName}";

            AsyncOperation loadOp = SceneManager.LoadSceneAsync(sceneName, mode);
            loadOp.allowSceneActivation = false;
            pendingOperations[progressKey] = loadOp;

            while (!loadOp.isDone)
            {
                float progress = Mathf.Clamp01(loadOp.progress / 0.9f);
                OnLoadProgress?.Invoke(progressKey, progress);

                if (loadOp.progress >= 0.9f)
                {
                    yield return new WaitForEndOfFrame();
                    loadOp.allowSceneActivation = true;
                }

                yield return null;
            }

            pendingOperations.Remove(progressKey);
            OnLoadComplete?.Invoke(sceneName);
            Debug.Log($"[资源管理] 场景加载完成: {sceneName}");
        }

        public void QueueResourceLoad<T>(string assetPath, System.Action<T> onComplete) where T : Object
        {
            if (assetCache.ContainsKey(assetPath))
            {
                onComplete?.Invoke(assetCache[assetPath] as T);
                return;
            }

            LoadRequest request = new LoadRequest
            {
                assetPath = assetPath,
                assetType = typeof(T),
                onComplete = (obj) => onComplete?.Invoke(obj as T)
            };

            loadRequestQueue.Enqueue(request);
        }

        private IEnumerator ProcessLoadQueue()
        {
            isProcessingQueue = true;
            int activeLoads = 0;

            while (loadRequestQueue.Count > 0)
            {
                while (activeLoads >= maxConcurrentLoads)
                {
                    yield return null;
                }

                LoadRequest request = loadRequestQueue.Dequeue();
                StartCoroutine(LoadResourceCoroutine(request, () => activeLoads--));
                activeLoads++;
            }

            isProcessingQueue = false;
        }

        private IEnumerator LoadResourceCoroutine(LoadRequest request, System.Action onFinish)
        {
            ResourceRequest resourceReq = Resources.LoadAsync(request.assetPath, request.assetType);

            while (!resourceReq.isDone)
            {
                OnLoadProgress?.Invoke(request.assetPath, resourceReq.progress);
                yield return null;
            }

            if (resourceReq.asset != null)
            {
                assetCache[request.assetPath] = resourceReq.asset;
                totalLoadedAssets++;
                cachedAssetsCount = assetCache.Count;
                request.onComplete?.Invoke(resourceReq.asset);
            }

            onFinish?.Invoke();
        }

        public GameObject GetFromPool(GameObject prefab, Vector3 position, Quaternion rotation)
        {
            System.Type type = prefab.GetType();

            if (!objectPools.ContainsKey(type))
            {
                objectPools[type] = new Queue<GameObject>();
            }

            Queue<GameObject> pool = objectPools[type];

            if (pool.Count > 0)
            {
                GameObject obj = pool.Dequeue();
                obj.transform.SetPositionAndRotation(position, rotation);
                obj.SetActive(true);
                return obj;
            }

            return Instantiate(prefab, position, rotation);
        }

        public void ReturnToPool(GameObject obj)
        {
            if (obj == null) return;

            System.Type type = obj.GetType();

            if (!objectPools.ContainsKey(type))
            {
                objectPools[type] = new Queue<GameObject>();
            }

            Queue<GameObject> pool = objectPools[type];

            if (pool.Count < maxPoolSizePerType)
            {
                obj.SetActive(false);
                pool.Enqueue(obj);
            }
            else
            {
                Destroy(obj);
            }
        }

        public void WarmupPool(GameObject prefab, int count)
        {
            System.Type type = prefab.GetType();

            if (!objectPools.ContainsKey(type))
            {
                objectPools[type] = new Queue<GameObject>();
            }

            Queue<GameObject> pool = objectPools[type];

            for (int i = 0; i < count && pool.Count < maxPoolSizePerType; i++)
            {
                GameObject obj = Instantiate(prefab);
                obj.SetActive(false);
                pool.Enqueue(obj);
            }
        }

        public void UnloadUnusedAssets()
        {
            List<string> toRemove = new List<string>();

            foreach (var kvp in assetCache)
            {
                if (kvp.Value == null)
                {
                    toRemove.Add(kvp.Key);
                }
            }

            foreach (string key in toRemove)
            {
                assetCache.Remove(key);
            }

            cachedAssetsCount = assetCache.Count;
            OnCacheCleanup?.Invoke(toRemove.Count);

            if (toRemove.Count > 0)
            {
                Resources.UnloadUnusedAssets();
                System.GC.Collect();
                Debug.Log($"[资源管理] 清理缓存: 释放 {toRemove.Count} 个资源");
            }
        }

        private IEnumerator AutoCleanupCoroutine()
        {
            while (true)
            {
                yield return new WaitForSeconds(autoCleanupInterval);
                lastCleanupTime = Time.time;
                UnloadUnusedAssets();
            }
        }

        public void ClearAllCache()
        {
            assetCache.Clear();
            cachedAssetsCount = 0;
            Resources.UnloadUnusedAssets();
            System.GC.Collect();
            Debug.Log("[资源管理] 清理全部缓存");
        }

        public void SetQualityLevel(ResourceQualityLevel level)
        {
            currentQuality = level;
            ApplyQualitySettings();
        }

        private void ApplyQualitySettings()
        {
            switch (currentQuality)
            {
                case ResourceQualityLevel.Low:
                    QualitySettings.SetQualityLevel(0);
                    maxConcurrentLoads = 2;
                    break;
                case ResourceQualityLevel.Medium:
                    QualitySettings.SetQualityLevel(2);
                    maxConcurrentLoads = 3;
                    break;
                case ResourceQualityLevel.High:
                    QualitySettings.SetQualityLevel(5);
                    maxConcurrentLoads = 5;
                    break;
                case ResourceQualityLevel.Ultra:
                    QualitySettings.SetQualityLevel(6);
                    maxConcurrentLoads = 8;
                    break;
            }

            Debug.Log($"[资源管理] 质量等级设置: {currentQuality}, 并发加载: {maxConcurrentLoads}");
        }

        public string GetQualitySuffix()
        {
            switch (currentQuality)
            {
                case ResourceQualityLevel.Low: return "_low";
                case ResourceQualityLevel.Medium: return "_med";
                case ResourceQualityLevel.High: return "_high";
                case ResourceQualityLevel.Ultra: return "_ultra";
                default: return "";
            }
        }

        public Texture2D LoadTextureWithQuality(string basePath)
        {
            string qualityPath = basePath + GetQualitySuffix();
            Texture2D texture = Resources.Load<Texture2D>(qualityPath);

            if (texture == null)
            {
                texture = Resources.Load<Texture2D>(basePath);
            }

            return texture;
        }

        public void CancelAllLoads()
        {
            loadRequestQueue.Clear();
            pendingOperations.Clear();
            StopAllCoroutines();
            Debug.Log("[资源管理] 取消所有加载任务");
        }

        private void OnDestroy()
        {
            CancelAllLoads();
            ClearAllCache();
        }
    }

    public class LoadRequest
    {
        public string assetPath;
        public System.Type assetType;
        public System.Action<Object> onComplete;
    }

    public enum ResourceQualityLevel
    {
        Low,
        Medium,
        High,
        Ultra
    }
}
