const { ipcRenderer } = require('electron');
const socket = io();

let isElectron = typeof ipcRenderer !== 'undefined';

class AccessControlApp {
  constructor() {
    this.initElements();
    this.initEventListeners();
    this.initSocketListeners();
    this.loadData();
  }

  initElements() {
    this.readerStatusText = document.getElementById('readerStatusText');
    this.readerIcon = document.getElementById('readerIcon');
    this.cardInfo = document.getElementById('cardInfo');
    this.cardUid = document.getElementById('cardUid');
    this.cardType = document.getElementById('cardType');
    this.cardHolder = document.getElementById('cardHolder');
    this.accessResult = document.getElementById('accessResult');
    this.resultIcon = document.getElementById('resultIcon');
    this.resultText = document.getElementById('resultText');
    
    this.simulateDoor = document.getElementById('simulateDoor');
    this.simulateUid = document.getElementById('simulateUid');
    this.simulateType = document.getElementById('simulateType');
    this.simulateKeyA = document.getElementById('simulateKeyA');
    this.simulateBtn = document.getElementById('simulateBtn');
    
    this.newCardUid = document.getElementById('newCardUid');
    this.newCardType = document.getElementById('newCardType');
    this.newCardHolder = document.getElementById('newCardHolder');
    this.newCardKeyA = document.getElementById('newCardKeyA');
    this.addCardBtn = document.getElementById('addCardBtn');
    
    this.cardsTableBody = document.getElementById('cardsTableBody');
    this.logsTableBody = document.getElementById('logsTableBody');
    this.doorsList = document.getElementById('doorsList');
    
    this.totalCards = document.getElementById('totalCards');
    this.activeCards = document.getElementById('activeCards');
    this.todayAccesses = document.getElementById('todayAccesses');
    this.totalAccesses = document.getElementById('totalAccesses');
    
    this.exportExcelBtn = document.getElementById('exportExcelBtn');
    
    this.newScheduleName = document.getElementById('newScheduleName');
    this.newScheduleDesc = document.getElementById('newScheduleDesc');
    this.newScheduleStart = document.getElementById('newScheduleStart');
    this.newScheduleEnd = document.getElementById('newScheduleEnd');
    this.addScheduleBtn = document.getElementById('addScheduleBtn');
    this.schedulesTableBody = document.getElementById('schedulesTableBody');
    
    this.newHolidayDate = document.getElementById('newHolidayDate');
    this.newHolidayName = document.getElementById('newHolidayName');
    this.addHolidayBtn = document.getElementById('addHolidayBtn');
    this.holidaysTableBody = document.getElementById('holidaysTableBody');
    
    this.newDoorName = document.getElementById('newDoorName');
    this.newDoorDesc = document.getElementById('newDoorDesc');
    this.addDoorBtn = document.getElementById('addDoorBtn');
    
    this.interlockDoor1 = document.getElementById('interlockDoor1');
    this.interlockDoor2 = document.getElementById('interlockDoor2');
    this.addInterlockBtn = document.getElementById('addInterlockBtn');
    this.interlocksTableBody = document.getElementById('interlocksTableBody');
    
    this.notification = document.getElementById('notification');
    this.notificationIcon = document.getElementById('notificationIcon');
    this.notificationMessage = document.getElementById('notificationMessage');
  }

  initEventListeners() {
    this.simulateBtn.addEventListener('click', () => this.handleSimulate());
    this.addCardBtn.addEventListener('click', () => this.handleAddCard());
    this.exportExcelBtn.addEventListener('click', () => this.handleExportExcel());
    this.addScheduleBtn.addEventListener('click', () => this.handleAddSchedule());
    this.addHolidayBtn.addEventListener('click', () => this.handleAddHoliday());
    this.addDoorBtn.addEventListener('click', () => this.handleAddDoor());
    this.addInterlockBtn.addEventListener('click', () => this.handleAddInterlock());
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
    });
  }

  initSocketListeners() {
    socket.on('card-detected', (cardData) => {
      this.showCardInfo(cardData);
    });
    
    socket.on('access-granted', (data) => {
      this.showAccessResult(true, data);
      this.showNotification(true, data);
      this.loadLogs();
      this.loadStats();
      this.loadDoors();
    });
    
    socket.on('access-denied', (data) => {
      this.showAccessResult(false, data);
      this.showNotification(false, data);
      this.loadLogs();
      this.loadStats();
    });
    
    socket.on('card-added', () => {
      this.loadCards();
      this.loadStats();
    });
    
    socket.on('card-deleted', () => {
      this.loadCards();
      this.loadStats();
    });
    
    socket.on('door-state-changed', () => {
      this.loadDoors();
    });

    if (isElectron) {
      ipcRenderer.on('card-detected', (event, cardData) => {
        this.showCardInfo(cardData);
      });
      
      ipcRenderer.on('access-granted', (event, data) => {
        this.showAccessResult(true, data);
        this.showNotification(true, data);
        this.loadLogs();
        this.loadStats();
        this.loadDoors();
      });
      
      ipcRenderer.on('access-denied', (event, data) => {
        this.showAccessResult(false, data);
        this.showNotification(false, data);
        this.loadLogs();
        this.loadStats();
      });
    }
  }

  async loadData() {
    this.loadCards();
    this.loadLogs();
    this.loadStats();
    this.loadDoors();
    this.loadSchedules();
    this.loadHolidays();
    this.loadInterlocks();
  }

  async loadCards() {
    try {
      let cards;
      if (isElectron) {
        cards = await ipcRenderer.invoke('get-cards');
      } else {
        const response = await fetch('/api/cards');
        const result = await response.json();
        cards = result.data;
      }
      
      this.renderCardsTable(cards);
    } catch (error) {
      console.error('加载卡片失败:', error);
    }
  }

  renderCardsTable(cards) {
    this.cardsTableBody.innerHTML = cards.map(card => `
      <tr>
        <td><span class="uid-text">${card.uid}</span></td>
        <td><span class="card-type">${card.card_type.replace('_', ' ')}</span></td>
        <td>${card.holder_name || '-'}</td>
        <td>
          <span class="status-badge ${card.is_active ? 'active' : 'inactive'}">
            ${card.is_active ? '激活' : '禁用'}
          </span>
        </td>
        <td>
          <button class="btn btn-danger" onclick="app.deleteCard(${card.id})">删除</button>
        </td>
      </tr>
    `).join('');
  }

  async loadLogs() {
    try {
      let logs;
      if (isElectron) {
        logs = await ipcRenderer.invoke('get-logs');
      } else {
        const response = await fetch('/api/logs');
        const result = await response.json();
        logs = result.data;
      }
      
      this.renderLogsTable(logs);
    } catch (error) {
      console.error('加载记录失败:', error);
    }
  }

  renderLogsTable(logs) {
    this.logsTableBody.innerHTML = logs.map(log => `
      <tr>
        <td>${this.formatDate(log.timestamp)}</td>
        <td><span class="uid-text">${log.card_uid}</span></td>
        <td>${log.holder_name || '-'}</td>
        <td>${log.door_id || '-'}</td>
        <td>
          <span class="status-badge ${log.access_result === 'GRANTED' ? 'granted' : 'denied'}">
            ${log.access_result === 'GRANTED' ? '允许' : '拒绝'}
          </span>
        </td>
        <td>${log.reason || '-'}</td>
      </tr>
    `).join('');
  }

  async loadStats() {
    try {
      const response = await fetch('/api/stats');
      const result = await response.json();
      const stats = result.data;
      
      this.totalCards.textContent = stats.totalCards;
      this.activeCards.textContent = stats.activeCards;
      this.todayAccesses.textContent = stats.todayAccesses;
      this.totalAccesses.textContent = stats.totalAccesses;
    } catch (error) {
      console.error('加载统计失败:', error);
    }
  }

  async loadDoors() {
    try {
      const response = await fetch('/api/doors');
      const result = await response.json();
      const doors = result.data;
      
      this.renderDoorsList(doors);
      this.renderDoorSelects(doors);
    } catch (error) {
      console.error('加载门状态失败:', error);
    }
  }

  renderDoorsList(doors) {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    this.doorsList.innerHTML = doors.map(door => `
      <div class="door-item">
        <div class="door-name">${door.name}</div>
        <div class="door-status">
          <span class="status-dot ${door.current_state === 'OPEN' ? 'open' : 'locked'}"></span>
          <span>${door.current_state === 'OPEN' ? '已开启' : '已锁定'}</span>
        </div>
      </div>
    `).join('');
  }

  renderDoorSelects(doors) {
    const options = doors.map(door => `<option value="${door.id}">${door.name}</option>`).join('');
    this.interlockDoor1.innerHTML = options;
    this.interlockDoor2.innerHTML = options;
  }

  async loadSchedules() {
    try {
      const response = await fetch('/api/schedules');
      const result = await response.json();
      const schedules = result.data;
      
      this.renderSchedulesTable(schedules);
    } catch (error) {
      console.error('加载时段失败:', error);
    }
  }

  renderSchedulesTable(schedules) {
    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];
    this.schedulesTableBody.innerHTML = schedules.map(schedule => {
      const days = schedule.days.split(',').map(d => dayNames[parseInt(d)]).join(',');
      return `
        <tr>
          <td>${schedule.name}</td>
          <td>${schedule.start_time} - ${schedule.end_time}</td>
          <td>${days}</td>
          <td>
            <span class="status-badge ${schedule.is_active ? 'active' : 'inactive'}">
              ${schedule.is_active ? '启用' : '禁用'}
            </span>
          </td>
          <td>
            <button class="btn btn-danger" onclick="app.deleteSchedule(${schedule.id})">删除</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  async loadHolidays() {
    try {
      const response = await fetch('/api/holidays');
      const result = await response.json();
      const holidays = result.data;
      
      this.renderHolidaysTable(holidays);
    } catch (error) {
      console.error('加载节假日失败:', error);
    }
  }

  renderHolidaysTable(holidays) {
    this.holidaysTableBody.innerHTML = holidays.map(holiday => `
      <tr>
        <td>${holiday.date}</td>
        <td>${holiday.name || '-'}</td>
        <td>
          <button class="btn btn-danger" onclick="app.deleteHoliday(${holiday.id})">删除</button>
        </td>
      </tr>
    `).join('');
  }

  async loadInterlocks() {
    try {
      const response = await fetch('/api/interlocks');
      const result = await response.json();
      const interlocks = result.data;
      
      this.renderInterlocksTable(interlocks);
    } catch (error) {
      console.error('加载互锁规则失败:', error);
    }
  }

  renderInterlocksTable(interlocks) {
    this.interlocksTableBody.innerHTML = interlocks.map(interlock => `
      <tr>
        <td>${interlock.door_name_1}</td>
        <td>${interlock.door_name_2}</td>
        <td>
          <button class="btn btn-danger" onclick="app.deleteInterlock(${interlock.id})">删除</button>
        </td>
      </tr>
    `).join('');
  }

  showCardInfo(cardData) {
    this.readerStatusText.textContent = '检测到卡片';
    this.readerIcon.textContent = '💳';
    this.cardUid.textContent = cardData.uid || cardData.cardData?.uid || '-';
    this.cardType.textContent = (cardData.cardType || cardData.cardData?.cardType || 'UNKNOWN').replace('_', ' ');
    this.cardHolder.textContent = cardData.holderName || '-';
    this.cardInfo.style.display = 'block';
  }

  showAccessResult(granted, data) {
    this.accessResult.style.display = 'block';
    this.accessResult.className = `access-result ${granted ? 'granted' : 'denied'};
    this.resultIcon.textContent = granted ? '✅' : '❌';
    this.resultText.textContent = granted ? '门禁已开启 - ' + (data.holderName || '授权用户') : '访问被拒绝 - ' + (data.reason || '未知原因');
    
    setTimeout(() => {
      this.resetReaderStatus();
    }, 4000);
  }

  showNotification(granted, data) {
    this.notification.className = `notification ${granted ? 'granted' : 'denied'} show`;
    this.notificationIcon.textContent = granted ? '✅' : '❌';
    this.notificationMessage.textContent = granted 
      ? `${data.holderName || '用户'} - 门禁已开启`
      : `访问被拒绝: ${data.reason || '未知原因'}`;
    
    setTimeout(() => {
      this.notification.classList.remove('show');
    }, 3000);
  }

  resetReaderStatus() {
    this.readerStatusText.textContent = '等待卡片...';
    this.readerIcon.textContent = '📡';
    this.cardInfo.style.display = 'none';
    this.accessResult.style.display = 'none';
  }

  async handleSimulate() {
    const cardData = {
      uid: this.simulateUid.value.toUpperCase(),
      cardType: this.simulateType.value,
      keyA: this.simulateKeyA.value.toUpperCase(),
      doorId: parseInt(this.simulateDoor.value)
    };

    this.showCardInfo({ cardData });

    if (isElectron) {
      await ipcRenderer.invoke('simulate-card', cardData);
    } else {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });
    }
  }

  async handleAddCard() {
    const uid = this.newCardUid.value.trim().toUpperCase();
    const cardType = this.newCardType.value;
    const holderName = this.newCardHolder.value.trim();
    const keyA = this.newCardKeyA.value.trim().toUpperCase();

    if (!uid) {
      alert('请输入卡片UID');
      return;
    }

    try {
      if (isElectron) {
        await ipcRenderer.invoke('add-card', {
          uid,
          card_type: cardType,
          holder_name: holderName,
          key_a: keyA,
          key_b: ''
        });
      } else {
        await fetch('/api/cards', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid,
            card_type: cardType,
            holder_name: holderName,
            key_a: keyA,
            key_b: ''
          })
        });
      }

      this.newCardUid.value = '';
      this.newCardHolder.value = '';
      this.loadCards();
      alert('卡片添加成功');
    } catch (error) {
      alert('添加失败: ' + error.message);
    }
  }

  async deleteCard(id) {
    if (!confirm('确定要删除此卡片吗？')) return;

    try {
      if (isElectron) {
        await ipcRenderer.invoke('delete-card', id);
      } else {
        await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      }
      this.loadCards();
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  async handleExportExcel() {
    try {
      const response = await fetch('/api/logs/export');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `access_logs_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('导出失败: ' + error.message);
    }
  }

  async handleAddSchedule() {
    const name = this.newScheduleName.value.trim();
    const description = this.newScheduleDesc.value.trim();
    const startTime = this.newScheduleStart.value;
    const endTime = this.newScheduleEnd.value;
    
    const checkedDays = Array.from(document.querySelectorAll('input[name="day"]:checked'))
      .map(cb => cb.value);
    
    if (!name || !startTime || !endTime || checkedDays.length === 0) {
      alert('请填写完整的时段信息');
      return;
    }

    try {
      await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          start_time: startTime,
          end_time: endTime,
          days: checkedDays.join(',')
        })
      });

      this.newScheduleName.value = '';
      this.newScheduleDesc.value = '';
      this.loadSchedules();
      alert('时段添加成功');
    } catch (error) {
      alert('添加失败: ' + error.message);
    }
  }

  async deleteSchedule(id) {
    if (!confirm('确定要删除此时段吗？')) return;

    try {
      await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
      this.loadSchedules();
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  async handleAddHoliday() {
    const date = this.newHolidayDate.value;
    const name = this.newHolidayName.value.trim();

    if (!date) {
      alert('请选择日期');
      return;
    }

    try {
      await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name })
      });

      this.newHolidayDate.value = '';
      this.newHolidayName.value = '';
      this.loadHolidays();
      alert('节假日添加成功');
    } catch (error) {
      alert('添加失败: ' + error.message);
    }
  }

  async deleteHoliday(id) {
    if (!confirm('确定要删除此节假日吗？')) return;

    try {
      await fetch(`/api/holidays/${id}`, { method: 'DELETE' });
      this.loadHolidays();
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  async handleAddDoor() {
    const name = this.newDoorName.value.trim();
    const description = this.newDoorDesc.value.trim();

    if (!name) {
      alert('请输入门名称');
      return;
    }

    try {
      await fetch('/api/doors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      this.newDoorName.value = '';
      this.newDoorDesc.value = '';
      this.loadDoors();
      alert('门添加成功');
    } catch (error) {
      alert('添加失败: ' + error.message);
    }
  }

  async handleAddInterlock() {
    const doorId1 = parseInt(this.interlockDoor1.value);
    const doorId2 = parseInt(this.interlockDoor2.value);

    if (doorId1 === doorId2) {
      alert('不能选择相同的门');
      return;
    }

    try {
      await fetch('/api/interlocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ door_id_1: doorId1, door_id_2: doorId2 })
      });

      this.loadInterlocks();
      alert('互锁规则添加成功');
    } catch (error) {
      alert('添加失败: ' + error.message);
    }
  }

  async deleteInterlock(id) {
    if (!confirm('确定要删除此互锁规则吗？')) return;

    try {
      await fetch(`/api/interlocks/${id}`, { method: 'DELETE' });
      this.loadInterlocks();
    } catch (error) {
      alert('删除失败: ' + error.message);
    }
  }

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
  }

  formatDate(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }
}

const app = new AccessControlApp();
