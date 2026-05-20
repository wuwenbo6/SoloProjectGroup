using UnityEngine;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Social
{
    public class ArtworkRankingSystem : Singleton<ArtworkRankingSystem>
    {
        [Header("排行榜设置")]
        public int maxRankingDisplay = 50;
        public int maxUserArtworkLimit = 10;
        public int coolDownMinutes = 5;

        [Header("排行榜数据")]
        public List<ArtworkEntry> allArtworks = new List<ArtworkEntry>();
        public List<ArtworkEntry> dailyRanking = new List<ArtworkEntry>();
        public List<ArtworkEntry> weeklyRanking = new List<ArtworkEntry>();

        [Header("用户数据")]
        public string currentUserId;
        public int totalUploadsToday = 0;
        public int totalLikesReceived = 0;
        public System.DateTime lastUploadTime;

        public System.Action<List<ArtworkEntry>> OnRankingUpdated;
        public System.Action<ArtworkEntry> OnArtworkUploaded;
        public System.Action<string, int> OnLikesUpdated;

        private List<string> likedArtworks = new List<string>();

        private void Start()
        {
            InitializeUser();
            LoadRankingData();
        }

        private void InitializeUser()
        {
            currentUserId = "Player_" + System.Guid.NewGuid().ToString().Substring(0, 8);
        }

        public bool CanUploadArtwork()
        {
            if (totalUploadsToday >= maxUserArtworkLimit)
                return false;

            System.TimeSpan timeSinceLastUpload = System.DateTime.Now - lastUploadTime;
            if (timeSinceLastUpload.TotalMinutes < coolDownMinutes && totalUploadsToday > 0)
                return false;

            return true;
        }

        public string GetUploadCooldownMessage()
        {
            if (totalUploadsToday >= maxUserArtworkLimit)
            {
                return $"今日上传次数已达上限 ({maxUserArtworkLimit}个)，请明天再试";
            }

            System.TimeSpan timeSinceLastUpload = System.DateTime.Now - lastUploadTime;
            double remainingMinutes = coolDownMinutes - timeSinceLastUpload.TotalMinutes;

            if (remainingMinutes > 0)
            {
                return $"冷却中... 还需等待 {Mathf.CeilToInt((float)remainingMinutes)} 分钟";
            }

            return "可以上传";
        }

        public bool UploadArtwork(Texture2D artwork, string title, string description, bool isPublic = true)
        {
            if (!CanUploadArtwork())
            {
                Debug.LogWarning("[排行榜] 无法上传作品");
                return false;
            }

            ArtworkEntry newEntry = new ArtworkEntry
            {
                artworkId = System.Guid.NewGuid().ToString(),
                authorId = currentUserId,
                authorName = GetCurrentUserName(),
                title = title,
                description = description,
                uploadTime = System.DateTime.Now.ToString(),
                likes = 0,
                views = 0,
                isPublic = isPublic,
                imageData = artwork.EncodeToPNG()
            };

            allArtworks.Add(newEntry);
            totalUploadsToday++;
            lastUploadTime = System.DateTime.Now;

            Debug.Log($"[排行榜] 作品上传成功: {title} (ID: {newEntry.artworkId})");
            OnArtworkUploaded?.Invoke(newEntry);

            UpdateRankings();
            SaveRankingData();

            return true;
        }

        public void LikeArtwork(string artworkId)
        {
            if (likedArtworks.Contains(artworkId))
            {
                Debug.LogWarning("[排行榜] 已经点赞过该作品");
                return;
            }

            ArtworkEntry artwork = allArtworks.Find(a => a.artworkId == artworkId);
            if (artwork != null)
            {
                artwork.likes++;
                likedArtworks.Add(artworkId);
                totalLikesReceived++;

                Debug.Log($"[排行榜] 点赞成功: {artwork.title}，当前点赞: {artwork.likes}");
                OnLikesUpdated?.Invoke(artworkId, artwork.likes);

                UpdateRankings();
                SaveRankingData();
            }
        }

        public void UnlikeArtwork(string artworkId)
        {
            if (!likedArtworks.Contains(artworkId))
                return;

            ArtworkEntry artwork = allArtworks.Find(a => a.artworkId == artworkId);
            if (artwork != null && artwork.likes > 0)
            {
                artwork.likes--;
                likedArtworks.Remove(artworkId);
                Debug.Log($"[排行榜] 取消点赞: {artwork.title}");
                OnLikesUpdated?.Invoke(artworkId, artwork.likes);
                UpdateRankings();
            }
        }

        public bool HasLiked(string artworkId)
        {
            return likedArtworks.Contains(artworkId);
        }

        public void ViewArtwork(string artworkId)
        {
            ArtworkEntry artwork = allArtworks.Find(a => a.artworkId == artworkId);
            if (artwork != null)
            {
                artwork.views++;
                SaveRankingData();
            }
        }

        private void UpdateRankings()
        {
            dailyRanking = GetTopArtworks(allArtworks, maxRankingDisplay);
            weeklyRanking = GetTopArtworks(GetTopArtworksThisWeek(), maxRankingDisplay);

            OnRankingUpdated?.Invoke(dailyRanking);
        }

        private List<ArtworkEntry> GetTopArtworks(List<ArtworkEntry> artworks, int count)
        {
            List<ArtworkEntry> sortedList = new List<ArtworkEntry>(artworks);
            sortedList.Sort((a, b) =>
            {
                int likeCompare = b.likes.CompareTo(a.likes);
                if (likeCompare != 0) return likeCompare;
                return b.views.CompareTo(a.views);
            });

            sortedList.RemoveAll(a => !a.isPublic);

            if (sortedList.Count > count)
            {
                sortedList.RemoveRange(count, sortedList.Count - count);
            }

            return sortedList;
        }

        private List<ArtworkEntry> GetTopArtworksThisWeek()
        {
            System.DateTime oneWeekAgo = System.DateTime.Now.AddDays(-7);
            return allArtworks.FindAll(a =>
            {
                if (System.DateTime.TryParse(a.uploadTime, out System.DateTime uploadDate))
                {
                    return uploadDate >= oneWeekAgo;
                }
                return false;
            });
        }

        public List<ArtworkEntry> GetDailyRanking(int startIndex = 0, int count = 20)
        {
            if (dailyRanking.Count == 0)
                UpdateRankings();

            int endIndex = Mathf.Min(startIndex + count, dailyRanking.Count);
            if (startIndex >= dailyRanking.Count)
                return new List<ArtworkEntry>();

            return dailyRanking.GetRange(startIndex, endIndex - startIndex);
        }

        public List<ArtworkEntry> GetWeeklyRanking(int startIndex = 0, int count = 20)
        {
            if (weeklyRanking.Count == 0)
                UpdateRankings();

            int endIndex = Mathf.Min(startIndex + count, weeklyRanking.Count);
            if (startIndex >= weeklyRanking.Count)
                return new List<ArtworkEntry>();

            return weeklyRanking.GetRange(startIndex, endIndex - startIndex);
        }

        public List<ArtworkEntry> GetUserArtworks(string userId)
        {
            return allArtworks.FindAll(a => a.authorId == userId);
        }

        public List<ArtworkEntry> GetMyArtworks()
        {
            return GetUserArtworks(currentUserId);
        }

        public List<ArtworkEntry> SearchArtworks(string keyword)
        {
            return allArtworks.FindAll(a =>
                a.title.ToLower().Contains(keyword.ToLower()) ||
                a.description.ToLower().Contains(keyword.ToLower()) ||
                a.authorName.ToLower().Contains(keyword.ToLower())
            );
        }

        public Texture2D LoadArtworkImage(string artworkId)
        {
            ArtworkEntry artwork = allArtworks.Find(a => a.artworkId == artworkId);
            if (artwork != null && artwork.imageData != null)
            {
                Texture2D texture = new Texture2D(2, 2);
                texture.LoadImage(artwork.imageData);
                return texture;
            }
            return null;
        }

        public void DeleteArtwork(string artworkId)
        {
            ArtworkEntry artwork = allArtworks.Find(a => a.artworkId == artworkId);
            if (artwork != null && artwork.authorId == currentUserId)
            {
                allArtworks.Remove(artwork);
                likedArtworks.Remove(artworkId);
                UpdateRankings();
                SaveRankingData();
                Debug.Log($"[排行榜] 作品已删除: {artwork.title}");
            }
        }

        public void ReportArtwork(string artworkId, string reason)
        {
            Debug.Log($"[排行榜] 举报作品 {artworkId}: {reason}");
        }

        public int GetUserRank(string userId)
        {
            for (int i = 0; i < dailyRanking.Count; i++)
            {
                if (dailyRanking[i].authorId == userId)
                {
                    return i + 1;
                }
            }
            return -1;
        }

        public string GetCurrentUserName()
        {
            return "扎染艺术家";
        }

        private void SaveRankingData()
        {
            RankingSaveData saveData = new RankingSaveData
            {
                allArtworks = allArtworks,
                likedArtworks = likedArtworks,
                totalUploadsToday = totalUploadsToday,
                totalLikesReceived = totalLikesReceived,
                lastUploadTime = lastUploadTime.ToString()
            };

            string json = JsonUtility.ToJson(saveData);
            PlayerPrefs.SetString("RankingData", json);
            PlayerPrefs.Save();
        }

        private void LoadRankingData()
        {
            string json = PlayerPrefs.GetString("RankingData", "");
            if (!string.IsNullOrEmpty(json))
            {
                try
                {
                    RankingSaveData savedData = JsonUtility.FromJson<RankingSaveData>(json);
                    allArtworks = savedData.allArtworks ?? new List<ArtworkEntry>();
                    likedArtworks = savedData.likedArtworks ?? new List<string>();
                    totalUploadsToday = savedData.totalUploadsToday;
                    totalLikesReceived = savedData.totalLikesReceived;

                    if (!string.IsNullOrEmpty(savedData.lastUploadTime))
                    {
                        System.DateTime.TryParse(savedData.lastUploadTime, out lastUploadTime);
                    }

                    System.DateTime lastDate = lastUploadTime.Date;
                    if (lastDate != System.DateTime.Today)
                    {
                        totalUploadsToday = 0;
                    }
                }
                catch
                {
                    Debug.LogWarning("[排行榜] 数据加载失败，使用默认数据");
                    InitializeSampleData();
                }
            }
            else
            {
                InitializeSampleData();
            }

            UpdateRankings();
        }

        private void InitializeSampleData()
        {
            Debug.Log("[排行榜] 初始化示例数据");

            for (int i = 0; i < 15; i++)
            {
                ArtworkEntry sample = new ArtworkEntry
                {
                    artworkId = System.Guid.NewGuid().ToString(),
                    authorId = "SampleAuthor_" + i,
                    authorName = GetRandomArtistName(),
                    title = GetRandomArtworkTitle(),
                    description = "一幅美丽的扎染艺术作品",
                    uploadTime = System.DateTime.Now.AddDays(-Random.Range(0, 7)).ToString(),
                    likes = Random.Range(10, 500),
                    views = Random.Range(50, 1000),
                    isPublic = true,
                    imageData = null
                };
                allArtworks.Add(sample);
            }
        }

        private string GetRandomArtistName()
        {
            string[] names = { "蓝染工坊", "彩云之南", "传统手工艺人", "扎染小匠", "云水间", "大理白族", "织梦人", "色彩大师", "蓝梦工坊" };
            return names[Random.Range(0, names.Length)];
        }

        private string GetRandomArtworkTitle()
        {
            string[] titles = { "山水印象", "春日繁花", "山水间", "蓝白梦境", "螺旋之舞", "春日花园", "海洋之心", "落日余晖", "青山绿水", "云卷云舒" };
            return titles[Random.Range(0, titles.Length)];
        }

        public int GetDailyUploadsRemaining()
        {
            return Mathf.Max(0, maxUserArtworkLimit - totalUploadsToday);
        }
    }

    [System.Serializable]
    public class ArtworkEntry
    {
        public string artworkId;
        public string authorId;
        public string authorName;
        public string title;
        public string description;
        public string uploadTime;
        public int likes;
        public int views;
        public bool isPublic;
        public byte[] imageData;
    }

    [System.Serializable]
    public class RankingSaveData
    {
        public List<ArtworkEntry> allArtworks;
        public List<string> likedArtworks;
        public int totalUploadsToday;
        public int totalLikesReceived;
        public string lastUploadTime;
    }
}
