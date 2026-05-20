let gameScene = null;
let localPlayer = null;
let otherPlayers = new Map();
let puzzleObjects = [];
let nearPuzzle = null;

const config = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  scene: {
    preload: preload,
    create: create,
    update: update
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  }
};

function preload() {
  this.load.image('player', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0iIzRFQ0RDNCIvPjxjaXJjbGUgY3g9IjE0IiBjeT0iMTYiIHI9IjMiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyNiIgY3k9IjE2IiByPSIzIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE0IDI2IFFyIDIwIDMyIDI2IDI2IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==');
  this.load.image('other_player', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgZmlsbD0iI0ZGQjZCNiIvPjxjaXJjbGUgY3g9IjE0IiBjeT0iMTYiIHI9IjMiIGZpbGw9IiNmZmYiLz48Y2lyY2xlIGN4PSIyNiIgY3k9IjE2IiByPSIzIiBmaWxsPSIjZmZmIi8+PHBhdGggZD0iTTE0IDI2IFFyIDIwIDMyIDI2IDI2IiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiIgZmlsbD0ibm9uZSIvPjwvc3ZnPg==');
  this.load.image('puzzle_icon', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB4PSI1IiB5PSI1IiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHJ4PSI1IiBmaWxsPSIjNjY3ZWVhIi8+PHBhdGggZD0iTTIwIDE1IEwyNSAyNSBMMzAgMTUgTDI1IDIwIEwyMCAxNSIgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjMiIGZpbGw9Im5vbmUiLz48L3N2Zz4=');
  this.load.image('floor', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IiMxYjJiM2UiLz48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNncmlkKSIvPjxkZWZzPjxwYXR0ZXJuIGlkPSJncmlkIiB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgMTAwIDEwIE0gMCAyMCBMIDEwMCAyMCBNIDAgMzAgTCAxMDAgMzAgTSAwIDQwIEwgMTAwIDQwIE0gMCA1MCBMIDEwMCA1MCBNIDAgNjAgTCAxMDAgNjAgTSAwIDcwIEwgMTAwIDcwIE0gMCA4MCBMIDEwMCA4MCBNIDAgOTAgTCAxMDAgOTAgTSAxMCAwIEwgMTAgMTAwIE0gMjAgMCBMIDIwIDEwMCBNIDMwIDAgTCAzMCAxMDAgTSA0MCAwIEwgNDAgMTAwIE0gNTAgMCBMIDUwIDEwMCBNIDYwIDAgTCA2MCAxMDAgTSA3MCAwIEwgNzAgMTAwIE0gODAgMCBMIDgwIDEwMCBNIDkwIDAgTCA5MCAxMDAiIHN0cm9rZT0iIzI3Mzc0YiIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48L3N2Zz4=');
  this.load.image('wall', 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHZpZXdCb3g9IjAgMCA1MCA1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIGZpbGw9IiM0YTU1NjIiLz48cmVjdCB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIGZpbGw9InVybCgjd2FsbC1ncmlkKSIvPjxkZWZzPjxwYXR0ZXJuIGlkPSJ3YWxsLWdyaWQiIHdpZHRoPSI1MCIgaGVpZ2h0PSI1MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDI1IEwgNTAgMjUgTSAyNSAwIEwgMjUgNTAiIHN0cm9rZT0iIzNiNDU0ZiIgc3Ryb2tlLXdpZHRoPSIyIi8+PC9wYXR0ZXJuPjwvZGVmcz48L3N2Zz4=');
}

function create() {
  gameScene = this;
  
  const worldWidth = 2000;
  const worldHeight = 1500;
  
  this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
  this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
  
  const floorTile = this.textures.get('floor').getSourceImage();
  const floorGraphics = this.add.graphics();
  for (let x = 0; x < worldWidth; x += 100) {
    for (let y = 0; y < worldHeight; y += 100) {
      floorGraphics.fillStyle(0x1b2b3e);
      floorGraphics.fillRect(x, y, 100, 100);
      floorGraphics.lineStyle(1, 0x27374b, 1);
      floorGraphics.strokeRect(x, y, 100, 100);
    }
  }
  floorGraphics.generateTexture('floor_texture', worldWidth, worldHeight);
  floorGraphics.destroy();
  
  this.add.image(worldWidth/2, worldHeight/2, 'floor_texture');
  
  this.walls = this.physics.add.staticGroup();
  
  const wallThickness = 50;
  for (let x = 0; x < worldWidth; x += 50) {
    this.walls.create(x + 25, 25, 'wall').setDisplaySize(50, 50).refreshBody();
    this.walls.create(x + 25, worldHeight - 25, 'wall').setDisplaySize(50, 50).refreshBody();
  }
  for (let y = 50; y < worldHeight - 50; y += 50) {
    this.walls.create(25, y + 25, 'wall').setDisplaySize(50, 50).refreshBody();
    this.walls.create(worldWidth - 25, y + 25, 'wall').setDisplaySize(50, 50).refreshBody();
  }
  
  this.walls.create(500, 300, 'wall').setDisplaySize(200, 50).refreshBody();
  this.walls.create(800, 500, 'wall').setDisplaySize(50, 200).refreshBody();
  this.walls.create(1200, 400, 'wall').setDisplaySize(150, 50).refreshBody();
  this.walls.create(1500, 800, 'wall').setDisplaySize(50, 250).refreshBody();
  this.walls.create(300, 900, 'wall').setDisplaySize(200, 50).refreshBody();
  
  localPlayer = this.physics.add.sprite(400, 300, 'player');
  localPlayer.setDisplaySize(40, 40);
  localPlayer.setCollideWorldBounds(true);
  localPlayer.body.setCircle(18);
  
  this.physics.add.collider(localPlayer, this.walls);
  
  this.cameras.main.startFollow(localPlayer);
  this.cameras.main.setZoom(1);
  this.cameras.main.setLerp(0.1);
  
  this.otherPlayersGroup = this.add.group();
  
  this.cursors = this.input.keyboard.createCursorKeys();
  this.keys = this.input.keyboard.addKeys({
    W: Phaser.Input.Keyboard.KeyCodes.W,
    A: Phaser.Input.Keyboard.KeyCodes.A,
    S: Phaser.Input.Keyboard.KeyCodes.S,
    D: Phaser.Input.Keyboard.KeyCodes.D,
    E: Phaser.Input.Keyboard.KeyCodes.E
  });
  
  this.playerNameText = this.add.text(0, 0, playerName, {
    fontSize: '14px',
    fill: '#ffffff',
    stroke: '#000000',
    strokeThickness: 3
  }).setOrigin(0.5).setDepth(100);
  
  this.puzzleObjects = [];
  this.puzzleTriggers = [
    { x: 300, y: 500, puzzleId: 'code_lock_1', name: '密码锁' },
    { x: 700, y: 700, puzzleId: 'jigsaw_1', name: '拼图' },
    { x: 1100, y: 600, puzzleId: 'hidden_object_1', name: '隐藏物品' }
  ];
  
  this.puzzleTriggers.forEach((trigger, index) => {
    const sprite = this.physics.add.sprite(trigger.x, trigger.y, 'puzzle_icon');
    sprite.setDisplaySize(50, 50);
    sprite.setImmovable(true);
    sprite.puzzleId = trigger.puzzleId;
    sprite.puzzleName = trigger.name;
    this.puzzleObjects.push(sprite);
    
    const text = this.add.text(trigger.x, trigger.y - 40, trigger.name, {
      fontSize: '12px',
      fill: '#ffd93d',
      stroke: '#000',
      strokeThickness: 2
    }).setOrigin(0.5);
  });
  
  this.lastMoveTime = 0;
  this.moveThrottle = 50;
  
  network.getPuzzles();
  
  window.addEventListener('resize', () => {
    this.scale.resize(window.innerWidth, window.innerHeight);
  });
}

function update() {
  if (!localPlayer) return;
  
  const speed = 300;
  let velX = 0;
  let velY = 0;
  
  if (this.cursors.left.isDown || this.keys.A.isDown) {
    velX = -speed;
  }
  if (this.cursors.right.isDown || this.keys.D.isDown) {
    velX = speed;
  }
  if (this.cursors.up.isDown || this.keys.W.isDown) {
    velY = -speed;
  }
  if (this.cursors.down.isDown || this.keys.S.isDown) {
    velY = speed;
  }
  
  if (velX !== 0 && velY !== 0) {
    velX *= 0.707;
    velY *= 0.707;
  }
  
  localPlayer.setVelocity(velX, velY);
  
  this.playerNameText.setPosition(localPlayer.x, localPlayer.y - 30);
  
  const now = Date.now();
  if ((velX !== 0 || velY !== 0) && now - this.lastMoveTime > this.moveThrottle) {
    network.sendPlayerMove(localPlayer.x, localPlayer.y);
    this.lastMoveTime = now;
  }
  
  let nearAnyPuzzle = false;
  this.puzzleObjects.forEach(obj => {
    const distance = Phaser.Math.Distance.Between(
      localPlayer.x, localPlayer.y,
      obj.x, obj.y
    );
    if (distance < 80) {
      nearAnyPuzzle = true;
      nearPuzzle = obj.puzzleId;
    }
  });
  
  showInteractHint(nearAnyPuzzle);
  
  if (this.keys.E.isDown && nearPuzzle) {
    if (!this.eKeyPressed) {
      this.eKeyPressed = true;
      openPuzzle(nearPuzzle);
    }
  } else {
    this.eKeyPressed = false;
  }
  
  otherPlayers.forEach((player, playerId) => {
    if (player.text) {
      player.text.setPosition(player.sprite.x, player.sprite.y - 30);
    }
  });
}

function onRoomCreated(message) {
  startGame();
  updatePlayersList(message.players || []);
}

function onRoomJoined(message) {
  startGame();
  updatePlayersList(message.players || []);
  
  message.players.forEach(player => {
    if (player.playerId !== network.playerId) {
      addOtherPlayer(player);
      webrtc.addPlayer(player.playerId);
    }
  });
}

function onRoomState(message) {
  updatePlayersList(message.players);
  updatePuzzleList(message.puzzles);
  
  message.players.forEach(player => {
    if (player.playerId !== network.playerId && !otherPlayers.has(player.playerId)) {
      addOtherPlayer(player);
      webrtc.addPlayer(player.playerId);
    }
  });
}

function onPlayerJoined(player) {
  if (player.playerId !== network.playerId) {
    addOtherPlayer(player);
    webrtc.addPlayer(player.playerId);
  }
}

function onPlayerLeft(playerId) {
  removeOtherPlayer(playerId);
  webrtc.removePlayer(playerId);
}

function onPlayerMoved(message) {
  const player = otherPlayers.get(message.playerId);
  if (player) {
    player.targetX = message.x;
    player.targetY = message.y;
    
    if (!player.isMoving) {
      player.isMoving = true;
      smoothMovePlayer(player);
    }
  }
}

function onCameraUpdated(message) {
  if (gameScene && gameScene.cameras.main) {
  }
}

function addOtherPlayer(playerData) {
  if (!gameScene) return;
  
  const sprite = gameScene.add.sprite(playerData.x || 400, playerData.y || 300, 'other_player');
  sprite.setDisplaySize(40, 40);
  sprite.setTint(parseInt(playerData.color.replace('#', '0x')));
  
  const text = gameScene.add.text(0, 0, playerData.name, {
    fontSize: '12px',
    fill: '#ffffff',
    stroke: '#000000',
    strokeThickness: 2
  }).setOrigin(0.5);
  
  otherPlayers.set(playerData.playerId, {
    sprite,
    text,
    targetX: playerData.x || 400,
    targetY: playerData.y || 300,
    isMoving: false
  });
}

function removeOtherPlayer(playerId) {
  const player = otherPlayers.get(playerId);
  if (player) {
    player.sprite.destroy();
    player.text.destroy();
    otherPlayers.delete(playerId);
  }
}

function smoothMovePlayer(player) {
  const currentX = player.sprite.x;
  const currentY = player.sprite.y;
  const dx = player.targetX - currentX;
  const dy = player.targetY - currentY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance < 2) {
    player.sprite.setPosition(player.targetX, player.targetY);
    player.text.setPosition(player.targetX, player.targetY - 30);
    player.isMoving = false;
    return;
  }
  
  const speed = 0.15;
  const newX = currentX + dx * speed;
  const newY = currentY + dy * speed;
  
  player.sprite.setPosition(newX, newY);
  player.text.setPosition(newX, newY - 30);
  
  requestAnimationFrame(() => smoothMovePlayer(player));
}
