export class HeritageDatabaseAPI {
    constructor(baseURL = 'http://localhost:8085/api') {
        this.baseURL = baseURL
    }

    async request(url, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            })
            return await response.json()
        } catch (error) {
            console.error('API request failed:', error)
            return { code: 500, message: error.message }
        }
    }

    async getEquipmentList() {
        return this.request('/equipment/list')
    }

    async getEquipmentByCategory(category) {
        return this.request(`/equipment/category/${category}`)
    }

    async searchEquipment(keyword) {
        return this.request(`/equipment/search?keyword=${encodeURIComponent(keyword)}`)
    }

    async getEquipmentDetail(id) {
        return this.request(`/equipment/${id}`)
    }

    async createEquipment(data) {
        return this.request('/equipment', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }

    async updateEquipment(data) {
        return this.request('/equipment', {
            method: 'PUT',
            body: JSON.stringify(data)
        })
    }

    async deleteEquipment(id) {
        return this.request(`/equipment/${id}`, {
            method: 'DELETE'
        })
    }

    async getCategories() {
        return this.request('/equipment/categories')
    }

    async getStatistics() {
        return this.request('/equipment/statistics')
    }

    async syncData() {
        return this.request('/equipment/sync', { method: 'POST' })
    }

    async importEquipment(data) {
        return this.request('/equipment/import', {
            method: 'POST',
            body: JSON.stringify(data)
        })
    }
}

export class CollaborationAPI {
    constructor(baseURL = 'http://localhost:8086') {
        this.baseURL = baseURL
    }

    async request(url, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            })
            return await response.json()
        } catch (error) {
            console.error('API request failed:', error)
            return { code: 500, message: error.message }
        }
    }

    async getActiveSessions() {
        return this.request('/collaboration/sessions')
    }

    async getSessionUsers(sessionId) {
        return this.request(`/collaboration/session/${sessionId}/users`)
    }

    async getSessionLogs(sessionId) {
        return this.request(`/collaboration/session/${sessionId}/logs`)
    }

    async createSession(equipmentId, userId) {
        return this.request('/collaboration/session/create', {
            method: 'POST',
            body: JSON.stringify({ equipmentId, userId })
        })
    }

    async clearSessionLogs(sessionId) {
        return this.request(`/collaboration/session/${sessionId}`, {
            method: 'DELETE'
        })
    }

    async getStatistics() {
        return this.request('/collaboration/statistics')
    }
}

export class ScoringAPI {
    constructor(baseURL = 'http://localhost:8087') {
        this.baseURL = baseURL
    }

    async request(url, options = {}) {
        try {
            const response = await fetch(`${this.baseURL}${url}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            })
            return await response.json()
        } catch (error) {
            console.error('API request failed:', error)
            return { code: 500, message: error.message }
        }
    }

    async evaluate(scoreData) {
        return this.request('/scoring/evaluate', {
            method: 'POST',
            body: JSON.stringify(scoreData)
        })
    }

    async getScoresByEquipment(equipmentId) {
        return this.request(`/scoring/equipment/${equipmentId}`)
    }

    async getScoreStatistics(equipmentId) {
        return this.request(`/scoring/statistics/${equipmentId}`)
    }

    async submitReview(reviewData) {
        return this.request('/scoring/review/submit', {
            method: 'POST',
            body: JSON.stringify(reviewData)
        })
    }

    async getReviewsByPlan(planId) {
        return this.request(`/scoring/review/plan/${planId}`)
    }

    async getReviewsByExpert(expertId) {
        return this.request(`/scoring/review/expert/${expertId}`)
    }

    async startWorkflow(planId, creatorId) {
        return this.request('/scoring/workflow/start', {
            method: 'POST',
            body: JSON.stringify({ planId, creatorId })
        })
    }

    async getWorkflow(planId) {
        return this.request(`/scoring/workflow/${planId}`)
    }

    async getReviewStatistics() {
        return this.request('/scoring/review/statistics')
    }

    async getWeights() {
        return this.request('/scoring/weights')
    }
}