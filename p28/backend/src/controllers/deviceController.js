class DeviceController {
  constructor(mqttService, influxDBService) {
    this.mqttService = mqttService;
    this.influxDBService = influxDBService;
    this.devices = new Map();
    this.initializeDevices();
  }

  initializeDevices() {
    const deviceConfigs = [
      { id: 'conveyor_001', type: 'conveyor', name: '主传送带', position: { x: 0, y: 0, z: 0 } },
      { id: 'robot_arm_001', type: 'robot_arm', name: '机械臂A', position: { x: 3, y: 0, z: 0 } },
      { id: 'agv_001', type: 'agv', name: 'AGV小车1', position: { x: 5, y: 0, z: 2 } },
      { id: 'conveyor_002', type: 'conveyor', name: '副传送带', position: { x: 0, y: 0, z: 4 } },
      { id: 'robot_arm_002', type: 'robot_arm', name: '机械臂B', position: { x: 3, y: 0, z: 4 } },
      { id: 'agv_002', type: 'agv', name: 'AGV小车2', position: { x: -3, y: 0, z: 2 } }
    ];

    deviceConfigs.forEach((device) => {
      this.devices.set(device.id, {
        ...device,
        status: { running: true, temperature: 25, faultCode: 0 }
      });
    });
  }

  getAllDevices() {
    return Array.from(this.devices.values());
  }

  getDevice(deviceId) {
    return this.devices.get(deviceId);
  }

  async handleControlCommand(command) {
    const { deviceId, action, params } = command;
    const device = this.devices.get(deviceId);

    if (!device) {
      throw new Error(`Device ${deviceId} not found`);
    }

    console.log(`Control command received: ${action} for ${deviceId}`);

    this.mqttService.publish(`control/${deviceId}`, {
      action,
      params,
      timestamp: new Date()
    });

    if (action === 'start') {
      device.status.running = true;
    } else if (action === 'stop') {
      device.status.running = false;
    }

    return { success: true, deviceId, action };
  }

  async getHistoryData(deviceId, range) {
    return await this.influxDBService.queryHistory(deviceId, range);
  }
}

module.exports = DeviceController;
