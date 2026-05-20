using UnityEngine;
using System.Collections.Generic;
using System.IO;
using TieDyeGame.Core;

namespace TieDyeGame.Save
{
    public class SaveManager : Singleton<SaveManager>
    {
        [Header("保存设置")]
        public int maxSavedArtworks = 20;
        public string saveFolderName = "TieDyeArtworks";

        private List<ArtworkData> savedArtworks = new List<ArtworkData>();
        private string savePath;

        public System.Action<ArtworkData> OnArtworkSaved;
        public System.Action<string> OnSaveFailed;

        protected override void Awake()
        {
            base.Awake();
            InitializeSavePath();
            LoadSavedArtworks();
        }

        private void InitializeSavePath()
        {
            try
            {
                #if UNITY_EDITOR
                    savePath = Path.Combine(Application.dataPath, saveFolderName);
                #else
                    savePath = Path.Combine(Application.persistentDataPath, saveFolderName);
                #endif

                if (!Directory.Exists(savePath))
                {
                    Directory.CreateDirectory(savePath);
                }
            }
            catch (System.Exception e)
            {
                Debug.LogError($"Failed to initialize save path: {e.Message}");
            }
        }

        public bool SaveArtwork(Texture2D texture, string artworkName = null)
        {
            if (texture == null)
            {
                OnSaveFailed?.Invoke("纹理为空");
                return false;
            }

            try
            {
                if (string.IsNullOrEmpty(artworkName))
                {
                    artworkName = $"Artwork_{System.DateTime.Now:yyyyMMdd_HHmmss}";
                }

                ArtworkData newArtwork = new ArtworkData
                {
                    id = System.Guid.NewGuid().ToString(),
                    name = SanitizeFileName(artworkName),
                    timestamp = System.DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    usedFabric = Materials.MaterialManager.Instance?.selectedFabric?.fabricName ?? "未知",
                    usedDyes = GetUsedDyeNames(),
                    usedTieMethod = Materials.MaterialManager.Instance?.selectedTieMethod?.methodName ?? "无"
                };

                Texture2D readableTexture = EnsureReadableTexture(texture);
                byte[] pngData = readableTexture.EncodeToPNG();

                if (pngData == null || pngData.Length == 0)
                {
                    OnSaveFailed?.Invoke("PNG编码失败");
                    return false;
                }

                string imagePath = Path.Combine(savePath, $"{newArtwork.id}.png");
                File.WriteAllBytes(imagePath, pngData);

                string jsonPath = Path.Combine(savePath, $"{newArtwork.id}.json");
                string json = JsonUtility.ToJson(newArtwork, true);
                File.WriteAllText(jsonPath, json);

                savedArtworks.Insert(0, newArtwork);

                while (savedArtworks.Count > maxSavedArtworks && savedArtworks.Count > 0)
                {
                    int lastIndex = savedArtworks.Count - 1;
                    ArtworkData toRemove = savedArtworks[lastIndex];
                    DeleteArtworkInternal(toRemove);
                }

                SaveArtworkList();
                OnArtworkSaved?.Invoke(newArtwork);
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"保存作品失败: {e.Message}");
                OnSaveFailed?.Invoke($"保存失败: {e.Message}");
                return false;
            }
        }

        private Texture2D EnsureReadableTexture(Texture2D source)
        {
            if (source.isReadable)
                return source;

            RenderTexture rt = RenderTexture.GetTemporary(source.width, source.height);
            Graphics.Blit(source, rt);

            Texture2D result = new Texture2D(source.width, source.height, TextureFormat.RGBA32, false);
            result.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
            result.Apply();

            RenderTexture.ReleaseTemporary(rt);
            return result;
        }

        private string SanitizeFileName(string name)
        {
            char[] invalidChars = Path.GetInvalidFileNameChars();
            foreach (char c in invalidChars)
            {
                name = name.Replace(c, '_');
            }
            return name;
        }

        private string GetUsedDyeNames()
        {
            if (MaterialManager.Instance == null || MaterialManager.Instance.selectedDyes.Count == 0)
                return "无";

            return string.Join(", ", MaterialManager.Instance.selectedDyes.ConvertAll(d => d.dyeName));
        }

        public void DeleteArtwork(ArtworkData artwork)
        {
            if (DeleteArtworkInternal(artwork))
            {
                SaveArtworkList();
            }
        }

        private bool DeleteArtworkInternal(ArtworkData artwork)
        {
            if (artwork == null) return false;

            try
            {
                string imagePath = Path.Combine(savePath, $"{artwork.id}.png");
                string jsonPath = Path.Combine(savePath, $"{artwork.id}.json");

                if (File.Exists(imagePath))
                {
                    File.Delete(imagePath);
                }

                if (File.Exists(jsonPath))
                {
                    File.Delete(jsonPath);
                }

                savedArtworks.Remove(artwork);
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"删除作品失败: {e.Message}");
                return false;
            }
        }

        public List<ArtworkData> GetSavedArtworks()
        {
            return new List<ArtworkData>(savedArtworks);
        }

        public Texture2D LoadArtworkTexture(ArtworkData artwork)
        {
            if (artwork == null) return null;

            try
            {
                string imagePath = Path.Combine(savePath, $"{artwork.id}.png");

                if (!File.Exists(imagePath)) return null;

                byte[] pngData = File.ReadAllBytes(imagePath);
                Texture2D texture = new Texture2D(2, 2);
                texture.LoadImage(pngData);
                return texture;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"加载作品纹理失败: {e.Message}");
                return null;
            }
        }

        public bool ExportArtwork(ArtworkData artwork, string exportPath)
        {
            if (artwork == null) return false;

            try
            {
                string sourcePath = Path.Combine(savePath, $"{artwork.id}.png");
                if (!File.Exists(sourcePath)) return false;

                if (!Directory.Exists(exportPath))
                {
                    Directory.CreateDirectory(exportPath);
                }

                string destName = $"{SanitizeFileName(artwork.name)}.png";
                string destPath = Path.Combine(exportPath, destName);
                File.Copy(sourcePath, destPath, true);
                return true;
            }
            catch (System.Exception e)
            {
                Debug.LogError($"导出作品失败: {e.Message}");
                return false;
            }
        }

        public string GetExportPath()
        {
            #if UNITY_EDITOR
                return Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.Desktop), "TieDyeExports");
            #else
                return Path.Combine(Application.persistentDataPath, "Exports");
            #endif
        }

        private void LoadSavedArtworks()
        {
            if (string.IsNullOrEmpty(savePath)) return;

            savedArtworks.Clear();

            try
            {
                string listPath = Path.Combine(savePath, "artworkList.json");
                if (File.Exists(listPath))
                {
                    string json = File.ReadAllText(listPath);
                    ArtworkListData listData = JsonUtility.FromJson<ArtworkListData>(json);
                    if (listData?.artworks != null)
                    {
                        savedArtworks = listData.artworks;
                    }
                }
                else
                {
                    string[] jsonFiles = Directory.GetFiles(savePath, "*.json");

                    foreach (string jsonFile in jsonFiles)
                    {
                        if (Path.GetFileName(jsonFile) == "artworkList.json") continue;

                        try
                        {
                            string json = File.ReadAllText(jsonFile);
                            ArtworkData artwork = JsonUtility.FromJson<ArtworkData>(json);
                            savedArtworks.Add(artwork);
                        }
                        catch (System.Exception e)
                        {
                            Debug.LogWarning($"加载作品失败: {e.Message}");
                        }
                    }
                }

                savedArtworks.Sort((a, b) => b.timestamp.CompareTo(a.timestamp));
            }
            catch (System.Exception e)
            {
                Debug.LogError($"加载作品列表失败: {e.Message}");
            }
        }

        private void SaveArtworkList()
        {
            try
            {
                ArtworkListData listData = new ArtworkListData
                {
                    artworks = savedArtworks
                };

                string listPath = Path.Combine(savePath, "artworkList.json");
                string json = JsonUtility.ToJson(listData, true);
                File.WriteAllText(listPath, json);
            }
            catch (System.Exception e)
            {
                Debug.LogError($"保存作品列表失败: {e.Message}");
            }
        }

        public void ClearAllArtworks()
        {
            try
            {
                foreach (var artwork in savedArtworks)
                {
                    string imagePath = Path.Combine(savePath, $"{artwork.id}.png");
                    string jsonPath = Path.Combine(savePath, $"{artwork.id}.json");

                    if (File.Exists(imagePath)) File.Delete(imagePath);
                    if (File.Exists(jsonPath)) File.Delete(jsonPath);
                }

                savedArtworks.Clear();
                SaveArtworkList();
            }
            catch (System.Exception e)
            {
                Debug.LogError($"清空作品失败: {e.Message}");
            }
        }
    }

    [System.Serializable]
    public class ArtworkData
    {
        public string id;
        public string name;
        public string timestamp;
        public string usedFabric;
        public string usedDyes;
        public string usedTieMethod;
    }

    [System.Serializable]
    public class ArtworkListData
    {
        public List<ArtworkData> artworks;
    }
}
