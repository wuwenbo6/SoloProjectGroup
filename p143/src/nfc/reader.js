const EventEmitter = require('events');
const pcsclite = require('@pokusew/pcsclite');

const CARD_TYPES = {
  MIFARE_CLASSIC: 'MIFARE_CLASSIC',
  DESFIRE: 'DESFIRE',
  UNKNOWN: 'UNKNOWN'
};

const CONFIG = {
  MAX_RETRIES: 5,
  RETRY_DELAY: 100,
  AUTH_TIMEOUT: 1000,
  DEFAULT_KEY: 'FFFFFFFFFFFF'
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class NFCReader extends EventEmitter {
  constructor(accessControl) {
    super();
    this.accessControl = accessControl;
    this.pcsc = null;
    this.readers = new Map();
    this.isRunning = false;
    this.useSimulation = false;
    this.processingCards = new Set();
  }

  start() {
    try {
      this.pcsc = pcsclite();
      this.isRunning = true;

      this.pcsc.on('reader', (reader) => {
        console.log(`读卡器已连接: ${reader.name}`);
        this.readers.set(reader.name, reader);

        reader.on('status', (status) => {
          const changes = reader.state ^ status.state;
          if (changes) {
            if ((changes & reader.SCARD_STATE_EMPTY) && (status.state & reader.SCARD_STATE_EMPTY)) {
              console.log('卡片已移除');
              reader.disconnect(reader.SCARD_LEAVE_CARD, (err) => {
                if (err) console.error('断开连接错误:', err);
              });
            } else if ((changes & reader.SCARD_STATE_PRESENT) && (status.state & reader.SCARD_STATE_PRESENT)) {
              console.log('检测到卡片');
              this.handleCardDetection(reader);
            }
          }
        });

        reader.on('error', (err) => {
          console.error(`读卡器错误 (${reader.name}):`, err);
        });

        reader.on('end', () => {
          console.log(`读卡器已断开: ${reader.name}`);
          this.readers.delete(reader.name);
        });
      });

      this.pcsc.on('error', (err) => {
        console.error('PC/SC错误:', err);
        console.log('切换到模拟模式...');
        this.useSimulation = true;
      });

    } catch (error) {
      console.error('初始化PC/SC失败，切换到模拟模式:', error);
      this.useSimulation = true;
      this.isRunning = true;
    }
  }

  stop() {
    this.isRunning = false;
    if (this.pcsc) {
      this.pcsc.close();
    }
    this.readers.forEach(reader => reader.close());
    this.readers.clear();
  }

  async handleCardDetection(reader) {
    for (let attempt = 1; attempt <= CONFIG.MAX_RETRIES; attempt++) {
      try {
        const cardData = await this.readCardDataWithRetry(reader, attempt);
        
        if (cardData.uid && cardData.uid !== 'UNKNOWN' && !this.processingCards.has(cardData.uid)) {
          this.processingCards.add(cardData.uid);
          
          this.emit('card-detected', cardData);

          const result = await this.accessControl.verifyCard(cardData);
          
          if (result.granted) {
            this.emit('access-granted', result);
          } else {
            this.emit('access-denied', result);
          }

          setTimeout(() => {
            this.processingCards.delete(cardData.uid);
          }, 1000);
          
          return;
        }
      } catch (error) {
        console.warn(`卡片读取尝试 ${attempt}/${CONFIG.MAX_RETRIES} 失败:`, error.message);
        if (attempt < CONFIG.MAX_RETRIES) {
          await delay(CONFIG.RETRY_DELAY * attempt);
        } else {
          console.error('卡片读取最终失败:', error);
        }
      }
    }
  }

  async readCardDataWithRetry(reader, attempt) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('读卡器操作超时'));
      }, CONFIG.AUTH_TIMEOUT);

      reader.connect({ share_mode: reader.SCARD_SHARE_SHARED }, async (err, protocol) => {
        if (err) {
          clearTimeout(timeout);
          return reject(err);
        }

        try {
          const uid = await this.performAntiCollisionAndReadUid(reader, protocol);
          const cardType = this.detectCardType(null, reader);
          
          let keyA = CONFIG.DEFAULT_KEY;
          let authenticated = false;
          
          if (cardType === CARD_TYPES.MIFARE_CLASSIC) {
            const authResult = await this.authenticateMifare(reader, protocol, uid);
            authenticated = authResult.success;
            keyA = authResult.keyA;
          }

          clearTimeout(timeout);
          resolve({
            uid,
            cardType,
            readerName: reader.name,
            keyA,
            keyB: CONFIG.DEFAULT_KEY,
            authenticated,
            attempt
          });
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }

  performAntiCollisionAndReadUid(reader, protocol) {
    return new Promise((resolve, reject) => {
      const getUidCommand = Buffer.from([0xFF, 0xCA, 0x00, 0x00, 0x00]);
      
      reader.transmit(getUidCommand, 255, protocol, (err, response) => {
        if (err) {
          return reject(err);
        }

        const uid = this.parseUid(response);
        resolve(uid);
      });
    });
  }

  authenticateMifare(reader, protocol, uid) {
    return new Promise(async (resolve) => {
      const keysToTry = [
        'FFFFFFFFFFFF',
        'A0A1A2A3A4A5',
        'D3F7D3F7D3F7',
        '000000000000'
      ];

      for (const key of keysToTry) {
        try {
          const keyBytes = Buffer.from(key, 'hex');
          const authCommand = Buffer.from([
            0xFF,
            0x86,
            0x00,
            0x00,
            0x05,
            0x01,
            0x00,
            0x04,
            0x60,
            0x00
          ]);
          
          const loadKeyCommand = Buffer.from([
            0xFF,
            0x82,
            0x00,
            0x00,
            0x06,
            ...keyBytes
          ]);

          await new Promise((res, rej) => {
            reader.transmit(loadKeyCommand, 255, protocol, (err) => {
              if (err) rej(err);
              else res();
            });
          });

          await new Promise((res, rej) => {
            reader.transmit(authCommand, 255, protocol, (err) => {
              if (err) rej(err);
              else res();
            });
          });

          resolve({ success: true, keyA: key });
          return;
        } catch (error) {
          continue;
        }
      }

      resolve({ success: false, keyA: CONFIG.DEFAULT_KEY });
    });
  }

  parseUid(response) {
    if (!response || response.length < 2) {
      return 'UNKNOWN';
    }
    
    const uidBytes = response.slice(0, -2);
    return uidBytes.toString('hex').toUpperCase();
  }

  detectCardType(response, reader) {
    const atr = reader.atr || [];
    
    if (atr.length >= 13 && atr[12] === 0x01) {
      return CARD_TYPES.MIFARE_CLASSIC;
    }
    
    if (atr.length >= 7 && atr[6] === 0x04) {
      return CARD_TYPES.DESFIRE;
    }

    if (atr.length > 0) {
      const atrString = Buffer.from(atr).toString('hex').toUpperCase();
      if (atrString.includes('3B8F8001804F0CA000000306')) {
        return CARD_TYPES.MIFARE_CLASSIC;
      }
      if (atrString.includes('3B8180018080')) {
        return CARD_TYPES.DESFIRE;
      }
    }

    return CARD_TYPES.MIFARE_CLASSIC;
  }

  simulateCard(cardData) {
    if (!this.isRunning) return;

    const defaultCard = {
      uid: 'AABBCCDD',
      cardType: CARD_TYPES.MIFARE_CLASSIC,
      readerName: 'Simulated Reader',
      keyA: 'FFFFFFFFFFFF',
      keyB: 'FFFFFFFFFFFF',
      ...cardData
    };

    this.emit('card-detected', defaultCard);
    
    setTimeout(async () => {
      const result = await this.accessControl.verifyCard(defaultCard);
      if (result.granted) {
        this.emit('access-granted', result);
      } else {
        this.emit('access-denied', result);
      }
    }, 500);
  }
}

module.exports = NFCReader;
