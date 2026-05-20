using UnityEngine;
using System.Collections.Generic;
using TieDyeGame.Core;
using TieDyeGame.DyePhysics;

namespace TieDyeGame.Multiplayer
{
    public class CoopGameManager : MonoBehaviour
    {
        [Header("游戏设置")]
        public CollaborationMode mode = CollaborationMode.SharedCanvas;
        public float gameTime = 180f;
        public bool enableRegionLock = true;

        [Header("引用")]
        public DyeSimulation dyeSimulation;
        public CustomTie.CustomTieEditor tieEditor;
        public GameObject[] playerRegionIndicators;

        [Header("游戏状态")]
        public bool isGameActive = false;
        public float currentTime = 0f;
        public int totalScore = 0;

        private Dictionary<string, PlayerRegion> playerRegions = new Dictionary<string, PlayerRegion>();
        private Dictionary<string, Color> playerColors = new Dictionary<string, Color>();

        public System.Action<CollaborationMode> OnModeChanged;
        public System.Action<int> OnScoreUpdated;
        public System.Action OnGameEnd;

        private void Start()
        {
            InitializePlayerColors();
            SubscribeToNetworkEvents();
        }

        private void InitializePlayerColors()
        {
            playerColors["Player1"] = Color.red;
            playerColors["Player2"] = Color.blue;
            playerColors["Player3"] = Color.green;
            playerColors["Player4"] = Color.yellow;
        }

        private void SubscribeToNetworkEvents()
        {
            if (NetworkManager.Instance != null)
            {
                NetworkManager.Instance.OnStrokeReceived += OnRemoteStrokeReceived;
                NetworkManager.Instance.OnDyeDataReceived += OnRemoteDyeReceived;
                NetworkManager.Instance.OnPlayerJoined += OnPlayerJoined;
                NetworkManager.Instance.OnPlayerLeft += OnPlayerLeft;
            }
        }

        public void SetCollaborationMode(CollaborationMode newMode)
        {
            mode = newMode;
            Debug.Log($"[协作] 模式切换为: {newMode}");

            switch (newMode)
            {
                case CollaborationMode.SharedCanvas:
                    SetupSharedCanvasMode();
                    break;
                case CollaborationMode.SplitRegion:
                    SetupSplitRegionMode();
                    break;
                case CollaborationMode.TurnBased:
                    SetupTurnBasedMode();
                    break;
                case CollaborationMode.Race:
                    SetupRaceMode();
                    break;
            }

            OnModeChanged?.Invoke(newMode);
        }

        private void SetupSharedCanvasMode()
        {
            Debug.Log("[协作] 共享画布模式：所有玩家在同一块布料上协作创作");
            if (playerRegionIndicators != null)
            {
                foreach (var indicator in playerRegionIndicators)
                {
                    indicator.SetActive(false);
                }
            }
        }

        private void SetupSplitRegionMode()
        {
            Debug.Log("[协作] 分区协作模式：每个玩家负责自己的区域");
            if (playerRegionIndicators != null && NetworkManager.Instance != null)
            {
                var players = NetworkManager.Instance.players;
                for (int i = 0; i < playerRegionIndicators.Length && i < players.Count; i++)
                {
                    playerRegionIndicators[i].SetActive(true);
                    playerRegionIndicators[i].GetComponent<Renderer>().material.color = GetPlayerColor(players[i].playerId);
                }

                AssignPlayerRegions(players);
            }
        }

        private void SetupTurnBasedMode()
        {
            Debug.Log("[协作] 回合制模式：玩家轮流操作");
        }

        private void SetupRaceMode()
        {
            Debug.Log("[协作] 竞赛模式：玩家各自创作，评分比较");
        }

        private void AssignPlayerRegions(List<PlayerInfo> players)
        {
            playerRegions.Clear();
            int rows = Mathf.CeilToInt(Mathf.Sqrt(players.Count));

            for (int i = 0; i < players.Count; i++)
            {
                int row = i / rows;
                int col = i % rows;

                PlayerRegion region = new PlayerRegion
                {
                    playerId = players[i].playerId,
                    minU = (float)col / rows,
                    maxU = (float)(col + 1) / rows,
                    minV = (float)row / rows,
                    maxV = (float)(row + 1) / rows
                };

                playerRegions[players[i].playerId] = region;
                Debug.Log($"[协作] 玩家 {players[i].playerName} 分配区域: ({region.minU:F2}, {region.minV:F2}) - ({region.maxU:F2}, {region.maxV:F2})");
            }
        }

        public bool IsInPlayerRegion(Vector2 uv, string playerId)
        {
            if (!enableRegionLock || !playerRegions.ContainsKey(playerId))
                return true;

            PlayerRegion region = playerRegions[playerId];
            return uv.x >= region.minU && uv.x <= region.maxU && uv.y >= region.minV && uv.y <= region.maxV;
        }

        public void StartCoopGame()
        {
            isGameActive = true;
            currentTime = gameTime;
            totalScore = 0;

            Debug.Log("[协作] 协作游戏开始！");
            OnScoreUpdated?.Invoke(totalScore);
        }

        public void BroadcastLocalDye(Vector2 position, float radius, Color color, float concentration)
        {
            if (!isGameActive || NetworkManager.Instance == null) return;

            if (enableRegionLock && !IsInPlayerRegion(position, NetworkManager.Instance.localPlayerId))
            {
                Debug.LogWarning("[协作] 不能在其他玩家区域染色");
                return;
            }

            DyeSyncData dyeData = new DyeSyncData
            {
                position = position,
                radius = radius,
                color = color,
                concentration = concentration
            };

            NetworkManager.Instance.BroadcastDyeData(dyeData);
            ApplyDye(dyeData);
        }

        private void OnRemoteDyeReceived(DyeSyncData dyeData)
        {
            if (dyeData.playerId == NetworkManager.Instance.localPlayerId) return;

            ApplyDye(dyeData);
            AddScore(10);
        }

        private void OnRemoteStrokeReceived(StrokeData strokeData)
        {
            if (strokeData.playerId == NetworkManager.Instance.localPlayerId) return;

            Debug.Log($"[协作] 收到玩家 {strokeData.playerId} 的笔触数据");
        }

        private void ApplyDye(DyeSyncData dyeData)
        {
            if (dyeSimulation != null)
            {
                dyeSimulation.ApplyDye(dyeData.position, dyeData.color, dyeData.radius, 1f, dyeData.concentration);
            }
        }

        public void AddScore(int points)
        {
            totalScore += points;
            OnScoreUpdated?.Invoke(totalScore);
        }

        private void OnPlayerJoined(PlayerInfo player)
        {
            Debug.Log($"[协作] 玩家 {player.playerName} 加入游戏");

            if (mode == CollaborationMode.SplitRegion)
            {
                AssignPlayerRegions(NetworkManager.Instance.players);
            }
        }

        private void OnPlayerLeft(PlayerInfo player)
        {
            Debug.Log($"[协作] 玩家 {player.playerName} 离开游戏");

            if (playerRegions.ContainsKey(player.playerId))
            {
                playerRegions.Remove(player.playerId);
            }

            if (NetworkManager.Instance.players.Count == 0)
            {
                EndGame();
            }
        }

        public Color GetPlayerColor(string playerId)
        {
            if (playerColors.TryGetValue(playerId, out Color color))
            {
                return color;
            }

            Color randomColor = Random.ColorHSV(0f, 1f, 0.5f, 1f, 0.5f, 1f);
            playerColors[playerId] = randomColor;
            return randomColor;
        }

        public void EndGame()
        {
            isGameActive = false;
            Debug.Log($"[协作] 游戏结束！最终得分: {totalScore}");
            OnGameEnd?.Invoke();
        }

        private void Update()
        {
            if (isGameActive)
            {
                currentTime -= Time.deltaTime;
                if (currentTime <= 0f)
                {
                    EndGame();
                }
            }
        }

        private void OnDestroy()
        {
            if (NetworkManager.Instance != null)
            {
                NetworkManager.Instance.OnStrokeReceived -= OnRemoteStrokeReceived;
                NetworkManager.Instance.OnDyeDataReceived -= OnRemoteDyeReceived;
                NetworkManager.Instance.OnPlayerJoined -= OnPlayerJoined;
                NetworkManager.Instance.OnPlayerLeft -= OnPlayerLeft;
            }
        }
    }

    public enum CollaborationMode
    {
        SharedCanvas,
        SplitRegion,
        TurnBased,
        Race
    }

    public class PlayerRegion
    {
        public string playerId;
        public float minU;
        public float maxU;
        public float minV;
        public float maxV;
    }
}
