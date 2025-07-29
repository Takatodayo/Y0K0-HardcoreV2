// IndexedDB管理クラス
class HardcoreDB {
    constructor() {
        this.dbName = 'HardcoreDatabase';
        this.version = 1;
        this.db = null;
    }

    // データベース初期化
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database opened successfully');
                resolve(this.db);
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 死因記録テーブル
                if (!db.objectStoreNames.contains('deathRecords')) {
                    const deathStore = db.createObjectStore('deathRecords', { keyPath: 'id', autoIncrement: true });
                    deathStore.createIndex('playerName', 'playerName', { unique: false });
                    deathStore.createIndex('timestamp', 'timestamp', { unique: false });
                    deathStore.createIndex('sessionId', 'sessionId', { unique: false });
                }
                
                // ペナルティルーレット記録テーブル
                if (!db.objectStoreNames.contains('penaltyRoulette')) {
                    const penaltyStore = db.createObjectStore('penaltyRoulette', { keyPath: 'id', autoIncrement: true });
                    penaltyStore.createIndex('playerName', 'playerName', { unique: false });
                    penaltyStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // セッション管理テーブル
                if (!db.objectStoreNames.contains('sessions')) {
                    const sessionStore = db.createObjectStore('sessions', { keyPath: 'id', autoIncrement: true });
                    sessionStore.createIndex('startTime', 'startTime', { unique: false });
                    sessionStore.createIndex('status', 'status', { unique: false });
                }
                
                // プレイヤー統計テーブル
                if (!db.objectStoreNames.contains('playerStats')) {
                    const statsStore = db.createObjectStore('playerStats', { keyPath: 'playerName' });
                    statsStore.createIndex('totalPoints', 'totalPoints', { unique: false });
                    statsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
                }
            };
        });
    }
    
    // 死因記録を追加
    async addDeathRecord(record) {
        const transaction = this.db.transaction(['deathRecords'], 'readwrite');
        const store = transaction.objectStore('deathRecords');
        
        const data = {
            ...record,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // ペナルティルーレット結果を追加
    async addPenaltyRoulette(playerName, points) {
        const transaction = this.db.transaction(['penaltyRoulette'], 'readwrite');
        const store = transaction.objectStore('penaltyRoulette');
        
        const data = {
            playerName,
            points,
            timestamp: new Date().toISOString()
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // セッションを作成
    async createSession(eventName) {
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        
        const session = {
            eventName,
            startTime: new Date().toISOString(),
            endTime: null,
            status: 'active'
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(session);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // アクティブなセッションを取得
    async getActiveSession() {
        const transaction = this.db.transaction(['sessions'], 'readonly');
        const store = transaction.objectStore('sessions');
        const index = store.index('status');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll('active');
            request.onsuccess = () => {
                const sessions = request.result;
                resolve(sessions.length > 0 ? sessions[sessions.length - 1] : null);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // セッションを終了
    async endSession(sessionId) {
        const transaction = this.db.transaction(['sessions'], 'readwrite');
        const store = transaction.objectStore('sessions');
        
        return new Promise((resolve, reject) => {
            const request = store.get(sessionId);
            request.onsuccess = () => {
                const session = request.result;
                session.endTime = new Date().toISOString();
                session.status = 'completed';
                
                const updateRequest = store.put(session);
                updateRequest.onsuccess = () => resolve(session);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // プレイヤー統計を更新
    async updatePlayerStats(playerName, deathData) {
        const transaction = this.db.transaction(['playerStats'], 'readwrite');
        const store = transaction.objectStore('playerStats');
        
        return new Promise((resolve, reject) => {
            const request = store.get(playerName);
            request.onsuccess = () => {
                let stats = request.result || {
                    playerName,
                    totalDeaths: 0,
                    totalPoints: 0,
                    deathDetails: {},
                    penaltyPoints: 0
                };
                
                // 統計を更新
                if (deathData) {
                    stats.totalDeaths += 1;
                    stats.totalPoints += deathData.points || 0;
                    
                    if (deathData.cause) {
                        stats.deathDetails[deathData.cause] = (stats.deathDetails[deathData.cause] || 0) + 1;
                    }
                }
                
                stats.lastUpdated = new Date().toISOString();
                
                const updateRequest = store.put(stats);
                updateRequest.onsuccess = () => resolve(stats);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // ペナルティポイントを追加
    async addPenaltyPoints(playerName, points) {
        const transaction = this.db.transaction(['playerStats'], 'readwrite');
        const store = transaction.objectStore('playerStats');
        
        return new Promise((resolve, reject) => {
            const request = store.get(playerName);
            request.onsuccess = () => {
                let stats = request.result || {
                    playerName,
                    totalDeaths: 0,
                    totalPoints: 0,
                    deathDetails: {},
                    penaltyPoints: 0
                };
                
                stats.penaltyPoints = (stats.penaltyPoints || 0) + points;
                stats.totalPoints += points;
                stats.lastUpdated = new Date().toISOString();
                
                const updateRequest = store.put(stats);
                updateRequest.onsuccess = () => resolve(stats);
                updateRequest.onerror = () => reject(updateRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }
    
    // 全プレイヤーの統計を取得
    async getAllPlayerStats() {
        const transaction = this.db.transaction(['playerStats'], 'readonly');
        const store = transaction.objectStore('playerStats');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // ペナルティ履歴を取得
    async getPenaltyHistory() {
        const transaction = this.db.transaction(['penaltyRoulette'], 'readonly');
        const store = transaction.objectStore('penaltyRoulette');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // データベースをクリア
    async clearAllData() {
        const stores = ['deathRecords', 'penaltyRoulette', 'sessions', 'playerStats'];
        const transaction = this.db.transaction(stores, 'readwrite');
        
        const promises = stores.map(storeName => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        });
        
        return Promise.all(promises);
    }
    
    // プレイヤー統計のみリセット
    async clearPlayerStats() {
        const transaction = this.db.transaction(['playerStats'], 'readwrite');
        const store = transaction.objectStore('playerStats');
        
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // 特定のプレイヤーの統計をリセット
    async clearPlayerStat(playerName) {
        const transaction = this.db.transaction(['playerStats'], 'readwrite');
        const store = transaction.objectStore('playerStats');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(playerName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
    
    // エクスポート機能
    async exportData() {
        const data = {
            exportDate: new Date().toISOString(),
            sessions: await this.getAllFromStore('sessions'),
            deathRecords: await this.getAllFromStore('deathRecords'),
            penaltyRoulette: await this.getAllFromStore('penaltyRoulette'),
            playerStats: await this.getAllFromStore('playerStats')
        };
        
        return data;
    }
    
    // ストアから全データ取得（ヘルパー関数）
    async getAllFromStore(storeName) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// グローバルインスタンス
const hardcoreDB = new HardcoreDB();