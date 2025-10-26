/**
 * Crypto Module - Handles AES encryption/decryption using Web Crypto API
 * All encryption happens client-side, passphrase never leaves the device
 */

class CryptoManager {
    constructor() {
        this.key = null;
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
    }

    /**
     * Derives a cryptographic key from the user's passphrase using PBKDF2
     * @param {string} passphrase - User's passphrase
     * @param {Uint8Array} salt - Salt for key derivation
     * @returns {Promise<CryptoKey>} - Derived encryption key
     */
    async deriveKey(passphrase, salt) {
        const encoder = new TextEncoder();
        const passphraseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(passphrase),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000, // High iteration count for security
                hash: 'SHA-256'
            },
            passphraseKey,
            {
                name: this.algorithm,
                length: this.keyLength
            },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Initializes the crypto manager with a passphrase
     * @param {string} passphrase - User's passphrase
     * @param {string} userId - Unique user identifier
     * @returns {Promise<boolean>} - Success status
     */
    async initialize(passphrase, userId = 'default') {
        try {
            // Generate or retrieve user-specific salt
            const saltKey = `app_salt_${userId}`;
            let salt = localStorage.getItem(saltKey);
            if (!salt) {
                const saltArray = crypto.getRandomValues(new Uint8Array(16));
                salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
                localStorage.setItem(saltKey, salt);
            }

            // Convert salt back to Uint8Array
            const saltArray = new Uint8Array(salt.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

            // Derive key from passphrase
            this.key = await this.deriveKey(passphrase, saltArray);
            this.userId = userId;

            // Always set the test value if missing, and validate
            const testKey = `key_test_${userId}`;
            let testData = localStorage.getItem(testKey);
            const testMessage = 'key_validation_test';
            if (!testData) {
                // No test data exists, create one for new users
                const encrypted = await this.encrypt(testMessage);
                localStorage.setItem(testKey, encrypted);
                testData = encrypted;
                // For new vaults, always return true
                return true;
            }
            // Try to decrypt existing test data
            try {
                const decrypted = await this.decrypt(testData);
                return decrypted === testMessage;
            } catch (decryptError) {
                // Invalid passphrase for this user
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize crypto:', error);
            return false;
        }
    }

    /**
     * Creates a new user vault with passphrase
     * @param {string} passphrase - User's new passphrase
     * @param {string} userId - Unique user identifier
     * @returns {Promise<boolean>} - Success status
     */
    async createUserVault(passphrase, userId) {
        try {
            // Always create a new salt for the vault
            const vaultKey = `user_vault_${userId}`;
            const saltKey = `app_salt_${userId}`;
            const testKey = `key_test_${userId}`;
            
            // Clear any existing vault data
            localStorage.removeItem(vaultKey);
            localStorage.removeItem(saltKey);
            localStorage.removeItem(testKey);
            
            // Generate new salt
            const saltArray = crypto.getRandomValues(new Uint8Array(16));
            const salt = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(saltKey, salt);

            // Initialize with new passphrase
            const success = await this.initialize(passphrase, userId);

            if (success) {
                // Mark user as having a vault
                localStorage.setItem(vaultKey, 'true');
                localStorage.setItem('current_user', userId);
            }

            return success;
        } catch (error) {
            console.error('Failed to create user vault:', error);
            return false;
        }
    }

    /**
     * Validates the derived key by attempting to decrypt a test value
     * @returns {Promise<boolean>} - True if key is valid
     */
    async validateKey(userId = 'default') {
        try {
            const testKey = `key_test_${userId}`;
            let testData = localStorage.getItem(testKey);
            const testMessage = 'key_validation_test';
            if (!testData) {
                // No test data exists, create one for new users
                const encrypted = await this.encrypt(testMessage);
                localStorage.setItem(testKey, encrypted);
                testData = encrypted;
            }

            // Try to decrypt existing test data
            try {
                const decrypted = await this.decrypt(testData);
                return decrypted === testMessage;
            } catch (decryptError) {
                // Invalid passphrase for this user
                return false;
            }
        } catch (error) {
            console.error('Key validation error:', error);
            return false;
        }
    }

    /**
     * Encrypts data using AES-GCM
     * @param {string} data - Data to encrypt
     * @returns {Promise<string>} - Base64 encoded encrypted data with IV
     */
    async encrypt(data) {
        if (!this.key) {
            throw new Error('Crypto not initialized. Call initialize() first.');
        }

        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data);
            
            // Generate random IV for each encryption
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                this.key,
                dataBuffer
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            // Convert to base64 for storage
            return btoa(String.fromCharCode.apply(null, combined));
        } catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypts data using AES-GCM
     * @param {string} encryptedData - Base64 encoded encrypted data with IV
     * @returns {Promise<string>} - Decrypted data
     */
    async decrypt(encryptedData) {
        if (!this.key) {
            throw new Error('Crypto not initialized. Call initialize() first.');
        }

        try {
            // Convert from base64
            const combined = new Uint8Array(
                atob(encryptedData).split('').map(char => char.charCodeAt(0))
            );

            // Extract IV and encrypted data
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.algorithm,
                    iv: iv
                },
                this.key,
                encrypted
            );

            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt data - invalid passphrase or corrupted data');
        }
    }

    /**
     * Encrypts a note object
     * @param {Object} note - Note object to encrypt
     * @returns {Promise<Object>} - Encrypted note object
     */
    async encryptNote(note) {
        const encryptedNote = { ...note };
        
        // Encrypt sensitive fields
        if (note.title) {
            encryptedNote.title = await this.encrypt(note.title);
        }
        if (note.content) {
            encryptedNote.content = await this.encrypt(note.content);
        }
        if (note.tags && note.tags.length > 0) {
            encryptedNote.tags = await Promise.all(
                note.tags.map(tag => this.encrypt(tag))
            );
        }

        encryptedNote.encrypted = true;
        return encryptedNote;
    }

    /**
     * Decrypts a note object
     * @param {Object} encryptedNote - Encrypted note object
     * @returns {Promise<Object>} - Decrypted note object
     */
    async decryptNote(encryptedNote) {
        if (!encryptedNote.encrypted) {
            return encryptedNote; // Already decrypted
        }

        const note = { ...encryptedNote };
        
        // Decrypt sensitive fields
        if (encryptedNote.title) {
            note.title = await this.decrypt(encryptedNote.title);
        }
        if (encryptedNote.content) {
            note.content = await this.decrypt(encryptedNote.content);
        }
        if (encryptedNote.tags && encryptedNote.tags.length > 0) {
            note.tags = await Promise.all(
                encryptedNote.tags.map(tag => this.decrypt(tag))
            );
        }

        note.encrypted = false;
        return note;
    }

    /**
     * Generates a secure random password
     * @param {number} length - Password length
     * @returns {string} - Generated password
     */
    generateSecurePassword(length = 16) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        
        return Array.from(array, byte => charset[byte % charset.length]).join('');
    }

    /**
     * Clears the encryption key from memory
     */
    clear() {
        this.key = null;
    }

    /**
     * Checks if crypto is initialized
     * @returns {boolean} - True if initialized
     */
    isInitialized() {
        return this.key !== null;
    }

    /**
     * Estimates password strength
     * @param {string} password - Password to analyze
     * @returns {Object} - Strength analysis
     */
    analyzePasswordStrength(password) {
        const analysis = {
            score: 0,
            feedback: [],
            strength: 'weak'
        };

        // Length check
        if (password.length >= 12) analysis.score += 2;
        else if (password.length >= 8) analysis.score += 1;
        else analysis.feedback.push('Use at least 8 characters');

        // Character variety
        if (/[a-z]/.test(password)) analysis.score += 1;
        if (/[A-Z]/.test(password)) analysis.score += 1;
        if (/[0-9]/.test(password)) analysis.score += 1;
        if (/[^A-Za-z0-9]/.test(password)) analysis.score += 1;

        // Common patterns
        if (/(.)\1{2,}/.test(password)) {
            analysis.score -= 1;
            analysis.feedback.push('Avoid repeated characters');
        }

        // Determine strength
        if (analysis.score >= 5) analysis.strength = 'strong';
        else if (analysis.score >= 3) analysis.strength = 'medium';
        else analysis.strength = 'weak';

        return analysis;
    }
}

// Export for use in other modules
window.CryptoManager = CryptoManager;
