const EventEmitter = require('events');

class AccessControl extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this.deletedCardIds = new Set();
    this.lastCleanup = Date.now();
    this.doorState = new Map();
    this.doorLockTimer = new Map();
    this.DOOR_OPEN_DURATION = 5000;
  }

  cleanupDeletedCards() {
    const now = Date.now();
    if (now - this.lastCleanup > 300000) {
      this.deletedCardIds.clear();
      this.lastCleanup = now;
    }
  }

  async verifyCard(cardData, doorId = 1) {
    const { uid, cardType, keyA, keyB } = cardData;

    this.cleanupDeletedCards();

    if (this.deletedCardIds.has(uid)) {
      this.db.addLog({
        card_uid: uid,
        card_type: cardType,
        holder_name: null,
        access_result: 'DENIED',
        door_id: doorId,
        reason: '卡片已删除'
      });
      return {
        granted: false,
        reason: '卡片已删除',
        cardData,
        doorId
      };
    }

    const scheduleCheck = this.db.canAccessNow();
    if (!scheduleCheck.allowed) {
      this.db.addLog({
        card_uid: uid,
        card_type: cardType,
        holder_name: null,
        access_result: 'DENIED',
        door_id: doorId,
        reason: scheduleCheck.reason
      });
      return {
        granted: false,
        reason: scheduleCheck.reason,
        cardData,
        doorId
      };
    }

    const interlockCheck = this.checkInterlock(doorId);
    if (!interlockCheck.allowed) {
      this.db.addLog({
        card_uid: uid,
        card_type: cardType,
        holder_name: null,
        access_result: 'DENIED',
        door_id: doorId,
        reason: interlockCheck.reason
      });
      return {
        granted: false,
        reason: interlockCheck.reason,
        cardData,
        doorId
      };
    }

    const card = this.db.getCardByUid(uid);

    if (!card) {
      this.db.addLog({
        card_uid: uid,
        card_type: cardType,
        holder_name: null,
        access_result: 'DENIED',
        door_id: doorId,
        reason: '未授权的卡片'
      });
      return {
        granted: false,
        reason: '未授权的卡片',
        cardData,
        doorId
      };
    }

    if (!card.is_active) {
      this.db.addLog({
        card_uid: uid,
        card_type: cardType,
        holder_name: card.holder_name,
        access_result: 'DENIED',
        door_id: doorId,
        reason: '卡片已被禁用'
      });
      return {
        granted: false,
        reason: '卡片已被禁用',
        cardData,
        doorId,
        holderName: card.holder_name
      };
    }

    const keyValid = this.verifyKeys(card, keyA, keyB);
    if (!keyValid) {
      this.db.addLog({
        card_uid: uid,
        card_type: cardType,
        holder_name: card.holder_name,
        access_result: 'DENIED',
        door_id: doorId,
        reason: '密钥验证失败'
      });
      return {
        granted: false,
        reason: '密钥验证失败',
        cardData,
        doorId,
        holderName: card.holder_name
      };
    }

    this.openDoor(doorId);

    this.db.addLog({
      card_uid: uid,
      card_type: cardType,
      holder_name: card.holder_name,
      access_result: 'GRANTED',
      door_id: doorId,
      reason: '验证通过'
    });

    return {
      granted: true,
      reason: '验证通过',
      cardData,
      doorId,
      holderName: card.holder_name
    };
  }

  verifyKeys(storedCard, providedKeyA, providedKeyB) {
    if (storedCard.card_type === 'MIFARE_CLASSIC') {
      if (storedCard.key_a && providedKeyA) {
        return storedCard.key_a.toUpperCase() === providedKeyA.toUpperCase();
      }
      return true;
    } else if (storedCard.card_type === 'DESFIRE') {
      if (storedCard.key_a && providedKeyA) {
        return storedCard.key_a.toUpperCase() === providedKeyA.toUpperCase();
      }
      return true;
    }
    return true;
  }

  checkInterlock(doorId) {
    const interlockedDoors = this.db.getInterlockedDoors(doorId);
    
    for (const interlock of interlockedDoors) {
      if (this.doorState.get(interlock.door_id) === 'OPEN') {
        const door = this.db.getDoorById(interlock.door_id);
        return {
          allowed: false,
          reason: `${door?.name || '另一扇门'}已开启，请先关闭`
        };
      }
    }
    
    return { allowed: true };
  }

  openDoor(doorId) {
    this.doorState.set(doorId, 'OPEN');
    this.db.updateDoorStatus(doorId, 'OPEN');
    this.emit('door-opened', { doorId });

    if (this.doorLockTimer.has(doorId)) {
      clearTimeout(this.doorLockTimer.get(doorId));
    }

    this.doorLockTimer.set(doorId, setTimeout(() => {
      this.lockDoor(doorId);
    }, this.DOOR_OPEN_DURATION));
  }

  lockDoor(doorId) {
    this.doorState.set(doorId, 'LOCKED');
    this.db.updateDoorStatus(doorId, 'LOCKED');
    this.emit('door-locked', { doorId });
    this.doorLockTimer.delete(doorId);
  }

  getDoorState(doorId) {
    return this.doorState.get(doorId) || 'LOCKED';
  }

  getAllDoorStates() {
    const doors = this.db.getAllDoors();
    return doors.map(door => ({
      ...door,
      current_state: this.doorState.get(door.id) || 'LOCKED'
    }));
  }

  async addCard(cardData) {
    try {
      return this.db.addCard(cardData);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        throw new Error('该UID的卡片已存在');
      }
      throw error;
    }
  }

  async removeCard(id) {
    const allCards = this.db.getAllCards();
    const cardToDelete = allCards.find(c => c.id === id);
    
    if (cardToDelete) {
      this.deletedCardIds.add(cardToDelete.uid);
    }
    
    const result = this.db.deleteCard(id);
    
    if (result) {
      this.emit('card-removed', { id, uid: cardToDelete?.uid });
    }
    
    return result;
  }

  async getAllCards() {
    return this.db.getAllCards();
  }

  async getAccessLogs(limit = 100) {
    return this.db.getLogs(limit);
  }

  addSchedule(schedule) {
    return this.db.addSchedule(schedule);
  }

  updateSchedule(id, schedule) {
    return this.db.updateSchedule(id, schedule);
  }

  deleteSchedule(id) {
    return this.db.deleteSchedule(id);
  }

  getAllSchedules() {
    return this.db.getAllSchedules();
  }

  addHoliday(holiday) {
    return this.db.addHoliday(holiday);
  }

  deleteHoliday(id) {
    return this.db.deleteHoliday(id);
  }

  getAllHolidays() {
    return this.db.getAllHolidays();
  }

  addDoor(door) {
    return this.db.addDoor(door);
  }

  deleteDoor(id) {
    return this.db.deleteDoor(id);
  }

  getAllDoors() {
    return this.getAllDoorStates();
  }

  addInterlock(interlock) {
    return this.db.addInterlock(interlock);
  }

  deleteInterlock(id) {
    return this.db.deleteInterlock(id);
  }

  getAllInterlocks() {
    return this.db.getAllInterlocks();
  }

  exportLogsToExcel(limit = 1000) {
    return this.db.exportLogsToExcel(limit);
  }
}

module.exports = AccessControl;
