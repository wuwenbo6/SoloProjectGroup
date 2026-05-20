using UnityEngine;
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using CircuitSimulator.Components;

namespace CircuitSimulator.Core
{
    public class CollaborativeEditor : MonoBehaviour
    {
        public static CollaborativeEditor Instance { get; private set; }

        [Header("Network Settings")]
        [SerializeField] private int port = 8888;
        [SerializeField] private string defaultHost = "127.0.0.1";
        [SerializeField] private float syncInterval = 0.05f;

        [Header("User Info")]
        [SerializeField] private string userName = "User";
        [SerializeField] private Color userColor = Color.cyan;

        private bool isServer;
        private bool isConnected;
        private TcpListener server;
        private TcpClient client;
        private NetworkStream stream;
        private Thread networkThread;
        private volatile bool isRunning;

        private List<RemoteUser> remoteUsers = new List<RemoteUser>();
        private Queue<NetworkMessage> incomingMessages = new Queue<NetworkMessage>();
        private Queue<NetworkMessage> outgoingMessages = new Queue<NetworkMessage>();
        private readonly object messageLock = new object();

        private Dictionary<int, GameObject> remoteElements = new Dictionary<int, GameObject>();
        private int nextElementId = 1;

        public event Action<string> OnUserConnected;
        public event Action<string> OnUserDisconnected;
        public event Action<string> OnConnectionError;

        [System.Serializable]
        public class RemoteUser
        {
            public string name;
            public Color color;
            public Vector2 cursorPosition;
            public List<int> selectedElements = new List<int>();
            public GameObject cursorVisual;
        }

        [System.Serializable]
        public class NetworkMessage
        {
            public MessageType type;
            public string senderId;
            public string data;
            public long timestamp;
        }

        public enum MessageType
        {
            UserJoin,
            UserLeave,
            CursorPosition,
            ElementAdded,
            ElementRemoved,
            ElementMoved,
            ElementRotated,
            ElementUpdated,
            WireConnected,
            SelectionChanged,
            CircuitReset,
            ChatMessage,
            Ping
        }

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
            }
            else
            {
                Destroy(gameObject);
            }
        }

        public void StartServer()
        {
            if (isRunning) return;

            isServer = true;
            isRunning = true;
            userName = "Host";

            server = new TcpListener(IPAddress.Any, port);
            server.Start();

            networkThread = new Thread(ServerLoop)
            {
                IsBackground = true
            };
            networkThread.Start();

            Debug.Log($"Server started on port {port}");
            isConnected = true;
        }

        public void ConnectToServer(string host = null)
        {
            if (isRunning) return;

            isServer = false;
            isRunning = true;

            try
            {
                client = new TcpClient();
                client.Connect(host ?? defaultHost, port);
                stream = client.GetStream();

                networkThread = new Thread(ClientLoop)
                {
                    IsBackground = true
                };
                networkThread.Start();

                SendMessage(MessageType.UserJoin, userName);
                isConnected = true;
                Debug.Log($"Connected to {host ?? defaultHost}:{port}");
            }
            catch (Exception e)
            {
                OnConnectionError?.Invoke(e.Message);
                Debug.LogError($"Connection failed: {e.Message}");
                isRunning = false;
            }
        }

        public void Disconnect()
        {
            if (!isRunning) return;

            if (isServer)
            {
                SendMessage(MessageType.UserLeave, userName);
            }
            else
            {
                SendMessage(MessageType.UserLeave, userName);
            }

            isRunning = false;
            isConnected = false;

            stream?.Close();
            client?.Close();
            server?.Stop();
            networkThread?.Join(1000);

            ClearRemoteUsers();
            Debug.Log("Disconnected");
        }

        private void ServerLoop()
        {
            var clients = new List<TcpClient>();

            while (isRunning)
            {
                if (server.Pending())
                {
                    var newClient = server.AcceptTcpClient();
                    clients.Add(newClient);
                    Debug.Log("New client connected");
                }

                foreach (var c in clients.ToArray())
                {
                    if (!c.Connected)
                    {
                        clients.Remove(c);
                        continue;
                    }

                    if (c.Available > 0)
                    {
                        try
                        {
                            byte[] buffer = new byte[4096];
                            int bytesRead = c.GetStream().Read(buffer, 0, buffer.Length);
                            string messageData = Encoding.UTF8.GetString(buffer, 0, bytesRead);

                            var message = JsonUtility.FromJson<NetworkMessage>(messageData);
                            EnqueueIncomingMessage(message);

                            BroadcastMessage(messageData, c);
                        }
                        catch
                        {
                            clients.Remove(c);
                        }
                    }
                }

                ProcessOutgoingMessages(clients);
                Thread.Sleep(10);
            }

            foreach (var c in clients)
            {
                c.Close();
            }
        }

        private void ClientLoop()
        {
            while (isRunning && client.Connected)
            {
                try
                {
                    if (client.Available > 0)
                    {
                        byte[] buffer = new byte[4096];
                        int bytesRead = stream.Read(buffer, 0, buffer.Length);
                        string messageData = Encoding.UTF8.GetString(buffer, 0, bytesRead);
                        var message = JsonUtility.FromJson<NetworkMessage>(messageData);
                        EnqueueIncomingMessage(message);
                    }

                    ProcessOutgoingMessagesClient();
                    Thread.Sleep(10);
                }
                catch
                {
                    break;
                }
            }

            isConnected = false;
            isRunning = false;
        }

        private void BroadcastMessage(string messageData, TcpClient exclude = null)
        {
            if (!isServer) return;

            byte[] buffer = Encoding.UTF8.GetBytes(messageData);
        }

        private void ProcessOutgoingMessages(List<TcpClient> clients)
        {
            lock (messageLock)
            {
                while (outgoingMessages.Count > 0)
                {
                    var message = outgoingMessages.Dequeue();
                    string json = JsonUtility.ToJson(message);
                    byte[] buffer = Encoding.UTF8.GetBytes(json);

                    foreach (var c in clients)
                    {
                        if (c.Connected)
                        {
                            try
                            {
                                c.GetStream().Write(buffer, 0, buffer.Length);
                            }
                            catch { }
                        }
                    }
                }
            }
        }

        private void ProcessOutgoingMessagesClient()
        {
            lock (messageLock)
            {
                while (outgoingMessages.Count > 0 && stream != null)
                {
                    var message = outgoingMessages.Dequeue();
                    string json = JsonUtility.ToJson(message);
                    byte[] buffer = Encoding.UTF8.GetBytes(json);
                    stream.Write(buffer, 0, buffer.Length);
                }
            }
        }

        private void EnqueueIncomingMessage(NetworkMessage message)
        {
            lock (messageLock)
            {
                incomingMessages.Enqueue(message);
            }
        }

        public void SendMessage(MessageType type, string data)
        {
            if (!isConnected) return;

            lock (messageLock)
            {
                outgoingMessages.Enqueue(new NetworkMessage
                {
                    type = type,
                    senderId = userName,
                    data = data,
                    timestamp = DateTime.UtcNow.Ticks
                });
            }
        }

        private void Update()
        {
            ProcessIncomingMessages();
        }

        private void ProcessIncomingMessages()
        {
            lock (messageLock)
            {
                while (incomingMessages.Count > 0)
                {
                    var message = incomingMessages.Dequeue();
                    HandleMessage(message);
                }
            }
        }

        private void HandleMessage(NetworkMessage message)
        {
            switch (message.type)
            {
                case MessageType.UserJoin:
                    HandleUserJoin(message);
                    break;
                case MessageType.UserLeave:
                    HandleUserLeave(message);
                    break;
                case MessageType.CursorPosition:
                    HandleCursorPosition(message);
                    break;
                case MessageType.ElementAdded:
                    HandleElementAdded(message);
                    break;
                case MessageType.ElementRemoved:
                    HandleElementRemoved(message);
                    break;
                case MessageType.ElementMoved:
                    HandleElementMoved(message);
                    break;
                case MessageType.ElementRotated:
                    HandleElementRotated(message);
                    break;
                case MessageType.WireConnected:
                    HandleWireConnected(message);
                    break;
                case MessageType.SelectionChanged:
                    HandleSelectionChanged(message);
                    break;
            }
        }

        private void HandleUserJoin(NetworkMessage message)
        {
            if (message.senderId == userName) return;

            var user = new RemoteUser
            {
                name = message.senderId,
                color = GetUniqueColor(remoteUsers.Count)
            };

            CreateCursorVisual(user);
            remoteUsers.Add(user);
            OnUserConnected?.Invoke(message.senderId);
        }

        private void HandleUserLeave(NetworkMessage message)
        {
            var user = remoteUsers.Find(u => u.name == message.senderId);
            if (user != null)
            {
                if (user.cursorVisual != null)
                {
                    Destroy(user.cursorVisual);
                }
                remoteUsers.Remove(user);
                OnUserDisconnected?.Invoke(message.senderId);
            }
        }

        private void HandleCursorPosition(NetworkMessage message)
        {
            var user = remoteUsers.Find(u => u.name == message.senderId);
            if (user != null)
            {
                var pos = JsonUtility.FromJson<Vector2>(message.data);
                user.cursorPosition = pos;
                if (user.cursorVisual != null)
                {
                    user.cursorVisual.transform.position = pos;
                }
            }
        }

        private void HandleElementAdded(NetworkMessage message)
        {
            if (message.senderId == userName) return;

            var elementData = JsonUtility.FromJson<ElementSyncData>(message.data);
            
            var prefab = Resources.Load<GameObject>($"Elements/{elementData.type}");
            if (prefab != null)
            {
                var obj = Instantiate(prefab, elementData.position, Quaternion.Euler(0, 0, elementData.rotation));
                remoteElements[elementData.id] = obj;
            }
        }

        private void HandleElementRemoved(NetworkMessage message)
        {
            int id = int.Parse(message.data);
            if (remoteElements.TryGetValue(id, out var obj))
            {
                Destroy(obj);
                remoteElements.Remove(id);
            }
        }

        private void HandleElementMoved(NetworkMessage message)
        {
            var moveData = JsonUtility.FromJson<ElementMoveData>(message.data);
            if (remoteElements.TryGetValue(moveData.id, out var obj))
            {
                obj.transform.position = moveData.position;
            }
        }

        private void HandleElementRotated(NetworkMessage message)
        {
            var rotateData = JsonUtility.FromJson<ElementRotateData>(message.data);
            if (remoteElements.TryGetValue(rotateData.id, out var obj))
            {
                obj.transform.rotation = Quaternion.Euler(0, 0, rotateData.rotation);
            }
        }

        private void HandleWireConnected(NetworkMessage message)
        {
        }

        private void HandleSelectionChanged(NetworkMessage message)
        {
            var user = remoteUsers.Find(u => u.name == message.senderId);
            if (user != null)
            {
                var selectionData = JsonUtility.FromJson<SelectionData>(message.data);
                user.selectedElements = selectionData.selectedIds;
            }
        }

        private void CreateCursorVisual(RemoteUser user)
        {
            var cursorObj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            cursorObj.name = $"Cursor_{user.name}";
            cursorObj.transform.localScale = Vector3.one * 0.2f;

            var renderer = cursorObj.GetComponent<Renderer>();
            renderer.material = new Material(Shader.Find("Sprites/Default"));
            renderer.material.color = user.color;
            renderer.material.SetFloat("_Glossiness", 1f);

            Destroy(cursorObj.GetComponent<Collider>());
            user.cursorVisual = cursorObj;
        }

        private Color GetUniqueColor(int index)
        {
            float hue = (index * 0.618034f) % 1f;
            return Color.HSVToRGB(hue, 0.7f, 0.9f);
        }

        private void ClearRemoteUsers()
        {
            foreach (var user in remoteUsers)
            {
                if (user.cursorVisual != null)
                {
                    Destroy(user.cursorVisual);
                }
            }
            remoteUsers.Clear();
        }

        public void BroadcastCursorPosition(Vector2 position)
        {
            SendMessage(MessageType.CursorPosition, JsonUtility.ToJson(position));
        }

        public void BroadcastElementAdded(string type, Vector2 position, int id)
        {
            var data = new ElementSyncData
            {
                id = id,
                type = type,
                position = position,
                rotation = 0
            };
            SendMessage(MessageType.ElementAdded, JsonUtility.ToJson(data));
        }

        public void BroadcastElementRemoved(int id)
        {
            SendMessage(MessageType.ElementRemoved, id.ToString());
        }

        public void BroadcastElementMoved(int id, Vector2 position)
        {
            var data = new ElementMoveData { id = id, position = position };
            SendMessage(MessageType.ElementMoved, JsonUtility.ToJson(data));
        }

        public void BroadcastElementRotated(int id, float rotation)
        {
            var data = new ElementRotateData { id = id, rotation = rotation };
            SendMessage(MessageType.ElementRotated, JsonUtility.ToJson(data));
        }

        public void BroadcastSelectionChanged(List<int> selectedIds)
        {
            var data = new SelectionData { selectedIds = selectedIds };
            SendMessage(MessageType.SelectionChanged, JsonUtility.ToJson(data));
        }

        public int GetNextElementId()
        {
            return nextElementId++;
        }

        public List<RemoteUser> GetRemoteUsers()
        {
            return new List<RemoteUser>(remoteUsers);
        }

        public bool IsServer => isServer;
        public bool IsConnected => isConnected;

        private void OnDestroy()
        {
            Disconnect();
        }

        [System.Serializable]
        public class ElementSyncData
        {
            public int id;
            public string type;
            public Vector2 position;
            public float rotation;
        }

        [System.Serializable]
        public class ElementMoveData
        {
            public int id;
            public Vector2 position;
        }

        [System.Serializable]
        public class ElementRotateData
        {
            public int id;
            public float rotation;
        }

        [System.Serializable]
        public class SelectionData
        {
            public List<int> selectedIds;
        }
    }
}
