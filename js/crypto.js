// Functions for working with cryptography

/**
 * Calculate SHA-256 hash of data (for Hash Version)
 * @param {string} data - Data to hash
 * @returns {Promise<string>} Base64-encoded hash
 */
async function calculateDataHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // Convert to base64 for storage
    const binaryString = String.fromCharCode(...new Uint8Array(hashBuffer));
    return btoa(binaryString);
}

// Derived key from password and salt
async function deriveKeyFromPassword(keyMaterial, salt) {
    const encoder = new TextEncoder();
    const keyMaterialKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(keyMaterial),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );
    
    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterialKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

// Data encryption
async function encryptData(data) {
    if (!encryptionKey) {
        throw new Error('Encryption key not set');
    }
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        encryptionKey,
        dataBuffer
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
}

// Data decryption
async function decryptData(encryptedData) {
    if (!encryptionKey) {
        throw new Error('Encryption key not set');
    }
    
    try {
        // Convert from base64
        const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
        
        // Extract IV and encrypted data
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        // Decrypt
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            encryptionKey,
            encrypted
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        throw new Error('Decryption error. Possibly incorrect master key.');
    }
}

// Initialize encryption for user (works with both new and legacy architecture)
async function initializeEncryption(userId, masterKeyValue, useExistingSalt) {
    masterKey = masterKeyValue; // Save master key in global variable (not persisted - NEVER saved)
    currentUserLogin = userId;
    
    // Try new architecture first
    let saltBase64 = null;
    if (typeof getUserDataKey === 'function') {
        const dataKey = getUserDataKey(userId);
        saltBase64 = localStorage.getItem(dataKey + '_salt');
    }
    
    // If not found, try legacy
    if (!saltBase64) {
        const keys = getUserStorageKeys(userId);
        saltBase64 = localStorage.getItem(keys.encryptionSalt);
    }
    
    let salt;
    if (useExistingSalt) {
        // Use existing salt for this user
        if (!saltBase64) {
            throw new Error('Login or master key is incorrect');
        }
        salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
    } else {
        // Generate new salt for new user
        salt = crypto.getRandomValues(new Uint8Array(16));
        const saltBase64Value = btoa(String.fromCharCode(...salt));
        
        // Save salt in base64 for this user (new architecture)
        if (typeof getUserDataKey === 'function') {
            const dataKey = getUserDataKey(userId);
            localStorage.setItem(dataKey + '_salt', saltBase64Value);
        }
        // Also save in legacy format for compatibility
        const keys = getUserStorageKeys(userId);
        localStorage.setItem(keys.encryptionSalt, saltBase64Value);
    }
    
    // Generate key from master key and userId (userId added for uniqueness)
    const combinedKey = userId + masterKeyValue;
    encryptionKey = await deriveKeyFromPassword(combinedKey, salt);
}




