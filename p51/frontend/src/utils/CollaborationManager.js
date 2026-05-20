export class CollaborationManager {
    constructor() {
        this.ws = null
        this.sessionId = null
        this.userId = null
        this.userName = null
        this.equipmentId = null
        this.isConnected = false
        this.listeners = new Map()
        this.userList = new Map()
        this.operationLog = []
    }

    connect(sessionId, userId, userName, equipmentId) {
        return new Promise((resolve, reject) => {
            const wsUrl = `ws://localhost:8086/ws/collaborate/${sessionId}/${userId}/${encodeURIComponent(userName)}`
            this.ws = new WebSocket(wsUrl)
            
            this.sessionId = sessionId
            this.userId = userId
            this.userName = userName
            this.equipmentId = equipmentId
            
            this.ws.onopen = () => {
                this.isConnected = true
                console.log('Collaboration connected:', sessionId)
                this.emit('connected', { sessionId, userId, userName })
                resolve()
            }
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data)
                    this.handleMessage(message)
                } catch (e) {
                    console.error('Parse message error:', e)
                }
            }
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error)
                reject(error)
            }
            
            this.ws.onclose = () => {
                this.isConnected = false
                console.log('Collaboration disconnected')
                this.emit('disconnected', { sessionId })
            }
        })
    }

    handleMessage(message) {
        switch (message.type) {
            case 'USER_JOIN':
                this.userList.set(message.userId, message.userName)
                this.emit('userJoin', message)
                break
            case 'USER_LEAVE':
                this.userList.delete(message.userId)
                this.emit('userLeave', message)
                break
            case 'USER_LIST':
                this.userList.clear()
                if (message.userList) {
                    Object.entries(message.userList).forEach(([id, name]) => {
                        this.userList.set(id, name)
                    })
                }
                this.emit('userListUpdated', Array.from(this.userList.entries()))
                break
            case 'VIEW_CHANGE':
                this.emit('viewChange', message)
                break
            case 'DAMAGE_MARK':
                this.emit('damageMark', message)
                break
            case 'RESTORATION_STEP':
                this.emit('restorationStep', message)
                break
            case 'PART_SELECT':
                this.emit('partSelect', message)
                break
            case 'COMMENT':
                this.emit('comment', message)
                break
            case 'CURSOR':
                this.emit('cursor', message)
                break
            default:
                this.emit('message', message)
        }
        
        this.operationLog.push(message)
        if (this.operationLog.length > 100) {
            this.operationLog.shift()
        }
    }

    send(message) {
        if (this.isConnected && this.ws) {
            const data = {
                ...message,
                sessionId: this.sessionId,
                userId: this.userId,
                userName: this.userName
            }
            this.ws.send(JSON.stringify(data))
        }
    }

    sendViewChange(cameraPosition, cameraTarget) {
        this.send({
            type: 'VIEW_CHANGE',
            cameraPosition,
            cameraTarget
        })
    }

    sendDamageMark(damageId, action) {
        this.send({
            type: 'DAMAGE_MARK',
            damageId,
            action
        })
    }

    sendRestorationStep(step, action) {
        this.send({
            type: 'RESTORATION_STEP',
            restorationStep: step,
            action
        })
    }

    sendPartSelect(partId, action) {
        this.send({
            type: 'PART_SELECT',
            target: partId,
            action
        })
    }

    sendComment(comment) {
        this.send({
            type: 'COMMENT',
            comment
        })
    }

    sendCursor(position) {
        this.send({
            type: 'CURSOR',
            positionX: position.x,
            positionY: position.y,
            positionZ: position.z
        })
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, [])
        }
        this.listeners.get(event).push(callback)
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event)
            const index = callbacks.indexOf(callback)
            if (index > -1) {
                callbacks.splice(index, 1)
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data))
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close()
            this.ws = null
        }
        this.isConnected = false
        this.userList.clear()
    }

    getOnlineUsers() {
        return Array.from(this.userList.values())
    }

    getOperationLog() {
        return this.operationLog.slice()
    }
}