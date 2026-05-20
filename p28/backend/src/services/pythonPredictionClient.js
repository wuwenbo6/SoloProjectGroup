const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

class PythonPredictionClient {
    constructor(options = {}) {
        this.host = options.host || 'localhost';
        this.port = options.port || 50051;
        this.baseUrl = `http://${this.host}:${this.port}`;
        this.pythonProcess = null;
        this.modelReady = false;
        this.readyCheckInterval = null;
        this.pendingRequests = new Map();
        this.pollingInterval = null;
    }

    async startPythonService(autoStart = true) {
        return new Promise((resolve, reject) => {
            if (!autoStart) {
                this.startReadyCheck();
                resolve(true);
                return;
            }

            const scriptPath = path.join(__dirname, '../../ml_service/server.py');
            const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

            console.log(`Starting Python prediction service...`);
            console.log(`Script path: ${scriptPath}`);

            this.pythonProcess = spawn(pythonCmd, [scriptPath], {
                cwd: path.dirname(scriptPath),
                stdio: ['inherit', 'pipe', 'pipe']
            });

            this.pythonProcess.stdout.on('data', (data) => {
                const output = data.toString();
                console.log(`[Python] ${output.trim()}`);
                if (output.includes('Prediction server running')) {
                    this.startReadyCheck();
                    resolve(true);
                }
            });

            this.pythonProcess.stderr.on('data', (data) => {
                const output = data.toString();
                console.error(`[Python ERROR] ${output.trim()}`);
            });

            this.pythonProcess.on('error', (err) => {
                console.error('Failed to start Python service:', err);
                reject(err);
            });

            this.pythonProcess.on('exit', (code) => {
                console.log(`Python service exited with code ${code}`);
                this.modelReady = false;
            });

            setTimeout(() => {
                if (!this.modelReady) {
                    this.startReadyCheck();
                    resolve(true);
                }
            }, 5000);
        });
    }

    startReadyCheck() {
        if (this.readyCheckInterval) return;

        this.readyCheckInterval = setInterval(async () => {
            try {
                const health = await this.getHealth();
                this.modelReady = health.status === 'ready';
                if (this.modelReady) {
                    console.log('✅ Prediction model ready!');
                    clearInterval(this.readyCheckInterval);
                    this.readyCheckInterval = null;
                }
            } catch (e) {
                this.modelReady = false;
            }
        }, 2000);
    }

    async makeRequest(method, path, data = null, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const postData = data ? JSON.stringify(data) : null;

            const options = {
                hostname: this.host,
                port: this.port,
                path: path,
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    ...(postData && { 'Content-Length': Buffer.byteLength(postData) })
                },
                timeout: timeout
            };

            const req = http.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(body);
                        if (res.statusCode >= 400) {
                            reject(new Error(json.error || `HTTP ${res.statusCode}`));
                        } else {
                            resolve(json);
                        }
                    } catch (e) {
                        reject(new Error(`Invalid response: ${body}`));
                    }
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (postData) req.write(postData);
            req.end();
        });
    }

    async getHealth() {
        return this.makeRequest('GET', '/health');
    }

    async getStatus() {
        return this.makeRequest('GET', '/status');
    }

    async predict(deviceId, params, historyData = []) {
        if (!this.modelReady) {
            throw new Error('MODEL_LOADING: Prediction model is still warming up');
        }

        const result = await this.makeRequest('POST', '/predict', {
            device_id: deviceId,
            params: params,
            history_data: historyData
        });

        return result;
    }

    async getPredictionResult(requestId, timeout = 30000) {
        return this.makeRequest('GET', `/result/${requestId}?timeout=${timeout / 1000}`);
    }

    async predictAndWait(deviceId, params, historyData = [], maxWait = 30000) {
        const result = await this.predict(deviceId, params, historyData);

        if (result.status === 'complete') {
            return result.data;
        }

        const requestId = result.request_id;
        const startTime = Date.now();

        while (Date.now() - startTime < maxWait) {
            try {
                const pollResult = await this.getPredictionResult(requestId, 2000);
                if (pollResult.status === 'complete') {
                    return pollResult.data;
                }
            } catch (e) {
                if (e.message.includes('timeout')) continue;
                throw e;
            }
            await new Promise(r => setTimeout(r, 500));
        }

        throw new Error('Prediction timed out');
    }

    stop() {
        if (this.readyCheckInterval) {
            clearInterval(this.readyCheckInterval);
        }
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
        if (this.pythonProcess) {
            this.pythonProcess.kill('SIGTERM');
        }
    }
}

module.exports = PythonPredictionClient;
