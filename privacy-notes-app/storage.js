/**
 * Storage Module - Handles IndexedDB operations for offline-first functionality
 * All data is stored locally and encrypted before storage
 */

class StorageManager {
    constructor() {
        this.dbName = 'SecureNotesDB';
        this.dbVersion = 1;
        this.db = null;
        this.userId = 'default';
        this.stores = {
            notes: 'notes',
            settings: 'settings'
        };
    }

    /**
     * Set the current user ID for storage separation
     * @param {string} userId - User identifier
     */
    setUserId(userId) {
        this.userId = userId;
    }

    /**
     * Initializes the IndexedDB database
     * @returns {Promise<boolean>} - Success status
     */
    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('Failed to open database:', request.error);
                reject(false);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('Database initialized successfully');
                resolve(true);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create notes store
                if (!db.objectStoreNames.contains(this.stores.notes)) {
                    const notesStore = db.createObjectStore(this.stores.notes, { 
                        keyPath: 'id',
                        autoIncrement: false 
                    });
                    
                    // Create indexes for efficient querying
                    notesStore.createIndex('createdAt', 'createdAt', { unique: false });
                    notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
                    notesStore.createIndex('pinned', 'pinned', { unique: false });
                    notesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
                }

                // Create settings store
                if (!db.objectStoreNames.contains(this.stores.settings)) {
                    db.createObjectStore(this.stores.settings, { 
                        keyPath: 'key' 
                    });
                }
            };
        });
    }

    /**
     * Generates a unique ID for notes
     * @returns {string} - Unique identifier
     */
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Saves a note to the database
     * @param {Object} note - Note object to save
     * @returns {Promise<Object>} - Saved note with ID
     */
    async saveNote(note) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.notes], 'readwrite');
            const store = transaction.objectStore(this.stores.notes);

            // Ensure note has required fields and user separation
            const noteToSave = {
                id: note.id || this.generateId(),
                userId: this.userId, // Add user separation
                title: note.title || 'Untitled',
                content: note.content || '',
                tags: note.tags || [],
                pinned: note.pinned || false,
                createdAt: note.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                encrypted: note.encrypted || false
            };

            const request = store.put(noteToSave);

            request.onsuccess = () => {
                resolve(noteToSave);
            };

            request.onerror = () => {
                console.error('Failed to save note:', request.error);
                reject(new Error('Failed to save note'));
            };
        });
    }

    /**
     * Retrieves a note by ID
     * @param {string} id - Note ID
     * @returns {Promise<Object|null>} - Note object or null if not found
     */
    async getNote(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.notes], 'readonly');
            const store = transaction.objectStore(this.stores.notes);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                console.error('Failed to get note:', request.error);
                reject(new Error('Failed to retrieve note'));
            };
        });
    }

    /**
     * Retrieves all notes from the database for current user
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of notes
     */
    async getAllNotes(options = {}) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.notes], 'readonly');
            const store = transaction.objectStore(this.stores.notes);
            
            let request;
            
            // Use index if sorting by specific field
            if (options.sortBy === 'createdAt' || options.sortBy === 'updatedAt') {
                const index = store.index(options.sortBy);
                request = index.openCursor(null, options.sortOrder === 'asc' ? 'next' : 'prev');
            } else {
                request = store.openCursor();
            }

            const notes = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // Only include notes for current user
                    if (cursor.value.userId === this.userId || !cursor.value.userId) {
                        notes.push(cursor.value);
                    }
                    cursor.continue();
                } else {
                    // Apply filters
                    let filteredNotes = notes;

                    if (options.pinned !== undefined) {
                        filteredNotes = filteredNotes.filter(note => note.pinned === options.pinned);
                    }

                    if (options.tags && options.tags.length > 0) {
                        filteredNotes = filteredNotes.filter(note => 
                            options.tags.some(tag => note.tags.includes(tag))
                        );
                    }

                    // Default sort by updatedAt descending if no specific sort
                    if (!options.sortBy) {
                        filteredNotes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                    }

                    resolve(filteredNotes);
                }
            };

            request.onerror = () => {
                console.error('Failed to get notes:', request.error);
                reject(new Error('Failed to retrieve notes'));
            };
        });
    }

    /**
     * Deletes a note by ID
     * @param {string} id - Note ID
     * @returns {Promise<boolean>} - Success status
     */
    async deleteNote(id) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.notes], 'readwrite');
            const store = transaction.objectStore(this.stores.notes);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to delete note:', request.error);
                reject(new Error('Failed to delete note'));
            };
        });
    }

    /**
     * Searches notes by content (works on decrypted notes)
     * @param {string} query - Search query
     * @param {Array} notes - Array of decrypted notes to search
     * @returns {Array} - Filtered notes
     */
    searchNotes(query, notes) {
        if (!query || !query.trim()) {
            return notes;
        }

        const searchTerm = query.toLowerCase().trim();
        
        return notes.filter(note => {
            // Search in title
            if (note.title && note.title.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            // Search in content
            if (note.content && note.content.toLowerCase().includes(searchTerm)) {
                return true;
            }
            
            // Search in tags
            if (note.tags && note.tags.some(tag => 
                tag.toLowerCase().includes(searchTerm)
            )) {
                return true;
            }
            
            return false;
        });
    }

    /**
     * Gets all unique tags from notes
     * @param {Array} notes - Array of decrypted notes
     * @returns {Array} - Array of unique tags with counts
     */
    getAllTags(notes) {
        const tagCounts = {};
        
        notes.forEach(note => {
            if (note.tags) {
                note.tags.forEach(tag => {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                });
            }
        });

        return Object.entries(tagCounts)
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Saves application settings
     * @param {string} key - Setting key
     * @param {any} value - Setting value
     * @returns {Promise<boolean>} - Success status
     */
    async saveSetting(key, value) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.settings], 'readwrite');
            const store = transaction.objectStore(this.stores.settings);
            
            const setting = {
                key: key,
                value: value,
                updatedAt: new Date().toISOString()
            };

            const request = store.put(setting);

            request.onsuccess = () => {
                resolve(true);
            };

            request.onerror = () => {
                console.error('Failed to save setting:', request.error);
                reject(new Error('Failed to save setting'));
            };
        });
    }

    /**
     * Retrieves a setting value
     * @param {string} key - Setting key
     * @returns {Promise<any>} - Setting value or null
     */
    async getSetting(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.settings], 'readonly');
            const store = transaction.objectStore(this.stores.settings);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };

            request.onerror = () => {
                console.error('Failed to get setting:', request.error);
                reject(new Error('Failed to retrieve setting'));
            };
        });
    }

    /**
     * Exports all notes (encrypted) for backup
     * @returns {Promise<Object>} - Backup data
     */
    async exportData() {
        const notes = await this.getAllNotes();
        const settings = await this.getAllSettings();
        
        return {
            version: this.dbVersion,
            exportDate: new Date().toISOString(),
            notes: notes,
            settings: settings
        };
    }

    /**
     * Imports notes from backup data
     * @param {Object} backupData - Backup data to import
     * @returns {Promise<boolean>} - Success status
     */
    async importData(backupData) {
        try {
            if (backupData.notes) {
                for (const note of backupData.notes) {
                    await this.saveNote(note);
                }
            }
            
            if (backupData.settings) {
                for (const setting of backupData.settings) {
                    await this.saveSetting(setting.key, setting.value);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Failed to import data:', error);
            return false;
        }
    }

    /**
     * Gets all settings
     * @returns {Promise<Array>} - Array of settings
     */
    async getAllSettings() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.settings], 'readonly');
            const store = transaction.objectStore(this.stores.settings);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                console.error('Failed to get settings:', request.error);
                reject(new Error('Failed to retrieve settings'));
            };
        });
    }

    /**
     * Clears all data from the database
     * @returns {Promise<boolean>} - Success status
     */
    async clearAllData() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Database not initialized'));
                return;
            }

            const transaction = this.db.transaction([this.stores.notes, this.stores.settings], 'readwrite');
            
            const clearNotes = transaction.objectStore(this.stores.notes).clear();
            const clearSettings = transaction.objectStore(this.stores.settings).clear();

            transaction.oncomplete = () => {
                resolve(true);
            };

            transaction.onerror = () => {
                console.error('Failed to clear data:', transaction.error);
                reject(new Error('Failed to clear data'));
            };
        });
    }

    /**
     * Gets database statistics
     * @returns {Promise<Object>} - Database statistics
     */
    async getStats() {
        const notes = await this.getAllNotes();
        const tags = this.getAllTags(notes);
        
        return {
            totalNotes: notes.length,
            pinnedNotes: notes.filter(note => note.pinned).length,
            totalTags: tags.length,
            lastUpdated: notes.length > 0 ? Math.max(...notes.map(note => new Date(note.updatedAt))) : null
        };
    }
}

// Export for use in other modules
window.StorageManager = StorageManager;
