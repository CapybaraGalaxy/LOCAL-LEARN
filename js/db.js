const DB_NAME = 'LocalLearnDB';
const DB_VERSION = 2;

const db = {
    _db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const _db = e.target.result;
                if (!_db.objectStoreNames.contains('units')) {
                    _db.createObjectStore('units', { keyPath: 'id' });
                }
                if (!_db.objectStoreNames.contains('media')) {
                    _db.createObjectStore('media', { keyPath: 'id' });
                }
                if (!_db.objectStoreNames.contains('progress')) {
                    _db.createObjectStore('progress', { keyPath: 'id' });
                }
                if (!_db.objectStoreNames.contains('records')) {
                    _db.createObjectStore('records', { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async _tx(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const req = callback(store);
            if (req) {
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            } else {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }
        });
    },

    // Unidades
    async saveUnit(unitData) {
        unitData.modified = new Date().toISOString();
        return this._tx('units', 'readwrite', store => store.put(unitData));
    },
    async getUnit(id) {
        return this._tx('units', 'readonly', store => store.get(id));
    },
    async getAllUnits() {
        return this._tx('units', 'readonly', store => store.getAll());
    },
    async deleteUnit(id) {
        const unit = await this.getUnit(id);
        if (unit && unit.cards) {
            for (const card of unit.cards) {
                if (card.image) {
                    await this.deleteMedia(`${id}_${card.image}`);
                }
                await this._tx('progress', 'readwrite', store => store.delete(`${id}_${card.id}`));
            }
        }
        await this._tx('records', 'readwrite', store => store.delete(id));
        return this._tx('units', 'readwrite', store => store.delete(id));
    },

    // Multimedia (Blobs)
    async saveMedia(id, blob) {
        return this._tx('media', 'readwrite', store => store.put({ id, blob }));
    },
    async getMediaBlob(id) {
        const res = await this._tx('media', 'readonly', store => store.get(id));
        return res ? res.blob : null;
    },
    async deleteMedia(id) {
        return this._tx('media', 'readwrite', store => store.delete(id));
    },

    // Progreso
    async saveCardProgress(unitId, cardId, stats) {
        const id = `${unitId}_${cardId}`;
        const current = await this.getCardProgress(unitId, cardId) || { level: 0, reviews: 0 };
        const updated = { id, unitId, cardId, ...current, ...stats, lastReview: Date.now() };
        return this._tx('progress', 'readwrite', store => store.put(updated));
    },
    async getCardProgress(unitId, cardId) {
        return this._tx('progress', 'readonly', store => store.get(`${unitId}_${cardId}`));
    },
    async getUnitProgress(unitId) {
        const all = await this._tx('progress', 'readonly', store => store.getAll());
        return all.filter(p => p.unitId === unitId);
    },

    // Récords (Test y Match)
    async saveRecord(unitId, type, data) {
        const current = await this._tx('records', 'readonly', store => store.get(unitId)) || { id: unitId };
        current[type] = data;
        return this._tx('records', 'readwrite', store => store.put(current));
    },
    async getRecord(unitId) {
        return this._tx('records', 'readonly', store => store.get(unitId));
    },

    async clearAllData() {
        const stores = ['units', 'media', 'progress', 'records'];
        for (const s of stores) {
            await this._tx(s, 'readwrite', store => store.clear());
        }
    }
};