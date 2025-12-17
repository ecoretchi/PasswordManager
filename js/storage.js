// Working with localStorage

// Storage key constants
const STORAGE_PREFIX = 'PM_DATA::';
const ACTIVE_USER_KEY = 'PM_ACTIVE_USER';

// Getting storage key for user data (new architecture)
function getUserDataKey(userId) {
    return `${STORAGE_PREFIX}${userId}`;
}

// Get active user ID
function getActiveUserId() {
    return localStorage.getItem(ACTIVE_USER_KEY);
}

// Set active user ID
function setActiveUserId(userId) {
    if (userId) {
        localStorage.setItem(ACTIVE_USER_KEY, userId);
    } else {
        localStorage.removeItem(ACTIVE_USER_KEY);
    }
}

// Check if user data exists
function userDataExists(userId) {
    const dataKey = getUserDataKey(userId);
    return localStorage.getItem(dataKey) !== null;
}

// Legacy function for backward compatibility (will be removed later)
function getUserStorageKeys(login) {
    const loginHash = btoa(login).replace(/[+/=]/g, '');
    return {
        encryptedData: `encryptedData_${loginHash}`,
        encryptionSalt: `encryptionSalt_${loginHash}`,
        deleteWithoutConfirm: `deleteWithoutConfirm_${loginHash}`,
        dataVersion: `dataVersion_${loginHash}`,
        dataSource: `dataSource_${loginHash}`
    };
}

// Check if user exists (legacy + new)
function userExists(login) {
    // Check new architecture first
    if (userDataExists(login)) {
        return true;
    }
    // Check legacy architecture
    const keys = getUserStorageKeys(login);
    return localStorage.getItem(keys.encryptedData) !== null || 
           localStorage.getItem(keys.encryptionSalt) !== null;
}

// Load data from localStorage (new architecture)
async function loadFromLocalStorage(userId = null) {
    const targetUserId = userId || currentUserLogin;
    if (!targetUserId) {
        throw new Error('User ID not specified');
    }
    
    // Try new architecture first
    const dataKey = getUserDataKey(targetUserId);
    let encryptedData = localStorage.getItem(dataKey);
    
    // If not found in new architecture, try legacy
    if (!encryptedData) {
        const keys = getUserStorageKeys(targetUserId);
        encryptedData = localStorage.getItem(keys.encryptedData);
        
        if (!encryptedData) {
            // No data - this is normal for new user
            if (typeof logInfo === 'function') {
                logInfo('No data found in localStorage (new user)');
            }
            return null; // Return null to indicate no data
        }
    }
    
    try {
        const decryptedData = await decryptData(encryptedData);
        const data = JSON.parse(decryptedData);
        
        // Log before restore
        const beforeCategoriesCount = passwordCategories.length;
        const beforePasswordsCount = passwords.length;
        
        // Check if it's new architecture (has userId and loginType) or legacy
        let loginType = 'Local';
        let googleTokenData = null;
        
        if (data.userId && data.loginType) {
            // New architecture
            loginType = data.loginType;
            googleTokenData = data.googleToken;
            currentUserLogin = data.userId;
        } else {
            // Legacy architecture - migrate
            loginType = localStorage.getItem(getUserStorageKeys(targetUserId).dataSource) === 'cloud' ? 'Google' : 'Local';
        }
        
        // Restore data
        if (data.passwordCategories) {
            passwordCategories = data.passwordCategories;
        }
        if (data.passwords) {
            passwords = data.passwords;
            
            // Ensure all passwords have Hash ID (migration for old records)
            // Also ensure no _isDraft flags from previous sessions (they are session-only)
            let hashIdsAdded = 0;
            for (let i = 0; i < passwords.length; i++) {
                const pwd = passwords[i];
                if (!pwd._hashId) {
                    // Generate Hash ID for old records without it
                    const randomBytes = new Uint8Array(32);
                    crypto.getRandomValues(randomBytes);
                    const binaryString = String.fromCharCode(...randomBytes);
                    pwd._hashId = btoa(binaryString);
                    hashIdsAdded++;
                }
                // Remove _isDraft flag if present (shouldn't be in saved data, but just in case)
                if (pwd._isDraft) {
                    delete pwd._isDraft;
                }
            }
            
            if (hashIdsAdded > 0 && typeof logInfo === 'function') {
                logInfo(`Added Hash IDs to ${hashIdsAdded} old password records`);
            }
        }
        if (data.passwordsVisible) {
            passwordsVisible = data.passwordsVisible;
        }
        
        // Restore Google tokens if available
        if (googleTokenData && loginType === 'Google') {
            googleDriveAccessToken = googleTokenData.accessToken;
            googleDriveRefreshToken = googleTokenData.refreshToken;
            googleDriveFileId = googleTokenData.fileId;
            googleDriveUserEmail = googleTokenData.email;
            isGoogleSignIn = true;
        }
        
        // Remove duplicate passwords by Hash ID (categories duplicates are handled in updateCategoriesUI)
        const uniquePasswords = [];
        const seenHashIds = new Set();
        let removedCount = 0;
        
        passwords.forEach(pwd => {
            const hashId = pwd._hashId;
            if (hashId && !seenHashIds.has(hashId)) {
                seenHashIds.add(hashId);
                uniquePasswords.push(pwd);
            } else if (hashId) {
                // Duplicate found - skip it
                removedCount++;
            } else {
                // Keep records without hashId (shouldn't happen after migration, but just in case)
                uniquePasswords.push(pwd);
            }
        });
        
        if (removedCount > 0) {
            passwords = uniquePasswords;
            if (typeof logWarn === 'function') {
                logWarn('Duplicate passwords removed after load (by Hash ID)', {
                    removedPasswords: removedCount
                });
            }
        } else {
            passwords = uniquePasswords;
        }
        
        // Restore delete without confirmation checkbox state from decrypted data
        const checkbox = document.getElementById('deleteWithoutConfirm');
        if (checkbox) {
            // New architecture: deleteWithoutConfirm is inside encrypted data
            if (data.deleteWithoutConfirm !== undefined) {
                checkbox.checked = data.deleteWithoutConfirm;
            } else {
                // Legacy: try to get from localStorage
                const legacyKeys = getUserStorageKeys(targetUserId);
                const legacyDeleteWithoutConfirm = localStorage.getItem(legacyKeys.deleteWithoutConfirm);
                if (legacyDeleteWithoutConfirm !== null) {
                    checkbox.checked = legacyDeleteWithoutConfirm === 'true';
                } else {
                    checkbox.checked = false; // Default
                }
            }
        }
        
        // Log load operation
        const version = data.version || parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
        
        if (typeof logDataLoad === 'function') {
            logDataLoad('loadFromLocalStorage', {
                categoriesCount: passwordCategories.length,
                passwordsCount: passwords.length,
                version: version,
                source: loginType,
                beforeCategoriesCount: beforeCategoriesCount,
                beforePasswordsCount: beforePasswordsCount,
                loginType: loginType
            });
        }
        
        // Return metadata
        return {
            userId: data.userId || targetUserId,
            loginType: loginType,
            version: version,
            googleToken: googleTokenData
        };
    } catch (error) {
        console.error('Error loading data:', error);
        if (typeof logError === 'function') {
            logError('Error loading data', { error: error.message, stack: error.stack });
        }
        throw new Error('Invalid master key entered');
    }
}

// Debounce timer for saveToLocalStorage
let saveToLocalStorageTimer = null;

// Save to localStorage with encryption (new architecture)
async function saveToLocalStorage(incrementVersion = true, debounceMs = 500) {
    if (!encryptionKey || !currentUserLogin) {
        console.error('Encryption key or user login not set');
        if (typeof logError === 'function') {
            logError('Encryption key or user login not set');
        }
        return;
    }
    
    // Debounce: cancel previous save if called too frequently
    if (saveToLocalStorageTimer) {
        clearTimeout(saveToLocalStorageTimer);
    }
    
    // If debounce is disabled (debounceMs = 0), save immediately
    if (debounceMs === 0) {
        return await performSaveToLocalStorage(incrementVersion);
    }
    
    // Otherwise, debounce the save
    return new Promise((resolve, reject) => {
        saveToLocalStorageTimer = setTimeout(async () => {
            try {
                await performSaveToLocalStorage(incrementVersion);
                resolve();
            } catch (error) {
                reject(error);
            }
        }, debounceMs);
    });
}

// Actual save function (internal)
async function performSaveToLocalStorage(incrementVersion = true) {
    if (!encryptionKey || !currentUserLogin) {
        console.error('Encryption key or user login not set');
        if (typeof logError === 'function') {
            logError('Encryption key or user login not set');
        }
        return;
    }
    
    try {
        // Ensure all passwords have Hash ID before saving
        for (let i = 0; i < passwords.length; i++) {
            const pwd = passwords[i];
            if (!pwd._hashId) {
                // Generate Hash ID for records without it (shouldn't happen, but just in case)
                const randomBytes = new Uint8Array(32);
                crypto.getRandomValues(randomBytes);
                const binaryString = String.fromCharCode(...randomBytes);
                pwd._hashId = btoa(binaryString);
            }
        }
        
        // Remove duplicate passwords by Hash ID (categories duplicates are handled visually in updateCategoriesUI)
        const uniquePasswords = [];
        const seenHashIds = new Set();
        let removedCount = 0;
        
        passwords.forEach(pwd => {
            const hashId = pwd._hashId;
            if (hashId && !seenHashIds.has(hashId)) {
                seenHashIds.add(hashId);
                uniquePasswords.push(pwd);
            } else if (hashId) {
                // Duplicate found - skip it
                removedCount++;
            } else {
                // Keep records without hashId (shouldn't happen, but just in case)
                uniquePasswords.push(pwd);
            }
        });
        
        if (removedCount > 0) {
            passwords = uniquePasswords;
            if (typeof logWarn === 'function') {
                logWarn('Duplicate passwords removed before save (by Hash ID)', {
                    removedPasswords: removedCount
                });
            }
        } else {
            passwords = uniquePasswords;
        }
        
        // Get deleteWithoutConfirm from UI
        const deleteWithoutConfirmCheckbox = document.getElementById('deleteWithoutConfirm');
        const deleteWithoutConfirm = deleteWithoutConfirmCheckbox ? deleteWithoutConfirmCheckbox.checked : false;
        
        // Prepare data structure with metadata
        // Remove _isDraft flags before saving (they are only for current session)
        const passwordsToSave = passwords.map(pwd => {
            const { _isDraft, ...pwdWithoutDraft } = pwd;
            return pwdWithoutDraft;
        });
        
        const dataToSave = {
            userId: currentUserLogin,
            displayName: currentUserLogin, // Can be changed later
            loginType: isGoogleSignIn ? 'Google' : 'Local',
            passwordCategories: passwordCategories,
            passwords: passwordsToSave, // Save without _isDraft flags
            passwordsVisible: passwordsVisible,
            deleteWithoutConfirm: deleteWithoutConfirm, // UI setting - now encrypted
            googleToken: isGoogleSignIn ? {
                accessToken: googleDriveAccessToken,
                refreshToken: googleDriveRefreshToken,
                fileId: googleDriveFileId,
                email: googleDriveUserEmail
            } : null,
            version: parseInt(localStorage.getItem(getUserDataKey(currentUserLogin) + '_version') || '0', 10),
            modifiedAt: new Date().toISOString()
        };
        
        // Check if there are any non-draft passwords (with actual data)
        const hasNonDraftPasswords = passwords.some(pwd => {
            if (pwd._isDraft) return false; // Skip draft entries
            const service = getPasswordField(pwd, 'SERVICE');
            const login = getPasswordField(pwd, 'LOGIN');
            const password = getPasswordField(pwd, 'PASSWORD');
            // Consider entry as non-draft if it has at least one field filled
            return (service && service.trim() !== '') || 
                   (login && login.trim() !== '') || 
                   (password && password.trim() !== '');
        });
        
        // Handle version increment and sync marking
        if (incrementVersion) {
            // Check if debounce timer is already running (meaning we're in the middle of a change batch)
            // syncDebounceTimer is defined in state.js, check if it exists and is active
            const isDebounceActive = typeof syncDebounceTimer !== 'undefined' && syncDebounceTimer !== null;
            
            if (!isDebounceActive) {
                // First change in batch - increment version now
                dataToSave.version = dataToSave.version + 1;
                console.log(`saveToLocalStorage: incrementing version ${dataToSave.version - 1} -> ${dataToSave.version}`);
            } else {
                // Subsequent change in batch - don't increment yet, will increment when debounce completes
                // Set flag to increment version on sync
                if (typeof versionNeedsIncrement !== 'undefined') {
                    versionNeedsIncrement = true;
                }
                console.log(`saveToLocalStorage: version NOT incremented yet (debounce active, will increment on sync)`);
            }
            
            // Mark changes for Google Drive synchronization only if there are non-draft entries
            if (hasNonDraftPasswords && typeof markDataChanged === 'function') {
                markDataChanged(); // Use debounce (not immediate)
            } else if (!hasNonDraftPasswords) {
                console.log('saveToLocalStorage: Only draft entries present - skipping sync');
            }
        } else {
            console.log(`saveToLocalStorage: version NOT incremented (loading from cloud)`);
        }
        
        const jsonData = JSON.stringify(dataToSave);
        const dataSize = new Blob([jsonData]).size;
        const encryptedData = await encryptData(jsonData);
        
        // Calculate Hash Version (hash of encrypted data for conflict detection)
        const hashVersion = await calculateDataHash(encryptedData);
        
        // Save using new architecture
        const dataKey = getUserDataKey(currentUserLogin);
        localStorage.setItem(dataKey, encryptedData);
        
        // Save salt separately (needed for decryption, not sensitive alone)
        // Salt is already saved in initializeEncryption, but ensure it's there
        const keys = getUserStorageKeys(currentUserLogin);
        const existingSalt = localStorage.getItem(keys.encryptionSalt);
        if (existingSalt) {
            localStorage.setItem(dataKey + '_salt', existingSalt);
        }
        
        // Save version separately for quick access (not encrypted, but not sensitive)
        localStorage.setItem(dataKey + '_version', dataToSave.version.toString());
        
        // Save Hash Version separately for conflict detection
        localStorage.setItem(dataKey + '_hashVersion', hashVersion);
        
        // deleteWithoutConfirm is now inside encrypted data, no need to save separately
        
        // Set active user
        setActiveUserId(currentUserLogin);
        
        // Update sync status to show new version (if Cloud Sync is enabled)
        if (incrementVersion && typeof updateSyncStatus === 'function') {
            // Use setTimeout to ensure UI update happens after save completes
            setTimeout(() => {
                updateSyncStatus();
            }, 0);
        }
        
        // Log save operation
        if (typeof logDataSave === 'function') {
            logDataSave('saveToLocalStorage', {
                categoriesCount: passwordCategories.length,
                passwordsCount: passwords.length,
                version: dataToSave.version,
                dataSize: `${(dataSize / 1024).toFixed(2)} KB`,
                loginType: dataToSave.loginType
            });
        }
    } catch (error) {
        console.error('Error saving data:', error);
        if (typeof logError === 'function') {
            logError('Error saving data', { error: error.message, stack: error.stack });
        }
        alert('Error saving data. Please try again.');
    }
}

// Force immediate save (no debounce)
async function saveToLocalStorageImmediate(incrementVersion = true) {
    return await saveToLocalStorage(incrementVersion, 0);
}

