const io = require('socket.io-client');
const robot = require('robotjs');
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('wrtc');
const os = require('os');
const readline = require('readline');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const SIGNALING_SERVER = process.env.SIGNALING_SERVER || 'http://localhost:3001';
const HOST_NAME = process.env.HOST_NAME || os.hostname();

console.log('=== WebRTC 被控端 Agent ===');
console.log(`信令服务器: ${SIGNALING_SERVER}`);
console.log(`主机名称: ${HOST_NAME}`);
console.log(`操作系统: ${os.platform()} ${os.release()}`);

const socket = io(SIGNALING_SERVER);

let peerConnection = null;
let dataChannel = null;

socket.on('connect', () => {
  console.log('已连接到信令服务器');
  socket.emit('register-host', {
    name: HOST_NAME,
    os: os.platform()
  });
  console.log('已注册为主机');
});

socket.on('offer', async (data) => {
  console.log('收到来自控制端的Offer');
  const { from, offer } = data;

  peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });

  peerConnection.ondatachannel = (event) => {
    dataChannel = event.channel;
    console.log('DataChannel已建立');

    dataChannel.onmessage = (event) => {
      try {
        const inputEvent = JSON.parse(event.data);
        handleInputEvent(inputEvent);
      } catch (e) {
        console.error('解析事件失败:', e);
      }
    };

    dataChannel.onopen = () => {
      console.log('DataChannel已打开，准备接收输入事件');
    };

    dataChannel.onclose = () => {
      console.log('DataChannel已关闭');
    };
  };

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        targetId: from,
        candidate: event.candidate
      });
    }
  };

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('answer', {
    targetId: from,
    answer: answer
  });
  console.log('已发送Answer');
});

socket.on('ice-candidate', async (data) => {
  const { candidate } = data;
  if (peerConnection && candidate) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }
});

socket.on('clipboard-data', (data) => {
  const { type, content } = data;
  console.log(`收到剪贴板数据: ${type}`);
  setClipboard(type, content);
});

async function setClipboard(type, content) {
  const platform = os.platform();
  
  try {
    if (type === 'text') {
      if (platform === 'win32') {
        const { spawn } = require('child_process');
        const clip = spawn('clip');
        clip.stdin.write(content);
        clip.stdin.end();
      } else if (platform === 'darwin') {
        const { spawn } = require('child_process');
        const pbcopy = spawn('pbcopy');
        pbcopy.stdin.write(content);
        pbcopy.stdin.end();
      } else {
        const { spawn } = require('child_process');
        const xclip = spawn('xclip', ['-selection', 'clipboard']);
        xclip.stdin.write(content);
        xclip.stdin.end();
      }
      console.log('文本已复制到剪贴板');
    } else if (type === 'image') {
      const tempPath = path.join(os.tmpdir(), `clipboard_${Date.now()}.png`);
      const base64Data = content.replace(/^data:image\/png;base64,/, '');
      fs.writeFileSync(tempPath, base64Data, 'base64');
      
      if (platform === 'darwin') {
        exec(`osascript -e 'set the clipboard to (read (POSIX file "${tempPath}") as TIFF picture)'`);
      } else if (platform === 'win32') {
        exec(`powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetImage([System.Drawing.Image]::FromFile('${tempPath}'))"`);
      }
      console.log('图片已复制到剪贴板');
    }
  } catch (error) {
    console.error('设置剪贴板失败:', error);
  }
}

function handleInputEvent(event) {
  try {
    switch (event.type) {
      case 'mousemove':
        robot.moveMouse(event.x, event.y);
        break;
      case 'mousedown':
        robot.mouseToggle('down', event.button);
        break;
      case 'mouseup':
        robot.mouseToggle('up', event.button);
        break;
      case 'click':
        robot.mouseClick(event.button, event.double);
        break;
      case 'scroll':
        robot.scrollMouse(event.dx, event.dy);
        break;
      case 'keydown':
        robot.keyToggle(event.key, 'down');
        break;
      case 'keyup':
        robot.keyToggle(event.key, 'up');
        break;
      case 'type':
        robot.typeString(event.text);
        break;
    }
  } catch (error) {
    console.error('处理输入事件失败:', error);
  }
}

socket.on('disconnect', () => {
  console.log('与信令服务器断开连接');
  if (dataChannel) {
    dataChannel.close();
  }
  if (peerConnection) {
    peerConnection.close();
  }
});

socket.on('connect_error', (error) => {
  console.error('连接错误:', error.message);
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('SIGINT', () => {
  console.log('\n正在关闭...');
  if (dataChannel) dataChannel.close();
  if (peerConnection) peerConnection.close();
  socket.disconnect();
  process.exit(0);
});

console.log('Agent启动完成，等待控制端连接...');
