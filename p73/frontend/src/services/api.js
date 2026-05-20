import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
	baseURL: API_BASE_URL,
	timeout: 10000,
});

export const apiService = {
	getSettings: async () => {
		try {
			const response = await api.get('/settings');
			return response.data;
		} catch (error) {
			return {
				tempMin: 20,
				tempMax: 35,
				humidityMin: 40,
				humidityMax: 70,
				microbeMin: 1000,
				microbeMax: 1000000,
				sampleInterval: 5000,
			};
		}
	},

	updateSettings: async (settings) => {
		const response = await api.put('/settings', settings);
		return response.data;
	},

	getFermenters: async () => {
		try {
			const response = await api.get('/fermenters');
			return response.data;
		} catch (error) {
			return [
				{ id: 1, name: '发酵罐 #1', status: 'running', location: 'A区' },
				{ id: 2, name: '发酵罐 #2', status: 'running', location: 'A区' },
				{ id: 3, name: '发酵罐 #3', status: 'idle', location: 'B区' },
			];
		}
	},

	getCurrentData: async (fermenterId) => {
		try {
			const response = await api.get(`/data/current/${fermenterId}`);
			return response.data;
		} catch (error) {
			const now = new Date().toISOString();
			return {
				fermenterId,
				temperature: 25 + Math.random() * 5,
				humidity: 55 + Math.random() * 10,
				microbeConcentration: 100000 + Math.random() * 500000,
				timestamp: now,
				status: 'normal',
			};
		}
	},

	getHistoryData: async (fermenterId, hours = 24) => {
		try {
			const response = await api.get(`/data/history/${fermenterId}?hours=${hours}`);
			return response.data;
		} catch (error) {
			const data = [];
			const now = Date.now();
			for (let i = hours * 12; i >= 0; i--) {
				const time = new Date(now - i * 5 * 60 * 1000);
				data.push({
					timestamp: time.toISOString(),
					temperature: 25 + Math.sin(i / 10) * 3 + Math.random() * 2,
					humidity: 55 + Math.cos(i / 15) * 5 + Math.random() * 3,
					microbeConcentration: 100000 + i * 5000 + Math.random() * 50000,
				});
			}
			return data;
		}
	},

	getAlerts: async (limit = 50) => {
		try {
			const response = await api.get(`/alerts?limit=${limit}`);
			return response.data;
		} catch (error) {
			return [
				{ id: 1, type: 'warning', message: '温度接近上限', fermenterId: 1, timestamp: new Date().toISOString() },
				{ id: 2, type: 'info', message: '发酵罐 #2 启动', fermenterId: 2, timestamp: new Date(Date.now() - 3600000).toISOString() },
			];
		}
	},

	getAnalysis: async (fermenterId) => {
		try {
			const response = await api.get(`/analysis/${fermenterId}`);
			return response.data;
		} catch (error) {
			return {
				temperatureTrend: 'stable',
				humidityTrend: 'rising',
				microbeTrend: 'growing',
				estimatedCompletion: 72,
				healthScore: 85,
				recommendations: ['温度保持稳定，继续监控', '微生物生长正常'],
				autoAdjustments: [],
				faultDiagnosis: [],
			};
		}
	},

	getAdjustmentRecords: async (fermenterId, limit = 20) => {
		try {
			const params = new URLSearchParams();
			if (fermenterId) params.append('fermenterId', fermenterId);
			if (limit) params.append('limit', limit);
			const response = await api.get(`/adjustments?${params.toString()}`);
			return response.data;
		} catch (error) {
			return [];
		}
	},

	getFaultDiagnosis: async (fermenterId) => {
		try {
			const params = new URLSearchParams();
			if (fermenterId) params.append('fermenterId', fermenterId);
			const response = await api.get(`/faults?${params.toString()}`);
			return response.data;
		} catch (error) {
			return [];
		}
	},

	resolveFault: async (faultId) => {
		const response = await api.put(`/faults/${faultId}/resolve`);
		return response.data;
	},

	exportReport: async (fermenterId, startTime, endTime, format = 'csv') => {
		const response = await api.post('/export', {
			fermenterId,
			startTime,
			endTime,
			format
		}, {
			responseType: 'blob'
		});
		return response.data;
	}
};

export const createWebSocket = (onMessage) => {
	let ws;
	try {
		ws = new WebSocket(`ws://${window.location.host}/ws`);
		ws.onmessage = (event) => {
			const data = JSON.parse(event.data);
			onMessage(data);
		};
		ws.onerror = (error) => {
			console.log('WebSocket连接失败，使用轮询模式');
		};
	} catch (error) {
		console.log('WebSocket不可用，使用轮询模式');
	}
	return ws;
};
