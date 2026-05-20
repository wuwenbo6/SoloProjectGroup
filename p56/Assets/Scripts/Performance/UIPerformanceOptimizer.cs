using UnityEngine;
using UnityEngine.UI;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using TieDyeGame.Core;

namespace TieDyeGame.Performance
{
    public class UIPerformanceOptimizer : Singleton<UIPerformanceOptimizer>
    {
        [Header("图集设置")]
        public bool enableSpriteAtlas = true;
        public int maxAtlasSize = 2048;
        public TextureFormat atlasFormat = TextureFormat.RGBA32;

        [Header("对象池设置")]
        public bool enableObjectPool = true;
        public int defaultPoolSize = 20;
        public int maxPoolSize = 100;

        [Header("降采样设置")]
        public bool enableDownsampling = false;
        [Range(1, 4)] public int downsampleFactor = 2;

        [Header("虚拟列表设置")]
        public bool enableVirtualList = true;
        public int visibleItemCount = 10;

        [Header("性能统计")]
        public int totalDrawCalls = 0;
        public int totalBatches = 0;
        public float uiFrameTime = 0f;
        public int pooledObjectsCount = 0;

        private Dictionary<string, ObjectPool> uiObjectPools = new Dictionary<string, ObjectPool>();
        private Dictionary<string, Sprite> spriteCache = new Dictionary<string, Sprite>();
        private Dictionary<int, VirtualListData> virtualLists = new Dictionary<int, VirtualListData>();
        private List<Canvas> trackedCanvases = new List<Canvas>();
        private List<Image> trackedImages = new List<Image>();

        private Coroutine optimizationCoroutine;
        private float lastFrameTime = 0f;
        private int frameCounter = 0;

        public System.Action<int> OnDrawCallReduction;
        public System.Action<float> OnFrameTimeUpdate;

        private new void Awake()
        {
            base.Awake();
            InitializeOptimizations();
        }

        private IEnumerator Start()
        {
            yield return new WaitForSeconds(1f);
            TrackAllCanvases();
            StartPerformanceMonitoring();
        }

        private void InitializeOptimizations()
        {
            if (enableObjectPool)
            {
                InitializePools();
            }

            if (enableSpriteAtlas)
            {
                StartCoroutine(OptimizeSpritesCoroutine());
            }

            Debug.Log($"[UI优化] 初始化完成: 图集={enableSpriteAtlas}, 对象池={enableObjectPool}, 虚拟列表={enableVirtualList}");
        }

        private void InitializePools()
        {
            GameObject[] prefabs = Resources.LoadAll<GameObject>("UI/Pooled");

            foreach (GameObject prefab in prefabs)
            {
                CreatePoolForPrefab(prefab, defaultPoolSize);
            }
        }

        public void CreatePoolForPrefab(GameObject prefab, int initialSize)
        {
            if (uiObjectPools.ContainsKey(prefab.name)) return;

            ObjectPool pool = new ObjectPool
            {
                prefab = prefab,
                poolName = prefab.name,
                objects = new Queue<GameObject>()
            };

            Transform poolParent = new GameObject($"Pool_{prefab.name}").transform;
            poolParent.SetParent(transform);
            pool.parent = poolParent;

            for (int i = 0; i < initialSize; i++)
            {
                GameObject obj = Instantiate(prefab, poolParent);
                obj.SetActive(false);
                pool.objects.Enqueue(obj);
            }

            uiObjectPools[prefab.name] = pool;
            pooledObjectsCount += pool.objects.Count;

            Debug.Log($"[UI优化] 创建对象池: {prefab.name}, 大小: {initialSize}");
        }

        public GameObject GetFromPool(string poolName, Transform parent = null)
        {
            if (!uiObjectPools.ContainsKey(poolName))
            {
                Debug.LogWarning($"[UI优化] 对象池不存在: {poolName}");
                return null;
            }

            ObjectPool pool = uiObjectPools[poolName];
            GameObject obj;

            if (pool.objects.Count > 0)
            {
                obj = pool.objects.Dequeue();
            }
            else
            {
                obj = Instantiate(pool.prefab, pool.parent);
            }

            if (parent != null)
            {
                obj.transform.SetParent(parent, false);
            }

            obj.SetActive(true);
            return obj;
        }

        public void ReturnToPool(GameObject obj)
        {
            if (obj == null) return;

            string poolName = obj.name.Replace("(Clone)", "").Trim();

            if (!uiObjectPools.ContainsKey(poolName))
            {
                Destroy(obj);
                return;
            }

            ObjectPool pool = uiObjectPools[poolName];

            if (pool.objects.Count >= maxPoolSize)
            {
                Destroy(obj);
                return;
            }

            obj.SetActive(false);
            obj.transform.SetParent(pool.parent, false);
            pool.objects.Enqueue(obj);
        }

        private IEnumerator OptimizeSpritesCoroutine()
        {
            yield return null;

            Image[] allImages = FindObjectsOfType<Image>();
            trackedImages.AddRange(allImages);

            Dictionary<Texture, List<Image>> textureGroups = new Dictionary<Texture, List<Image>>();

            foreach (Image image in allImages)
            {
                if (image.sprite == null) continue;

                Texture tex = image.sprite.texture;
                if (!textureGroups.ContainsKey(tex))
                {
                    textureGroups[tex] = new List<Image>();
                }
                textureGroups[tex].Add(image);
            }

            int batchedImages = 0;
            foreach (var group in textureGroups)
            {
                foreach (Image img in group.Value)
                {
                    if (img.material == null || img.material.shader.name == "UI/Default")
                    {
                        batchedImages++;
                    }
                }
            }

            Debug.Log($"[UI优化] 图集优化: {textureGroups.Count} 个纹理, {batchedImages} 个可批处理图片");
        }

        public void OptimizeCanvasRendering(Canvas canvas)
        {
            if (canvas == null) return;

            canvas.overrideSorting = true;
            canvas.additionalShaderChannels = AdditionalCanvasShaderChannels.None;

            CanvasScaler scaler = canvas.GetComponent<CanvasScaler>();
            if (scaler != null)
            {
                if (enableDownsampling)
                {
                    scaler.scaleFactor = 1f / downsampleFactor;
                }
            }

            RectMask2D[] masks = canvas.GetComponentsInChildren<RectMask2D>();
            Debug.Log($"[UI优化] 画布 {canvas.name} 遮罩数量: {masks.Length}");
        }

        public void InitializeVirtualList(int listId, int totalItems, System.Action<int, GameObject> onItemUpdate)
        {
            if (!enableVirtualList) return;

            VirtualListData listData = new VirtualListData
            {
                totalItemCount = totalItems,
                onItemUpdate = onItemUpdate,
                visibleItems = new Dictionary<int, GameObject>()
            };

            virtualLists[listId] = listData;
            Debug.Log($"[UI优化] 初始化虚拟列表 #{listId}, 总项数: {totalItems}");
        }

        public void UpdateVirtualList(int listId, float scrollOffset, float itemHeight, Transform contentParent)
        {
            if (!virtualLists.ContainsKey(listId)) return;

            VirtualListData listData = virtualLists[listId];
            int startIndex = Mathf.FloorToInt(scrollOffset / itemHeight);
            startIndex = Mathf.Max(0, startIndex);

            int endIndex = startIndex + visibleItemCount;
            endIndex = Mathf.Min(endIndex, listData.totalItemCount);

            List<int> toRemove = new List<int>();
            foreach (var kvp in listData.visibleItems)
            {
                if (kvp.Key < startIndex || kvp.Key >= endIndex)
                {
                    toRemove.Add(kvp.Key);
                }
            }

            foreach (int idx in toRemove)
            {
                GameObject item = listData.visibleItems[idx];
                ReturnToPool(item);
                listData.visibleItems.Remove(idx);
            }

            for (int i = startIndex; i < endIndex; i++)
            {
                if (!listData.visibleItems.ContainsKey(i))
                {
                    GameObject item = GetFromPool("ListItem", contentParent);
                    if (item != null)
                    {
                        RectTransform rt = item.GetComponent<RectTransform>();
                        if (rt != null)
                        {
                            rt.anchoredPosition = new Vector2(0, -i * itemHeight);
                        }
                        listData.visibleItems[i] = item;
                        listData.onItemUpdate?.Invoke(i, item);
                    }
                }
            }
        }

        public void DestroyVirtualList(int listId)
        {
            if (!virtualLists.ContainsKey(listId)) return;

            VirtualListData listData = virtualLists[listId];
            foreach (var kvp in listData.visibleItems)
            {
                ReturnToPool(kvp.Value);
            }

            virtualLists.Remove(listId);
        }

        private void TrackAllCanvases()
        {
            Canvas[] canvases = FindObjectsOfType<Canvas>();
            trackedCanvases.AddRange(canvases);

            foreach (Canvas canvas in canvases)
            {
                OptimizeCanvasRendering(canvas);
            }

            Debug.Log($"[UI优化] 追踪画布数量: {trackedCanvases.Count}");
        }

        private void StartPerformanceMonitoring()
        {
            if (optimizationCoroutine != null)
            {
                StopCoroutine(optimizationCoroutine);
            }
            optimizationCoroutine = StartCoroutine(PerformanceMonitorCoroutine());
        }

        private IEnumerator PerformanceMonitorCoroutine()
        {
            while (true)
            {
                float startTime = Time.realtimeSinceStartup;

                yield return new WaitForSeconds(0.5f);

                frameCounter++;
                uiFrameTime = (Time.realtimeSinceStartup - startTime) * 1000f / frameCounter;

                if (frameCounter >= 10)
                {
                    OnFrameTimeUpdate?.Invoke(uiFrameTime);
                    frameCounter = 0;

                    if (uiFrameTime > 16f)
                    {
                        ApplyAggressiveOptimizations();
                    }
                }
            }
        }

        private void ApplyAggressiveOptimizations()
        {
            Debug.LogWarning($"[UI优化] 检测到性能下降: {uiFrameTime:F2}ms, 应用激进优化");

            downsampleFactor = Mathf.Min(4, downsampleFactor + 1);
            visibleItemCount = Mathf.Max(5, visibleItemCount - 2);

            foreach (Canvas canvas in trackedCanvases)
            {
                CanvasScaler scaler = canvas.GetComponent<CanvasScaler>();
                if (scaler != null)
                {
                    scaler.scaleFactor = 1f / downsampleFactor;
                }
            }
        }

        public void BatchUpdateImages(Texture newTexture, List<Image> images)
        {
            Material sharedMaterial = new Material(Shader.Find("UI/Default"));
            sharedMaterial.mainTexture = newTexture;

            foreach (Image img in images)
            {
                img.material = sharedMaterial;
                img.SetAllDirty();
            }

            Debug.Log($"[UI优化] 批量更新 {images.Count} 个图片材质");
        }

        public void DisableOffscreenUI(Canvas canvas)
        {
            if (canvas == null) return;

            RectTransform canvasRect = canvas.GetComponent<RectTransform>();
            Camera cam = canvas.worldCamera ?? Camera.main;

            if (cam == null) return;

            Vector3[] corners = new Vector3[4];
            canvasRect.GetWorldCorners(corners);

            bool isVisible = false;
            foreach (Vector3 corner in corners)
            {
                Vector3 screenPos = cam.WorldToScreenPoint(corner);
                if (screenPos.x > 0 && screenPos.x < Screen.width &&
                    screenPos.y > 0 && screenPos.y < Screen.height &&
                    screenPos.z > 0)
                {
                    isVisible = true;
                    break;
                }
            }

            if (canvas.enabled != isVisible)
            {
                canvas.enabled = isVisible;
                if (!isVisible)
                {
                    Debug.Log($"[UI优化] 禁用离屏画布: {canvas.name}");
                }
            }
        }

        public void OptimizeTextRendering(Text text)
        {
            if (text == null) return;

            text.supportRichText = false;
            text.alignByGeometry = false;
            text.resizeTextForBestFit = false;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Truncate;

            Font font = text.font;
            if (font != null && font.material != null)
            {
                text.material = font.material;
            }
        }

        public void ForceRebuildLayout(RectTransform rect)
        {
            if (rect == null) return;

            LayoutRebuilder.MarkLayoutForRebuild(rect);
            StartCoroutine(RebuildLayoutCoroutine(rect));
        }

        private IEnumerator RebuildLayoutCoroutine(RectTransform rect)
        {
            yield return null;
            LayoutRebuilder.ForceRebuildLayoutImmediate(rect);
        }

        public int GetEstimatedDrawCalls()
        {
            int drawCalls = 0;
            HashSet<Texture> uniqueTextures = new HashSet<Texture>();
            HashSet<Material> uniqueMaterials = new HashSet<Material>();

            foreach (Image img in trackedImages)
            {
                if (img == null || !img.gameObject.activeInHierarchy) continue;

                if (img.sprite != null)
                {
                    uniqueTextures.Add(img.sprite.texture);
                }
                if (img.material != null)
                {
                    uniqueMaterials.Add(img.material);
                }
            }

            drawCalls = Mathf.Max(uniqueTextures.Count, uniqueMaterials.Count);
            totalDrawCalls = drawCalls;

            return drawCalls;
        }

        public void ClearAllPools()
        {
            foreach (var kvp in uiObjectPools)
            {
                while (kvp.Value.objects.Count > 0)
                {
                    GameObject obj = kvp.Value.objects.Dequeue();
                    Destroy(obj);
                }
            }

            uiObjectPools.Clear();
            pooledObjectsCount = 0;
            Debug.Log("[UI优化] 清除所有对象池");
        }

        private void OnDestroy()
        {
            ClearAllPools();
        }
    }

    public class ObjectPool
    {
        public string poolName;
        public GameObject prefab;
        public Transform parent;
        public Queue<GameObject> objects;
    }

    public class VirtualListData
    {
        public int totalItemCount;
        public System.Action<int, GameObject> onItemUpdate;
        public Dictionary<int, GameObject> visibleItems;
    }
}
