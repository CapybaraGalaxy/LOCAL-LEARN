const DB_NAME = 'LocalLearnDB';
const DB_VERSION = 1;

const db = {
    _db: null,

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onupgradeneeded = (e) => {
                const _db = e.target.result;
                // Almacena las unidades (JSON del pack y metadatos)
                if (!_db.objectStoreNames.contains('units')) {
                    _db.createObjectStore('units', { keyPath: 'id' });
                }
                // Almacena blobs de imágenes locales referenciadas por unitId_mediaPath
                if (!_db.objectStoreNames.contains('media')) {
                    _db.createObjectStore('media', { keyPath: 'id' });
                }
                // Almacena el progreso. key: unitId_cardId
                if (!_db.objectStoreNames.contains('progress')) {
                    _db.createObjectStore('progress', { keyPath: 'id' });
                }
            };

            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve();
            };
            request.onerror = (e) => reject(e.target.error);
        });
    },

    async _transaction(storeName, mode, callback) {
        return new Promise((resolve, reject) => {
            const tx = this._db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            const request = callback(store);
            
            if (request) {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } else {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            }
        });
    },

    // Units
    async saveUnit(unitData) {
        unitData.modified = new Date().toISOString();
        return this._transaction('units', 'readwrite', store => store.put(unitData));
    },
    async getUnit(id) {
        return this._transaction('units', 'readonly', store => store.get(id));
    },
    async getAllUnits() {
        return this._transaction('units', 'readonly', store => store.getAll());
    },
    async deleteUnit(id) {
        await this._transaction('progress', 'readwrite', store => { /* TODO: Limpiar progreso asociado */ });
        return this._transaction('units', 'readwrite', store => store.delete(id));
    },

    // Media
    async saveMedia(id, blob) {
        return this._transaction('media', 'readwrite', store => store.put({ id, blob }));
    },
    async getMediaBlob(id) {
        const result = await this._transaction('media', 'readonly', store => store.get(id));
        return result ? result.blob : null;
    },

    // Progress
    async saveCardProgress(unitId, cardId, stats) {
        const id = `${unitId}_${cardId}`;
        const current = await this.getCardProgress(unitId, cardId) || { level: 0, reviews: 0 };
        const updated = { id, unitId, cardId, ...current, ...stats, lastReview: Date.now() };
        return this._transaction('progress', 'readwrite', store => store.put(updated));
    },
    async getCardProgress(unitId, cardId) {
        return this._transaction('progress', 'readonly', store => store.get(`${unitId}_${cardId}`));
    },
    async getUnitProgress(unitId) {
        const all = await this._transaction('progress', 'readonly', store => store.getAll());
        return all.filter(p => p.unitId === unitId);
    }
};