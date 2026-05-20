using UnityEngine;
using System.Collections.Generic;
using TieDyeGame.Core;

namespace TieDyeGame.Multiplayer
{
    public class NetworkManager : Singleton<NetworkManager>
    {
        [Header("网络设置")]
        public string serverAddress = "127.0.0.1";
        public int port = 7777;
        public float syncInterval = 0.1f;

        [Header("当前状态")]
        public bool isConnected = false;
        public bool isHost = false;
        public string localPlayerId;
        public string currentRoomId;

        [Header("玩家列表")]
        public List<PlayerInfo> players = new List<PlayerInfo>();

        [Header("房间列表")]
        public List<RoomInfo> availableRooms = new List<RoomInfo>();

        private float syncTimer = 0f;

        public System.Action OnConnected;
        public System.Action OnDisconnected;
        public System.Action<PlayerInfo> OnPlayerJoined;
        public System.Action<PlayerInfo> OnPlayerLeft;
        public System.Action<RoomInfo> OnRoomCreated;
        public System.Action OnRoomJoined;
        public System.Action<List<RoomInfo>> OnRoomListUpdated;
        public System.Action<StrokeData> OnStrokeReceived;
        public System.Action<DyeSyncData> OnDyeDataReceived;

        private void Start()
        {
            InitializeNetwork();
        }

        private void InitializeNetwork()
        {
            localPlayerId = System.Guid.NewGuid().ToString().Substring(0, 8);
        }

        public void ConnectToServer()
        {
            Debug.Log($"[网络] 正在连接到 {serverAddress}:{port}...");
            Invoke(nameof(OnConnectionSuccess), 0.5f);
        }

        private void OnConnectionSuccess()
        {
            isConnected = true;
            Debug.Log("[网络] 已连接到服务器");
            OnConnected?.Invoke();
        }

        public void Disconnect()
        {
            if (currentRoomId != null)
            {
                LeaveRoom();
            }

            isConnected = false;
            isHost = false;
            players.Clear();
            Debug.Log("[网络] 已断开连接");
            OnDisconnected?.Invoke();
        }

        public void CreateRoom(string roomName, int maxPlayers = 4)
        {
            if (!isConnected) return;

            RoomInfo newRoom = new RoomInfo
            {
                roomId = System.Guid.NewGuid().ToString().Substring(0, 6),
                roomName = roomName,
                hostPlayerId = localPlayerId,
                maxPlayers = maxPlayers,
                currentPlayers = 1,
                isPlaying = false,
                createdAt = System.DateTime.Now.ToString()
            };

            availableRooms.Add(newRoom);
            currentRoomId = newRoom.roomId;
            isHost = true;

            PlayerInfo localPlayer = new PlayerInfo
            {
                playerId = localPlayerId,
                playerName = "玩家" + localPlayerId,
                isHost = true,
                isReady = true,
                colorIndex = 0
            };

            players.Add(localPlayer);

            Debug.Log($"[网络] 房间创建成功: {roomName} (ID: {newRoom.roomId})");
            OnRoomCreated?.Invoke(newRoom);
            OnRoomJoined?.Invoke();
        }

        public void JoinRoom(string roomId)
        {
            if (!isConnected) return;

            RoomInfo room = availableRooms.Find(r => r.roomId == roomId);
            if (room != null && room.currentPlayers < room.maxPlayers)
            {
                currentRoomId = roomId;
                room.currentPlayers++;
                isHost = false;

                PlayerInfo localPlayer = new PlayerInfo
                {
                    playerId = localPlayerId,
                    playerName = "玩家" + localPlayerId,
                    isHost = false,
                    isReady = true,
                    colorIndex = players.Count
                };

                players.Add(localPlayer);

                Debug.Log($"[网络] 加入房间: {room.roomName}");
                OnRoomJoined?.Invoke();
                OnPlayerJoined?.Invoke(localPlayer);
            }
        }

        public void LeaveRoom()
        {
            if (string.IsNullOrEmpty(currentRoomId)) return;

            RoomInfo room = availableRooms.Find(r => r.roomId == currentRoomId);
            if (room != null)
            {
                room.currentPlayers--;
                if (room.currentPlayers <= 0)
                {
                    availableRooms.Remove(room);
                    Debug.Log($"[网络] 房间已销毁: {room.roomName}");
                }
            }

            PlayerInfo leavingPlayer = players.Find(p => p.playerId == localPlayerId);
            if (leavingPlayer != null)
            {
                players.Remove(leavingPlayer);
                OnPlayerLeft?.Invoke(leavingPlayer);
            }

            currentRoomId = null;
            isHost = false;
            Debug.Log("[网络] 已离开房间");
        }

        public void RefreshRoomList()
        {
            OnRoomListUpdated?.Invoke(availableRooms);
        }

        public void SetPlayerReady(bool isReady)
        {
            PlayerInfo player = players.Find(p => p.playerId == localPlayerId);
            if (player != null)
            {
                player.isReady = isReady;
                Debug.Log($"[网络] 玩家状态: {(isReady ? "准备好" : "未准备")}");
            }
        }

        public void BroadcastStroke(StrokeData stroke)
        {
            if (!isConnected || string.IsNullOrEmpty(currentRoomId)) return;

            stroke.playerId = localPlayerId;
            stroke.timestamp = Time.time;

            OnStrokeReceived?.Invoke(stroke);
        }

        public void BroadcastDyeData(DyeSyncData dyeData)
        {
            if (!isConnected || string.IsNullOrEmpty(currentRoomId)) return;

            dyeData.playerId = localPlayerId;
            OnDyeDataReceived?.Invoke(dyeData);
        }

        public void StartGame()
        {
            if (!isHost) return;

            RoomInfo room = availableRooms.Find(r => r.roomId == currentRoomId);
            if (room != null)
            {
                room.isPlaying = true;
                Debug.Log("[网络] 游戏已开始");
            }
        }

        public void EndGame()
        {
            if (!isHost) return;

            RoomInfo room = availableRooms.Find(r => r.roomId == currentRoomId);
            if (room != null)
            {
                room.isPlaying = false;
                Debug.Log("[网络] 游戏已结束");
            }
        }

        public List<PlayerInfo> GetOtherPlayers()
        {
            return players.FindAll(p => p.playerId != localPlayerId);
        }

        public PlayerInfo GetLocalPlayer()
        {
            return players.Find(p => p.playerId == localPlayerId);
        }

        public void SetPlayerColor(int colorIndex)
        {
            PlayerInfo player = players.Find(p => p.playerId == localPlayerId);
            if (player != null)
            {
                player.colorIndex = colorIndex;
            }
        }

        public void SetPlayerName(string name)
        {
            PlayerInfo player = players.Find(p => p.playerId == localPlayerId);
            if (player != null)
            {
                player.playerName = name;
            }
        }

        private void Update()
        {
            if (isConnected && !string.IsNullOrEmpty(currentRoomId))
            {
                syncTimer += Time.deltaTime;
                if (syncTimer >= syncInterval)
                {
                    syncTimer = 0f;
                }
            }
        }

        private void OnDestroy()
        {
            if (isConnected)
            {
                Disconnect();
            }
        }
    }

    [System.Serializable]
    public class PlayerInfo
    {
        public string playerId;
        public string playerName;
        public bool isHost;
        public bool isReady;
        public int colorIndex;
        public int score;
    }

    [System.Serializable]
    public class RoomInfo
    {
        public string roomId;
        public string roomName;
        public string hostPlayerId;
        public int maxPlayers;
        public int currentPlayers;
        public bool isPlaying;
        public string createdAt;
    }

    [System.Serializable]
    public class StrokeData
    {
        public string playerId;
        public Vector2[] points;
        public float brushSize;
        public Color color;
        public float timestamp;
    }

    [System.Serializable]
    public class DyeSyncData
    {
        public string playerId;
        public Vector2 position;
        public float radius;
        public Color color;
        public float concentration;
        public float timestamp;
    }
}
