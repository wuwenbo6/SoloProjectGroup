# 3D Collaborative Scene Editor

A real-time collaborative 3D scene editor built with Vue 3, Three.js, Node.js, Socket.IO, and WebRTC. Uses Yjs for CRDT-based conflict resolution and PostgreSQL for scene persistence with version history.

## Features

- **User Authentication**: Register and login with JWT-based authentication
- **Scene Management**: Create, join, and manage 3D scenes
- **3D Editing**: Add primitive objects (cubes, spheres, cylinders, toruses, planes), modify position, rotation, scale, and color
- **Real-time Collaboration**: Multi-user editing with WebSocket and WebRTC DataChannel
- **CRDT Sync**: Yjs-based conflict-free replicated data types for consistent state
- **Version History**: Scene snapshots and rollback functionality
- **Transform Controls**: W (translate), E (rotate), R (scale) keyboard shortcuts

## Tech Stack

### Frontend
- Vue 3 (Composition API)
- Three.js + OrbitControls + TransformControls
- Pinia (State Management)
- Vue Router
- Socket.IO Client
- Yjs (CRDT)
- Element Plus (UI Components)
- Vite (Build Tool)

### Backend
- Node.js + Express
- Socket.IO (WebSocket)
- Yjs (CRDT)
- PostgreSQL (Database)
- JWT (Authentication)
- bcrypt (Password Hashing)

## Project Structure

```
p20/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ThreeViewport.vue    # 3D viewport with Three.js
│   │   │   └── PropertyPanel.vue    # Object properties editor
│   │   ├── views/
│   │   │   ├── Login.vue            # Login page
│   │   │   ├── Register.vue         # Registration page
│   │   │   ├── ScenesList.vue       # Scene management
│   │   │   └── SceneEditor.vue      # Main editor
│   │   ├── store/
│   │   │   ├── auth.js              # Auth state
│   │   │   └── scene.js             # Scene state
│   │   ├── services/
│   │   │   ├── api.js               # HTTP API client
│   │   │   ├── socket.js            # Socket.IO client
│   │   │   └── webrtc.js            # WebRTC DataChannel
│   │   ├── router/
│   │   │   └── index.js             # Vue Router config
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── database/
│   │   │   └── index.js             # PostgreSQL connection & init
│   │   ├── crdt/
│   │   │   └── index.js             # Yjs CRDT manager
│   │   ├── socket/
│   │   │   └── index.js             # Socket.IO handlers
│   │   ├── webrtc/
│   │   │   └── signaling.js         # WebRTC signaling
│   │   ├── controllers/
│   │   │   ├── authController.js    # Auth endpoints
│   │   │   └── sceneController.js   # Scene endpoints
│   │   ├── routes/
│   │   │   └── index.js             # API routes
│   │   └── server.js                # Main server
│   ├── .env                         # Environment variables
│   └── package.json
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js 16+
- PostgreSQL
- npm or yarn

### Database Setup
1. Create a PostgreSQL database:
```sql
CREATE DATABASE 3d_editor;
```

2. Update backend/.env with your PostgreSQL credentials

### Backend Setup
```bash
cd backend
npm install
npm run dev
```

The server will start on port 3000 and automatically initialize the database tables.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:5173

## Usage

1. Register a new account or login
2. Create a new scene or join an existing scene by ID
3. Add 3D objects using the property panel
4. Select objects to modify:
   - Position: Click and drag or use input fields
   - Rotation: Press E or use input fields
   - Scale: Press R or use input fields
5. Delete objects with Delete/Backspace key
6. Create snapshots to save scene versions
7. Collaborate in real-time with other users

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Scenes
- `POST /api/scenes` - Create new scene
- `GET /api/scenes` - List user's scenes
- `GET /api/scenes/:id` - Get scene details
- `POST /api/scenes/:id/join` - Join a scene
- `DELETE /api/scenes/:id` - Delete scene
- `GET /api/scenes/:sceneId/snapshots` - Get scene snapshots

## WebSocket Events

- Scene operations (create, update, delete objects)
- Snapshot creation and rollback
- WebRTC signaling (offer, answer, ICE candidates)
- Peer presence notifications

## License

MIT
