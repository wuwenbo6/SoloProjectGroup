const mqtt = require('mqtt');
const EventEmitter = require('events');

class MQTTService extends EventEmitter {
  constructor() {
    super();
    this.client = null;
    this.simulated = true;
    this.simulationInterval = null;
  }

  connect() {
    if (this.simulated) {
      console.log('Using simulated MQTT data');
      this.startSimulation();
      return;
    }

    this.client = mqtt.connect('mqtt://localhost:1883');
    
    this.client.on('connect', () => {
      console.log('MQTT connected');
      this.client.subscribe('factory/#');
    });

    this.client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const deviceId = topic.split('/')[1];
        this.emit('deviceStatus', { deviceId, ...data, timestamp: new Date() });
      } catch (error) {
        console.error('MQTT message parse error:', error);
      }
    });
  }

  startSimulation() {
    const deviceCount = process.env.SIMULATION_DEVICE_COUNT || 60;
    const devices = [];
    
    const types = ['conveyor', 'robot_arm', 'agv'];
    const typeNames = {
      conveyor: '传送带',
      robot_arm: '机械臂',
      agv: 'AGV小车'
    };

    for (let i = 0; i < deviceCount; i++) {
      const type = types[i % types.length];
      devices.push({
        id: `${type}_${String(Math.floor(i / types.length) + 1).padStart(3, '0')}`,
        type,
        name: `${typeNames[type]}${Math.floor(i / types.length) + 1}`
      });
    }

    console.log(`Simulating ${devices.length} devices...`);

    this.simulationInterval = setInterval(() => {
      devices.forEach((device) => {
        const status = this.generateDeviceStatus(device);
        this.emit('deviceStatus', status);
      });
    }, 500);
  }

  generateDeviceStatus(device) {
    const baseStatus = {
      deviceId: device.id,
      type: device.type,
      name: device.name,
      timestamp: new Date(),
      running: Math.random() > 0.05
    };

    switch (device.type) {
      case 'conveyor':
        return {
          ...baseStatus,
          temperature: 35 + Math.random() * 20,
          speed: baseStatus.running ? 1.5 + Math.random() * 0.5 : 0,
          faultCode: baseStatus.running ? 0 : Math.floor(Math.random() * 3)
        };
      case 'robot_arm':
        return {
          ...baseStatus,
          temperature: 40 + Math.random() * 25,
          rotationSpeed: baseStatus.running ? 30 + Math.random() * 20 : 0,
          faultCode: baseStatus.running ? 0 : Math.floor(Math.random() * 4),
          position: { x: Math.random() * 2, y: Math.random() * 1.5, z: Math.random() * 2 }
        };
      case 'agv':
        return {
          ...baseStatus,
          temperature: 30 + Math.random() * 15,
          battery: 50 + Math.random() * 50,
          speed: baseStatus.running ? 0.5 + Math.random() * 1 : 0,
          faultCode: baseStatus.running ? 0 : Math.floor(Math.random() * 2),
          position: { x: Math.random() * 10, z: Math.random() * 10 }
        };
      default:
        return baseStatus;
    }
  }

  publish(topic, message) {
    if (this.client && this.client.connected) {
      this.client.publish(topic, JSON.stringify(message));
    } else {
      console.log('Simulated MQTT publish:', topic, message);
    }
  }

  disconnect() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }
    if (this.client) {
      this.client.end();
    }
  }
}

module.exports = MQTTService;
