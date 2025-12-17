// Google Drive Sync Module
// Handles bidirectional synchronization, version management, and master key validation

/**
 * Merge passwords by Hash ID (for synchronization)
 * @param {Array} localPasswords - Local passwords array
 * @param {Array} cloudPasswords - Cloud passwords array
 * @returns {Array} Merged passwords array
 */
function mergePasswordsByHashId(localPasswords, cloudPasswords) {
    const mergedMap = new Map();
    
    // Add local passwords to map by Hash ID
    localPasswords.forEach(pwd => {
        const hashId = pwd._hashId;
        if (hashId) {
            mergedMap.set(hashId, { ...pwd, _source: 'local' });
        } else {
            // If no hashId, generate one and add
            const randomBytes = new Uint8Array(32);
            crypto.getRandomValues(randomBytes);
            const binaryString = String.fromCharCode(...randomBytes);
            pwd._hashId = btoa(binaryString);
            mergedMap.set(pwd._hashId, { ...pwd, _source: 'local' });
        }
    });
    
    // Merge cloud passwords by Hash ID
    cloudPasswords.forEach(cloudPwd => {
        const hashId = cloudPwd._hashId;
        if (hashId) {
            if (mergedMap.has(hashId)) {
                // Record exists in both - keep cloud version (newer)
                mergedMap.set(hashId, { ...cloudPwd, _source: 'cloud' });
            } else {
                // New record from cloud
                mergedMap.set(hashId, { ...cloudPwd, _source: 'cloud' });
            }
        } else {
            // Cloud record without hashId - generate one and add
            const randomBytes = new Uint8Array(32);
            crypto.getRandomValues(randomBytes);
            const binaryString = String.fromCharCode(...randomBytes);
            cloudPwd._hashId = btoa(binaryString);
            mergedMap.set(cloudPwd._hashId, { ...cloudPwd, _source: 'cloud' });
        }
    });
    
    // Convert map to array and remove _source field
    const merged = Array.from(mergedMap.values()).map(pwd => {
        const { _source, ...pwdWithoutSource } = pwd;
        return pwdWithoutSource;
    });
    
    return merged;
}

/**
 * Merge categories (unique, case-insensitive)
 * @param {Array} localCategories - Local categories array
 * @param {Array} cloudCategories - Cloud categories array
 * @returns {Array} Merged categories array
 */
function mergeCategories(localCategories, cloudCategories) {
    const categorySet = new Set();
    const merged = [];
    
    // Add local categories
    localCategories.forEach(cat => {
        const key = cat.toLowerCase();
        if (!categorySet.has(key)) {
            categorySet.add(key);
            merged.push(cat);
        }
    });
    
    // Add cloud categories
    cloudCategories.forEach(cat => {
        const key = cat.toLowerCase();
        if (!categorySet.has(key)) {
            categorySet.add(key);
            merged.push(cat);
        }
    });
    
    return merged;
}

/**
 * Merge cloud data to local storage (used when user explicitly chooses download)
 * @param {Object} cloudData - Cloud data object
 * @param {string} userId - User ID
 * @param {string} masterKey - Master key
 * @param {number} cloudVersion - Cloud version
 * @returns {Promise<void>}
 */
async function mergeCloudDataToLocal(cloudData, userId, masterKey, cloudVersion) {
    const dataKey = getUserDataKey(userId);
    
    // Save salt first (needed for decryption)
    if (cloudData.encryptionSalt) {
        localStorage.setItem(dataKey + '_salt', cloudData.encryptionSalt);
        // Also save in legacy format for compatibility
        const keys = getUserStorageKeys(userId);
        localStorage.setItem(keys.encryptionSalt, cloudData.encryptionSalt);
    }
    
    // If encryptedData is empty, don't overwrite local data
    if (cloudData.encryptedData && cloudData.encryptedData.trim() !== '') {
        // Decrypt cloud data temporarily for merge
        const salt = Uint8Array.from(atob(cloudData.encryptionSalt), c => c.charCodeAt(0));
        const combinedKey = userId + masterKey;
        const tempEncryptionKey = await deriveKeyFromPassword(combinedKey, salt);
        
        const originalEncryptionKey = encryptionKey;
        encryptionKey = tempEncryptionKey;
        
        const decryptedCloudData = await decryptData(cloudData.encryptedData);
        const cloudDataObj = JSON.parse(decryptedCloudData);
        
        // Restore original encryption key
        encryptionKey = originalEncryptionKey;
        
        // Merge passwords by Hash ID
        const mergedPasswords = mergePasswordsByHashId(passwords, cloudDataObj.passwords || []);
        
        // Update local passwords with merged data
        passwords = mergedPasswords;
        
        // Merge categories (keep unique, case-insensitive)
        const mergedCategories = mergeCategories(passwordCategories, cloudDataObj.passwordCategories || []);
        passwordCategories = mergedCategories;
        
        // Calculate cloud hash version
        const cloudHashVersion = cloudData.encryptedData ? await calculateDataHash(cloudData.encryptedData) : null;
        
        // Update version and hashVersion to cloud version BEFORE saving (so saveToLocalStorage doesn't overwrite it)
        localStorage.setItem(dataKey + '_version', cloudVersion.toString());
        if (cloudHashVersion) {
            localStorage.setItem(dataKey + '_hashVersion', cloudHashVersion);
        }
        
        // Save merged data (version already set to cloud version)
        await saveToLocalStorage(false, 0); // Don't increment version, no debounce
        
        // Ensure version is still correct after save
        const versionAfterSave = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
        if (versionAfterSave !== cloudVersion) {
            console.warn(`Version changed after save, correcting: ${versionAfterSave} -> ${cloudVersion}`);
            localStorage.setItem(dataKey + '_version', cloudVersion.toString());
        }
    } else {
        // Empty file - just update version, keep local data
        localStorage.setItem(dataKey + '_version', cloudVersion.toString());
        console.log('Cloud file is empty, keeping local data');
    }

    const finalVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
    if (finalVersion !== cloudVersion) {
        console.error(`ERROR: Version changed after loading from cloud! Was expecting ${cloudVersion}, got ${finalVersion}`);
        localStorage.setItem(dataKey + '_version', cloudVersion.toString());
    }

    // Update cloud metadata tracking after successful download
    // This ensures that next sync won't detect a false conflict
    if (typeof getGoogleDriveFileMetadata === 'function') {
        const cloudMetadata = await getGoogleDriveFileMetadata();
        if (cloudMetadata) {
            lastCloudModifiedTime = cloudMetadata.modifiedTime;
            // Use cloud hash version (from cloudData.encryptedData) for tracking
            const cloudHashVersion = cloudData.encryptedData ? await calculateDataHash(cloudData.encryptedData) : null;
            if (cloudHashVersion) {
                lastCloudHashVersion = cloudHashVersion;
            }
            
            // Also save to localStorage for persistence across page refreshes
            localStorage.setItem(dataKey + '_lastCloudModifiedTime', cloudMetadata.modifiedTime);
            if (cloudHashVersion) {
                localStorage.setItem(dataKey + '_lastCloudHashVersion', cloudHashVersion);
            }
            
            console.log('Updated last known cloud metadata after download:', {
                modifiedTime: lastCloudModifiedTime,
                hashVersion: lastCloudHashVersion ? lastCloudHashVersion.substring(0, 8) + '...' : 'none'
            });
        }
    }

    if (typeof updateCategoriesUI === 'function') {
        updateCategoriesUI();
    }
    if (typeof updateTable === 'function') {
        updateTable();
    }

    updateGoogleDriveStatus(`Synced from cloud ${new Date().toLocaleTimeString()}`);
    
    // Update sync status to show new version number from cloud
    if (typeof updateSyncStatus === 'function') {
        await updateSyncStatus();
    }
}

/**
 * Get statistics from encrypted data (without modifying current state)
 * @param {string} encryptedData - Encrypted data string
 * @param {string} saltBase64 - Encryption salt in base64
 * @param {string} userId - User ID
 * @param {string} masterKey - Master key
 * @returns {Promise<Object>} Statistics object
 */
async function getDataStatistics(encryptedData, saltBase64, userId, masterKey) {
    try {
        if (!encryptedData || encryptedData.trim() === '') {
            return {
                categoriesCount: 0,
                passwordsCount: 0,
                dataSize: '0 KB',
                isEmpty: true
            };
        }

        // Create temporary encryption key
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const combinedKey = userId + masterKey;
        const tempEncryptionKey = await deriveKeyFromPassword(combinedKey, salt);
        
        // Decrypt data temporarily
        const originalEncryptionKey = encryptionKey;
        encryptionKey = tempEncryptionKey;
        
        const decryptedData = await decryptData(encryptedData);
        const data = JSON.parse(decryptedData);
        
        // Restore original encryption key
        encryptionKey = originalEncryptionKey;
        
        const categoriesCount = data.passwordCategories ? data.passwordCategories.length : 0;
        const passwordsCount = data.passwords ? data.passwords.length : 0;
        const dataSize = (encryptedData.length / 1024).toFixed(2) + ' KB';
        
        return {
            categoriesCount,
            passwordsCount,
            dataSize,
            isEmpty: false,
            version: data.version || 0
        };
    } catch (error) {
        console.error('Error getting data statistics:', error);
        return {
            categoriesCount: 0,
            passwordsCount: 0,
            dataSize: '0 KB',
            isEmpty: true,
            error: error.message
        };
    }
}

/**
 * Show confirmation dialog for sync direction selection
 * @param {Object} localStats - Local data statistics
 * @param {Object} cloudStats - Cloud data statistics
 * @param {number} localVersion - Local version
 * @param {number} cloudVersion - Cloud version
 * @returns {Promise<string>} 'upload', 'download', or 'cancel'
 */
async function confirmSyncDirection(localStats, cloudStats, localVersion, cloudVersion) {
    return new Promise((resolve) => {
        // Hide any existing master password modals to avoid conflicts
        const masterPasswordModal = document.getElementById('masterPasswordModal');
        if (masterPasswordModal) {
            masterPasswordModal.style.display = 'none';
        }
        const masterKeyOnlyModal = document.getElementById('masterKeyOnlyModal');
        if (masterKeyOnlyModal) {
            masterKeyOnlyModal.style.display = 'none';
        }
        
        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'master-password-modal';
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';
        
        const content = document.createElement('div');
        content.className = 'master-password-content';
        content.style.maxWidth = '700px';
        
        const title = document.createElement('h2');
        title.textContent = 'Sync Conflict Detected';
        title.style.marginBottom = '20px';
        
        const message = document.createElement('p');
        message.style.marginBottom = '20px';
        message.style.color = '#ff9800';
        
        if (localVersion > cloudVersion) {
            message.textContent = `Local version (v${localVersion}) is newer than cloud version (v${cloudVersion}). Choose sync direction:`;
        } else if (cloudVersion > localVersion) {
            message.textContent = `Cloud version (v${cloudVersion}) is newer than local version (v${localVersion}). Choose sync direction:`;
        } else {
            message.textContent = `Versions differ. Choose sync direction:`;
        }
        
        // Statistics table
        const statsTable = document.createElement('table');
        statsTable.style.width = '100%';
        statsTable.style.marginBottom = '20px';
        statsTable.style.borderCollapse = 'collapse';
        
        const headerRow = document.createElement('tr');
        headerRow.style.backgroundColor = '#f5f5f5';
        const headers = ['', 'Local', 'Cloud'];
        headers.forEach(headerText => {
            const th = document.createElement('th');
            th.textContent = headerText;
            th.style.padding = '10px';
            th.style.border = '1px solid #ddd';
            th.style.textAlign = 'left';
            headerRow.appendChild(th);
        });
        statsTable.appendChild(headerRow);
        
        const rows = [
            ['Version', `v${localVersion}`, `v${cloudVersion}`],
            ['Categories', localStats.categoriesCount.toString(), cloudStats.categoriesCount.toString()],
            ['Passwords', localStats.passwordsCount.toString(), cloudStats.passwordsCount.toString()],
            ['Data Size', localStats.dataSize, cloudStats.dataSize]
        ];
        
        rows.forEach(rowData => {
            const row = document.createElement('tr');
            rowData.forEach((cellText, index) => {
                const td = document.createElement('td');
                td.textContent = cellText;
                td.style.padding = '10px';
                td.style.border = '1px solid #ddd';
                if (index === 0) {
                    td.style.fontWeight = 'bold';
                }
                row.appendChild(td);
            });
            statsTable.appendChild(row);
        });
        
        const warning = document.createElement('p');
        warning.style.marginBottom = '20px';
        warning.style.color = '#f44336';
        warning.style.fontSize = '14px';
        warning.textContent = 'Warning: This action will overwrite data. This cannot be undone.';
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.className = 'master-password-buttons';
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.gap = '10px';
        buttonsDiv.style.justifyContent = 'center';
        buttonsDiv.style.flexWrap = 'wrap';
        
        const uploadBtn = document.createElement('button');
        uploadBtn.textContent = 'Upload Local Data';
        uploadBtn.className = 'master-password-submit';
        uploadBtn.style.backgroundColor = '#4CAF50';
        uploadBtn.style.flex = '1';
        uploadBtn.style.minWidth = '150px';
        uploadBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve('upload');
        };
        
        const downloadBtn = document.createElement('button');
        downloadBtn.textContent = 'Download Cloud Data';
        downloadBtn.className = 'master-password-submit';
        downloadBtn.style.backgroundColor = '#2196F3';
        downloadBtn.style.flex = '1';
        downloadBtn.style.minWidth = '150px';
        downloadBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve('download');
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'master-password-cancel';
        cancelBtn.style.flex = '1';
        cancelBtn.style.minWidth = '150px';
        cancelBtn.onclick = () => {
            document.body.removeChild(modal);
            resolve('cancel');
        };
        
        buttonsDiv.appendChild(uploadBtn);
        buttonsDiv.appendChild(downloadBtn);
        buttonsDiv.appendChild(cancelBtn);
        
        content.appendChild(title);
        content.appendChild(message);
        content.appendChild(statsTable);
        content.appendChild(warning);
        content.appendChild(buttonsDiv);
        
        modal.appendChild(content);
        document.body.appendChild(modal);
    });
}

/**
 * Validate master key for cloud data before decryption
 * @param {Object} cloudData - Cloud data object
 * @returns {Promise<void>}
 * @throws {Error} If master key is incorrect
 */
async function validateMasterKeyForCloudData(cloudData) {
    if (!masterKey || !currentUserLogin || !cloudData.encryptionSalt) {
        return; // Skip validation if no master key or salt
    }

    try {
        // Use salt from cloud to create encryption key
        const salt = Uint8Array.from(atob(cloudData.encryptionSalt), c => c.charCodeAt(0));
        const combinedKey = currentUserLogin + masterKey;
        const tempEncryptionKey = await deriveKeyFromPassword(combinedKey, salt);
        
        // Temporarily set encryption key for decryption test
        const originalEncryptionKey = encryptionKey;
        encryptionKey = tempEncryptionKey;
        
        // Try to decrypt cloud data
        await decryptData(cloudData.encryptedData);
        
        // Restore original encryption key (will be set properly after loading)
        encryptionKey = originalEncryptionKey;
    } catch (decryptError) {
        // Key is incorrect - show only master key input
        console.error('Master key is incorrect for cloud data');
        const errorDiv = document.getElementById('masterPasswordError');
        const modal = document.getElementById('masterPasswordModal');
        const loginInput = document.getElementById('userLoginInput');
        const masterKeyInput = document.getElementById('masterPasswordInput');
        const submitBtn = document.getElementById('masterPasswordSubmit');
        const mainContainer = document.getElementById('mainContainer');
        
        // Hide main container
        if (mainContainer) {
            mainContainer.style.display = 'none';
        }
        
        // Show modal with only master key input
        if (modal) {
            modal.style.display = 'flex';
        }
        
        // Hide login input, show only master key
        if (loginInput) {
            loginInput.style.display = 'none';
        }
        if (submitBtn) {
            submitBtn.style.display = 'none';
        }
        if (masterKeyInput) {
            masterKeyInput.placeholder = 'Master key (for Google Drive data)';
            masterKeyInput.value = '';
            masterKeyInput.focus();
        }
        
        if (errorDiv) {
            errorDiv.textContent = 'Master key is incorrect. Please enter the correct master key.';
            errorDiv.style.display = 'block';
        }
        
        // Reset state
        encryptionKey = null;
        masterKey = null;
        currentUserLogin = null;
        isGoogleSignIn = false;
        // Clear sync timers
        if (syncDebounceTimer) {
            clearTimeout(syncDebounceTimer);
            syncDebounceTimer = null;
        }
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }
        
        // Don't throw - just return to let user enter correct key
        throw new Error('Master key is incorrect for data in cloud');
    }
}

/**
 * Process cloud data and sync to local storage
 * @param {Object} cloudData - Cloud data object
 * @returns {Promise<void>}
 */
async function processCloudData(cloudData) {
    const dataKey = getUserDataKey(currentUserLogin);
    const cloudVersion = parseInt(cloudData.version || '0', 10);
    let localVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
    
    // Get Hash Versions for comparison
    const localEncryptedData = localStorage.getItem(dataKey);
    const localHashVersion = localEncryptedData ? await calculateDataHash(localEncryptedData) : null;
    const cloudHashVersion = cloudData.encryptedData ? await calculateDataHash(cloudData.encryptedData) : null;

    console.log(`Sync: Local v${localVersion} (hash: ${localHashVersion ? localHashVersion.substring(0, 8) + '...' : 'none'}) vs Cloud v${cloudVersion} (hash: ${cloudHashVersion ? cloudHashVersion.substring(0, 8) + '...' : 'none'})`);
    
    // Check conflict based on version and hash comparison rules
    const versionsMatch = localVersion === cloudVersion;
    const hashesMatch = localHashVersion && cloudHashVersion && localHashVersion === cloudHashVersion;
    
    // Rule 1: Versions match AND hashes match - data is identical, no sync needed
    if (versionsMatch && hashesMatch) {
        console.log(`= Versions and hashes match (v${cloudVersion}), data identical - no sync needed`);
        return;
    }
    
    // Rule 2: Versions match BUT hashes differ - content conflict detected
    if (versionsMatch && !hashesMatch) {
        console.log(`-> Content conflict detected: Versions match (v${cloudVersion}) but hashes differ`);
    }
    
    // Rule 3: Versions differ - always show dialog (regardless of hash)
    if (!versionsMatch) {
        console.log(`-> Version conflict detected: Local v${localVersion} vs Cloud v${cloudVersion}`);
    }

    // Get statistics for both local and cloud data
    const localSalt = localStorage.getItem(dataKey + '_salt') || 
                     localStorage.getItem(getUserStorageKeys(currentUserLogin).encryptionSalt);
    
    // Get local statistics (from current decrypted data)
    const localStats = {
        categoriesCount: passwordCategories ? passwordCategories.length : 0,
        passwordsCount: passwords ? passwords.length : 0,
        dataSize: localEncryptedData ? (localEncryptedData.length / 1024).toFixed(2) + ' KB' : '0 KB',
        isEmpty: !localEncryptedData || localEncryptedData.trim() === ''
    };
    
    // Get cloud statistics
    let cloudStats = {
        categoriesCount: 0,
        passwordsCount: 0,
        dataSize: '0 KB',
        isEmpty: true
    };
    
    if (cloudData.encryptedData && cloudData.encryptionSalt && masterKey && currentUserLogin) {
        try {
            cloudStats = await getDataStatistics(
                cloudData.encryptedData,
                cloudData.encryptionSalt,
                currentUserLogin,
                masterKey
            );
        } catch (error) {
            console.error('Error getting cloud statistics:', error);
            cloudStats.error = error.message;
        }
    }
    
    // Show confirmation dialog if conflict detected (versions differ OR versions match but hashes differ)
    if (!versionsMatch || (versionsMatch && !hashesMatch)) {
        // Log detailed statistics
        if (typeof logWarn === 'function') {
            logWarn('Sync conflict detected', {
                localVersion: localVersion,
                cloudVersion: cloudVersion,
                versionsMatch: versionsMatch,
                hashesMatch: hashesMatch,
                localStats: localStats,
                cloudStats: cloudStats
            });
        }
        
        console.log('Local data statistics:', localStats);
        console.log('Cloud data statistics:', cloudStats);
        
        // Hide any master key modals before showing sync dialog
        const masterPasswordModal = document.getElementById('masterPasswordModal');
        if (masterPasswordModal) {
            masterPasswordModal.style.display = 'none';
        }
        const masterKeyOnlyModal = document.getElementById('masterKeyOnlyModal');
        if (masterKeyOnlyModal) {
            masterKeyOnlyModal.style.display = 'none';
        }
        
        // Show confirmation dialog
        console.log('Showing sync direction confirmation dialog...');
        const syncDirection = await confirmSyncDirection(localStats, cloudStats, localVersion, cloudVersion);
        console.log('User selected sync direction:', syncDirection);
        
        if (syncDirection === 'cancel') {
            console.log('User cancelled sync - switching to local mode');
            // Switch to local mode (disable cloud sync)
            isGoogleSignIn = false;
            googleDriveAccessToken = null;
            googleDriveRefreshToken = null;
            googleDriveFileId = null;
            // Clear sync timers
            if (syncDebounceTimer) {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = null;
            }
            if (syncTimer) {
                clearInterval(syncTimer);
                syncTimer = null;
            }
            // Update status to show local sync
            updateGoogleDriveStatus('Switched to local mode');
            if (typeof updateSyncStatus === 'function') {
                await updateSyncStatus();
            }
            return;
        } else if (syncDirection === 'upload') {
            // Upload local data to cloud
            console.log(`-> Uploading local data to cloud (v${localVersion} > v${cloudVersion}) - User confirmed`);
            // Skip metadata check since user already chose direction
            await syncToGoogleDrive(true, true);
            return;
        } else if (syncDirection === 'download') {
            // Download cloud data to local
            console.log(`-> Downloading cloud data to local (v${cloudVersion} > v${localVersion}) - User confirmed`);
            // Continue with download logic below
        } else {
            // Should not happen, but handle gracefully
            console.log('Unknown sync direction, cancelling');
            return;
        }
    }
    
    // If we reach here, either versions are equal or user chose to download
    // Merge cloud data with local data using Hash ID
    if (cloudVersion >= localVersion || (localVersion !== cloudVersion && cloudVersion > 0)) {
        // Cloud is newer or user chose download - merge with cloud
        console.log(`-> Merging cloud data with local (v${cloudVersion} >= v${localVersion})`);
        
        // Save salt first (needed for decryption)
        if (cloudData.encryptionSalt) {
            localStorage.setItem(dataKey + '_salt', cloudData.encryptionSalt);
            // Also save in legacy format for compatibility
            const keys = getUserStorageKeys(currentUserLogin);
            localStorage.setItem(keys.encryptionSalt, cloudData.encryptionSalt);
        }
        
        // If encryptedData is empty, don't overwrite local data
        if (cloudData.encryptedData && cloudData.encryptedData.trim() !== '') {
            // Decrypt cloud data temporarily for merge
            const salt = Uint8Array.from(atob(cloudData.encryptionSalt), c => c.charCodeAt(0));
            const combinedKey = currentUserLogin + masterKey;
            const tempEncryptionKey = await deriveKeyFromPassword(combinedKey, salt);
            
            const originalEncryptionKey = encryptionKey;
            encryptionKey = tempEncryptionKey;
            
            const decryptedCloudData = await decryptData(cloudData.encryptedData);
            const cloudDataObj = JSON.parse(decryptedCloudData);
            
            // Restore original encryption key
            encryptionKey = originalEncryptionKey;
            
            // Merge passwords by Hash ID
            const mergedPasswords = mergePasswordsByHashId(passwords, cloudDataObj.passwords || []);
            
            // Update local passwords with merged data
            passwords = mergedPasswords;
            
            // Merge categories (keep unique, case-insensitive)
            const mergedCategories = mergeCategories(passwordCategories, cloudDataObj.passwordCategories || []);
            passwordCategories = mergedCategories;
            
            // Update version and hashVersion to cloud version BEFORE saving (so saveToLocalStorage doesn't overwrite it)
            localStorage.setItem(dataKey + '_version', cloudVersion.toString());
            if (cloudHashVersion) {
                localStorage.setItem(dataKey + '_hashVersion', cloudHashVersion);
            }
            
            // Save merged data (version already set to cloud version)
            await saveToLocalStorage(false, 0); // Don't increment version, no debounce
            console.log('Merged data saved to localStorage');
            
            // Ensure version is still correct after save
            const versionAfterSave = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
            if (versionAfterSave !== cloudVersion) {
                console.warn(`Version changed after save, correcting: ${versionAfterSave} -> ${cloudVersion}`);
                localStorage.setItem(dataKey + '_version', cloudVersion.toString());
            }
        } else {
            // Empty file - just update version, keep local data
            localStorage.setItem(dataKey + '_version', cloudVersion.toString());
            console.log('Cloud file is empty, keeping local data');
        }

        const finalVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
        if (finalVersion !== cloudVersion) {
            console.error(`ERROR: Version changed after loading from cloud! Was expecting ${cloudVersion}, got ${finalVersion}`);
            localStorage.setItem(dataKey + '_version', cloudVersion.toString());
        }

        console.log('After merge: About to update cloud metadata tracking...');
        console.log('cloudHashVersion available:', cloudHashVersion ? cloudHashVersion.substring(0, 8) + '...' : 'null');
        console.log('dataKey:', dataKey);
        
        // Update cloud metadata tracking after successful download/merge
        // This ensures that next sync won't detect a false conflict
        // Use the cloudHashVersion calculated at the start of processCloudData (from original cloudData)
        // This represents the state of cloud data BEFORE merge, which is what we want to track
        console.log('Updating cloud metadata after download/merge...');
        if (typeof getGoogleDriveFileMetadata === 'function') {
            // Ensure token is valid before getting metadata
            if (typeof ensureValidGoogleToken === 'function') {
                console.log('Ensuring valid Google token before getting metadata...');
                await ensureValidGoogleToken();
            }
            
            console.log('Getting cloud file metadata...');
            const cloudMetadata = await getGoogleDriveFileMetadata();
            if (cloudMetadata) {
                lastCloudModifiedTime = cloudMetadata.modifiedTime;
                // Use cloud hash version for tracking (from the original cloudData we downloaded, before merge)
                // cloudHashVersion is calculated at the start of processCloudData function
                if (cloudHashVersion) {
                    lastCloudHashVersion = cloudHashVersion;
                }
                
                // Also save to localStorage for persistence across page refreshes
                localStorage.setItem(dataKey + '_lastCloudModifiedTime', cloudMetadata.modifiedTime);
                if (cloudHashVersion) {
                    localStorage.setItem(dataKey + '_lastCloudHashVersion', cloudHashVersion);
                }
                
                console.log('Updated last known cloud metadata after download/merge:', {
                    modifiedTime: lastCloudModifiedTime,
                    hashVersion: lastCloudHashVersion ? lastCloudHashVersion.substring(0, 8) + '...' : 'none'
                });
            } else {
                console.warn('Failed to get cloud metadata after download/merge - metadata is null');
            }
        } else {
            console.warn('getGoogleDriveFileMetadata function is not available');
        }

        if (typeof updateCategoriesUI === 'function') {
            updateCategoriesUI();
        }
        if (typeof updateTable === 'function') {
            updateTable();
        }

        updateGoogleDriveStatus(`Synced from cloud ${new Date().toLocaleTimeString()}`);
        
        // Update sync status to show new version number from cloud
        if (typeof updateSyncStatus === 'function') {
            await updateSyncStatus();
        }
    } else {
        // Versions same - already synchronized
        console.log(`= Data already synchronized (v${cloudVersion})`);
        updateGoogleDriveStatus(`Synchronized ${new Date().toLocaleTimeString()}`);
        
        // Update sync status to show current version number
        if (typeof updateSyncStatus === 'function') {
            await updateSyncStatus();
        }
    }
}

/**
 * Fetch cloud file data
 * @returns {Promise<Object|null>} Cloud data or null
 */
async function fetchCloudFile() {
    // Use fetchGoogleDriveFileData from googleDriveFileManager module
    if (typeof fetchGoogleDriveFileData === 'function') {
        return await fetchGoogleDriveFileData();
    }
    
    // Fallback if function not available
    if (!googleDriveAccessToken || !googleDriveFileId) {
        return null;
    }

    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${googleDriveFileId}?alt=media`, {
        headers: {
            'Authorization': `Bearer ${googleDriveAccessToken}`
        }
    });

    if (!response.ok) {
        if (response.status === 404) {
            return null; // File not found
        }
        throw new Error(`Download error: ${response.status}`);
    }

    const responseText = await response.text();

    if (!responseText || responseText.trim() === '') {
        return null; // Empty file
    }

    let jsonData;
    try {
        jsonData = JSON.parse(responseText);
    } catch (parseError) {
        console.error('JSON parse error from Google Drive:', parseError);
        return null;
    }

    return jsonData;
}

/**
 * Validate cloud data format
 * @param {Object} data - Data to validate
 * @returns {boolean}
 */
function validateCloudDataFormat(data) {
    // Validate new format: userId, encryptedData, and encryptionSalt (encryptedData can be empty string for new files)
    if (data.userId && data.encryptedData !== undefined && data.encryptionSalt) {
        // Don't automatically import if belongs to another user
        if (data.userId !== currentUserLogin) {
            console.log('Google Drive data belongs to a different user');
            return false;
        }
        return true;
    }
    return false;
}

/**
 * Handle sync error
 * @param {Error} error - Error object
 * @returns {Promise<void>}
 */
async function handleSyncError(error) {
    console.error('Error loading from Google Drive:', error);
    updateGoogleDriveStatus('Sync error');
    
    // If master key error, don't create default file
    if (error.message && error.message.includes('Master key is incorrect')) {
        throw error; // Re-throw to let caller handle
    }
    
    // For other errors, create default file
    await createDefaultDriveFile();
}

/**
 * Sync from Google Drive (main function)
 * @returns {Promise<void>}
 */
async function syncFromGoogleDrive() {
    if (!googleDriveAccessToken || !googleDriveFileId) {
        console.log('Google Drive not connected');
        return;
    }

    // Show sync animation
    showSyncAnimation();

    try {
        const cloudData = await fetchCloudFile();
        if (!cloudData) {
            console.log('File not found in Google Drive, will be created on next sync');
            await createDefaultDriveFile();
            hideSyncAnimation();
            // Reset cloud metadata tracking
            const dataKeyForReset = getUserDataKey(currentUserLogin);
            lastCloudModifiedTime = null;
            lastCloudHashVersion = null;
            localStorage.removeItem(dataKeyForReset + '_lastCloudModifiedTime');
            localStorage.removeItem(dataKeyForReset + '_lastCloudHashVersion');
            return;
        }
        
        if (!cloudData || cloudData.trim === '') {
            console.log('Google Drive file is empty, creating default file');
            await createDefaultDriveFile();
            hideSyncAnimation();
            return;
        }

        // Validate format
        if (!validateCloudDataFormat(cloudData)) {
            console.log('Google Drive file has invalid format, creating default file');
            await createDefaultDriveFile();
            hideSyncAnimation();
            return;
        }

        // IMPORTANT: Validate master key BEFORE loading data from cloud
        await validateMasterKeyForCloudData(cloudData);
        
        // Update last known cloud metadata after successful download (before processing)
        const dataKeyForMetadata = getUserDataKey(currentUserLogin);
        if (typeof getGoogleDriveFileMetadata === 'function') {
            const cloudMetadata = await getGoogleDriveFileMetadata();
            if (cloudMetadata) {
                lastCloudModifiedTime = cloudMetadata.modifiedTime;
                if (cloudData.hashVersion) {
                    lastCloudHashVersion = cloudData.hashVersion;
                }
                
                // Also save to localStorage for persistence across page refreshes
                localStorage.setItem(dataKeyForMetadata + '_lastCloudModifiedTime', cloudMetadata.modifiedTime);
                if (cloudData.hashVersion) {
                    localStorage.setItem(dataKeyForMetadata + '_lastCloudHashVersion', cloudData.hashVersion);
                }
                
                console.log('Updated last known cloud metadata after download:', {
                    modifiedTime: lastCloudModifiedTime,
                    hashVersion: lastCloudHashVersion ? lastCloudHashVersion.substring(0, 8) + '...' : 'none'
                });
            }
        }
        
        // Process and sync data
        await processCloudData(cloudData);

    } catch (error) {
        await handleSyncError(error);
    } finally {
        // Hide animation
        hideSyncAnimation();
    }
}

/**
 * Create default Google Drive file
 * @returns {Promise<void>}
 */
async function createDefaultDriveFile() {
    if (!googleDriveAccessToken || !googleDriveFileId || !currentUserLogin) {
        return;
    }

    try {
        // Get encrypted data from new architecture
        const dataKey = getUserDataKey(currentUserLogin);
        let encryptedData = localStorage.getItem(dataKey);

        // If no encrypted data exists, save default data first (with categories and Google tokens)
        if (!encryptedData && encryptionKey && currentUserLogin) {
            // Save default data structure with categories and Google tokens
            await saveToLocalStorageImmediate(true); // Save with version increment
            encryptedData = localStorage.getItem(dataKey);
        }

        let exportData;
        let currentVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
        const modifiedAt = new Date().toISOString();

        if (!encryptedData) {
            // Still no data - create empty file with version 1 (shouldn't happen, but safety check)
            currentVersion = 1;
            localStorage.setItem(dataKey + '_version', currentVersion.toString());

            // Get salt even if no encrypted data yet
            const saltBase64 = localStorage.getItem(dataKey + '_salt') || 
                              localStorage.getItem(getUserStorageKeys(currentUserLogin).encryptionSalt);
            
            exportData = {
                userId: currentUserLogin,
                encryptedData: '', // Empty - will be filled on first save
                encryptionSalt: saltBase64 || '', // Salt needed for decryption
                version: currentVersion,
                modifiedAt: modifiedAt,
                lastSync: new Date().toISOString()
            };
        } else {
            // Get salt
            const saltBase64 = localStorage.getItem(dataKey + '_salt') || 
                              localStorage.getItem(getUserStorageKeys(currentUserLogin).encryptionSalt);
            
            // Use existing encrypted data
            exportData = {
                userId: currentUserLogin,
                encryptedData: encryptedData,
                encryptionSalt: saltBase64 || '', // Salt needed for decryption
                version: currentVersion,
                modifiedAt: modifiedAt,
                lastSync: new Date().toISOString()
            };
        }

        // Upload data to file
        const updateResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${googleDriveFileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${googleDriveAccessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(exportData)
        });

        if (!updateResponse.ok) {
            throw new Error(`Error uploading default file: ${updateResponse.status}`);
        }

        console.log('Default Google Drive file created');
        updateGoogleDriveStatus(`File created ${new Date().toLocaleTimeString()}`);
    } catch (error) {
        console.error('Error creating default file:', error);
        updateGoogleDriveStatus('Error creating file');
    }
}

/**
 * Ensure Google access token is valid, refresh if needed
 * @returns {Promise<boolean>} True if token is valid, false otherwise
 */
async function ensureValidGoogleToken(providedMasterKey = null) {
    if (!googleDriveAccessToken) {
        console.log('ensureValidGoogleToken: No access token available');
        return false;
    }
    
    // Check if token is valid
    if (typeof checkGoogleTokenValidity === 'function') {
        console.log('ensureValidGoogleToken: Checking token validity...');
        const isValid = await checkGoogleTokenValidity(googleDriveAccessToken);
        if (isValid) {
            console.log('ensureValidGoogleToken: Token is valid');
            return true;
        }
        console.log('ensureValidGoogleToken: Token is invalid, attempting refresh...');
    } else {
        console.warn('ensureValidGoogleToken: checkGoogleTokenValidity function not available, assuming token is invalid');
    }
    
    // Token is invalid, try to refresh
    if (!googleDriveRefreshToken) {
        console.log('[SYNC] ensureValidGoogleToken: No refresh token available, attempting automatic re-authorization...', {
            hasAccessToken: !!googleDriveAccessToken,
            accessTokenLength: googleDriveAccessToken ? googleDriveAccessToken.length : 0,
            isGoogleSignIn: typeof isGoogleSignIn !== 'undefined' ? isGoogleSignIn : 'undefined',
            currentUserLogin: typeof currentUserLogin !== 'undefined' ? currentUserLogin : 'undefined',
            timestamp: new Date().toISOString()
        });
        
        // Automatically trigger Google re-authorization
        try {
            updateGoogleDriveStatus('Token expired - re-authorizing...');
            
            // Check if we have master key (user is already logged in)
            const masterKeyInput = document.getElementById('masterPasswordInput');
            let masterKey = providedMasterKey; // Use provided master key first
            
            // If no master key provided, check if masterKeyOnlyModal is visible (user entered master key there)
            if (!masterKey) {
                const masterKeyOnlyModal = document.getElementById('masterKeyOnlyModal');
                const masterKeyOnlyInput = document.getElementById('masterKeyOnlyInput');
                
                if (masterKeyOnlyModal && masterKeyOnlyModal.style.display !== 'none' && masterKeyOnlyInput && masterKeyOnlyInput.value) {
                    // Use master key from masterKeyOnlyModal
                    masterKey = masterKeyOnlyInput.value.trim();
                    console.log('[SYNC] ensureValidGoogleToken: Using master key from masterKeyOnlyModal');
                    // Hide masterKeyOnlyModal
                    masterKeyOnlyModal.style.display = 'none';
                }
            } else {
                console.log('[SYNC] ensureValidGoogleToken: Using provided master key');
            }
            
            // Show master key modal if not visible
            const modal = document.getElementById('masterPasswordModal');
            if (modal && modal.style.display === 'none') {
                modal.style.display = 'flex';
                // Hide login input, show only master key for Google sign-in
                const loginInput = document.getElementById('userLoginInput');
                const submitBtn = document.getElementById('masterPasswordSubmit');
                const createBtn = document.getElementById('masterPasswordCreate');
                const cancelBtn = document.getElementById('masterPasswordCancel');
                const confirmInput = document.getElementById('confirmPasswordInput');
                const createUserMessage = document.getElementById('createUserMessage');
                
                if (loginInput) loginInput.style.display = 'none';
                if (submitBtn) submitBtn.style.display = 'none';
                if (createBtn) createBtn.style.display = 'none';
                if (cancelBtn) cancelBtn.style.display = 'none';
                if (confirmInput) confirmInput.style.display = 'none';
                if (createUserMessage) createUserMessage.style.display = 'none';
                if (masterKeyInput) {
                    masterKeyInput.placeholder = 'Master key (for Google Drive data)';
                    // Pre-fill master key if we got it from masterKeyOnlyModal
                    if (masterKey) {
                        masterKeyInput.value = masterKey;
                    }
                    masterKeyInput.focus();
                }
            } else if (modal && modal.style.display !== 'none' && masterKey) {
                // Modal is already visible, but we have master key from masterKeyOnlyModal - pre-fill it
                if (masterKeyInput && !masterKeyInput.value) {
                    masterKeyInput.value = masterKey;
                }
            }
            
            // Check if master key is already entered (either in masterPasswordModal or masterKeyOnlyModal)
            if (masterKey) {
                // We have master key from masterKeyOnlyModal - proceed with re-authorization immediately
                // Don't show masterPasswordModal - we already have master key
                console.log('[SYNC] ensureValidGoogleToken: Master key available from masterKeyOnlyModal, proceeding with automatic re-authorization immediately...');
                return await proceedWithReAuth(masterKey);
            } else if (masterKeyInput && masterKeyInput.value && masterKeyInput.value.trim()) {
                masterKey = masterKeyInput.value.trim();
                // If we have master key in masterPasswordModal, proceed with re-authorization immediately
                console.log('[SYNC] ensureValidGoogleToken: Master key available in masterPasswordModal, proceeding with automatic re-authorization...');
                return await proceedWithReAuth(masterKey);
            }
            
            // If master key is not entered, wait for user to enter it
            // Then automatically trigger re-authorization
            console.log('[SYNC] ensureValidGoogleToken: Waiting for user to enter master key...');
            return new Promise((resolve) => {
                let checkCount = 0;
                const maxChecks = 120; // Wait up to 60 seconds (120 * 500ms)
                
                const checkMasterKey = () => {
                    checkCount++;
                    // Check both modals for master key
                    const currentMasterKey = (masterKeyInput && masterKeyInput.value && masterKeyInput.value.trim()) 
                        ? masterKeyInput.value.trim() 
                        : ((masterKeyOnlyInput && masterKeyOnlyInput.value && masterKeyOnlyInput.value.trim())
                            ? masterKeyOnlyInput.value.trim()
                            : null);
                    
                    if (currentMasterKey) {
                        masterKey = currentMasterKey;
                        console.log('[SYNC] ensureValidGoogleToken: Master key entered, proceeding with automatic re-authorization...');
                        // Hide masterKeyOnlyModal if it's visible
                        if (masterKeyOnlyModal && masterKeyOnlyModal.style.display !== 'none') {
                            masterKeyOnlyModal.style.display = 'none';
                        }
                        proceedWithReAuth(masterKey).then(resolve).catch(() => resolve(false));
                    } else if (checkCount >= maxChecks) {
                        console.log('[SYNC] ensureValidGoogleToken: Timeout waiting for master key');
                        updateGoogleDriveStatus('Token expired - please enter master key and sign in again');
                        resolve(false);
                    } else {
                        // Wait a bit and check again (user might be typing)
                        setTimeout(checkMasterKey, 500);
                    }
                };
                checkMasterKey();
            });
        } catch (error) {
            console.error('[SYNC ERROR] ensureValidGoogleToken: Error during automatic re-authorization:', error);
            updateGoogleDriveStatus('Token expired - please sign in again');
            return false;
        }
    }
    
    // If refresh token exists, try to refresh
    if (typeof refreshGoogleAccessToken === 'function') {
        try {
            console.log('ensureValidGoogleToken: Access token expired, refreshing...');
            const newToken = await refreshGoogleAccessToken(googleDriveRefreshToken);
            if (newToken) {
                googleDriveAccessToken = newToken;
                if (typeof gapi !== 'undefined' && gapi.client) {
                    gapi.client.setToken({ access_token: googleDriveAccessToken });
                }
                console.log('ensureValidGoogleToken: Access token refreshed successfully');
                return true;
            } else {
                console.error('ensureValidGoogleToken: refreshGoogleAccessToken returned null/undefined');
                updateGoogleDriveStatus('Token expired - please sign in again');
                return false;
            }
        } catch (error) {
            console.error('ensureValidGoogleToken: Failed to refresh access token:', error);
            updateGoogleDriveStatus('Token expired - please sign in again');
            return false;
        }
    }
    
    return false;
}

// Helper function to proceed with re-authorization
async function proceedWithReAuth(masterKey) {
    try {
        // Initialize Google API if needed
        if (typeof initGoogleAPI === 'function') {
            await initGoogleAPI();
        }
        
        // Request new token (this will open Google OAuth popup)
        if (typeof requestNewToken === 'function') {
            console.log('[SYNC] ensureValidGoogleToken: Requesting new Google token...');
            const newTokenData = await requestNewToken();
            
            if (newTokenData && newTokenData.accessToken) {
                googleDriveAccessToken = newTokenData.accessToken;
                if (newTokenData.refreshToken) {
                    googleDriveRefreshToken = newTokenData.refreshToken;
                }
                
                // Set token for gapi client
                if (typeof gapi !== 'undefined' && gapi.client) {
                    gapi.client.setToken({ access_token: googleDriveAccessToken });
                }
                
                console.log('[SYNC] ensureValidGoogleToken: New token obtained successfully');
                
                // Get user email and handle sign-in
                if (typeof handleGoogleSignInAfterOAuth === 'function') {
                    const userEmail = newTokenData.email || (typeof getUserInfoFromGoogle === 'function' ? (await getUserInfoFromGoogle()).email : null);
                    if (userEmail) {
                        console.log('[SYNC] ensureValidGoogleToken: Handling Google sign-in after re-authorization...');
                        await handleGoogleSignInAfterOAuth(userEmail);
                        console.log('[SYNC] ensureValidGoogleToken: Re-authorization completed successfully');
                        return true;
                    }
                }
                
                updateGoogleDriveStatus('Re-authorized successfully');
                return true;
            } else {
                console.error('[SYNC ERROR] ensureValidGoogleToken: requestNewToken did not return access token');
                updateGoogleDriveStatus('Token expired - please sign in again');
                return false;
            }
        } else {
            console.error('[SYNC ERROR] ensureValidGoogleToken: requestNewToken function not available');
            updateGoogleDriveStatus('Token expired - please sign in again');
            return false;
        }
    } catch (error) {
        console.error('[SYNC ERROR] ensureValidGoogleToken: Error during re-authorization:', error);
        updateGoogleDriveStatus('Token expired - please sign in again');
        return false;
    }
    
    if (typeof refreshGoogleAccessToken === 'function') {
        try {
            console.log('ensureValidGoogleToken: Access token expired, refreshing...');
            const newToken = await refreshGoogleAccessToken(googleDriveRefreshToken);
            if (newToken) {
                googleDriveAccessToken = newToken;
                if (typeof gapi !== 'undefined' && gapi.client) {
                    gapi.client.setToken({ access_token: googleDriveAccessToken });
                }
                console.log('ensureValidGoogleToken: Access token refreshed successfully');
                return true;
            } else {
                console.error('ensureValidGoogleToken: refreshGoogleAccessToken returned null/undefined');
                updateGoogleDriveStatus('Token expired - please sign in again');
                return false;
            }
        } catch (error) {
            console.error('ensureValidGoogleToken: Failed to refresh access token:', error);
            updateGoogleDriveStatus('Token expired - please sign in again');
            return false;
        }
    } else {
        console.error('ensureValidGoogleToken: refreshGoogleAccessToken function not available');
        updateGoogleDriveStatus('Token expired - please sign in again');
        return false;
    }
}

// Make function globally available for use in other modules
if (typeof window !== 'undefined') {
    window.ensureValidGoogleToken = ensureValidGoogleToken;
}

/**
 * Sync to Google Drive (upload)
 * @param {boolean} force - Force sync even if no pending changes
 * @param {boolean} skipMetadataCheck - Skip metadata check (used when user already chose direction)
 * @returns {Promise<void>}
 */
async function syncToGoogleDrive(force = false, skipMetadataCheck = false) {
    if (!googleDriveAccessToken || !googleDriveFileId || !currentUserLogin) {
        console.warn('[SYNC] syncToGoogleDrive: Missing required data', {
            hasAccessToken: !!googleDriveAccessToken,
            hasFileId: !!googleDriveFileId,
            hasCurrentUserLogin: !!currentUserLogin,
            timestamp: new Date().toISOString()
        });
        return;
    }
    
    // Ensure token is valid before syncing
    console.log('[SYNC] syncToGoogleDrive: Starting sync, checking token validity...', {
        hasAccessToken: !!googleDriveAccessToken,
        hasRefreshToken: !!googleDriveRefreshToken,
        hasFileId: !!googleDriveFileId,
        currentUserLogin: typeof currentUserLogin !== 'undefined' ? currentUserLogin : 'undefined',
        force,
        skipMetadataCheck,
        timestamp: new Date().toISOString()
    });
    const tokenValid = await ensureValidGoogleToken();
    if (!tokenValid) {
        console.error('[SYNC ERROR] Cannot sync: Google access token is invalid and could not be refreshed', {
            hasAccessToken: !!googleDriveAccessToken,
            hasRefreshToken: !!googleDriveRefreshToken,
            timestamp: new Date().toISOString()
        });
        hideSyncAnimation();
        return;
    }

    if (!force && !hasPendingChanges) {
        return;
    }

    showSyncAnimation();

    try {
        // Get encrypted data from new architecture
        const dataKey = getUserDataKey(currentUserLogin);
        const encryptedData = localStorage.getItem(dataKey);
        
        if (!encryptedData) {
            hideSyncAnimation();
            return;
        }

        // Check cloud file metadata before uploading (check if cloud data changed)
        // Skip if user already chose direction (skipMetadataCheck = true)
        let cloudChanged = false;
        
        if (!skipMetadataCheck) {
            console.log('Checking cloud file metadata before upload...');
            
            // Get last known metadata from localStorage (persists across page refreshes)
            const savedLastModifiedTime = localStorage.getItem(dataKey + '_lastCloudModifiedTime');
            const savedLastHashVersion = localStorage.getItem(dataKey + '_lastCloudHashVersion');
            
            // Use saved values or memory values (memory takes precedence if set)
            const knownModifiedTime = lastCloudModifiedTime || savedLastModifiedTime;
            const knownHashVersion = lastCloudHashVersion || savedLastHashVersion;
            
            if (typeof getGoogleDriveFileMetadata === 'function') {
                // Ensure token is still valid before getting metadata (it may have expired since start of function)
                await ensureValidGoogleToken();
                
                const cloudMetadata = await getGoogleDriveFileMetadata();
                
                if (cloudMetadata) {
                    // Compare with last known values
                    const cloudModifiedTime = cloudMetadata.modifiedTime;
                    const cloudMd5Checksum = cloudMetadata.md5Checksum;
                    
                    // Always check if file was modified
                    if (cloudModifiedTime) {
                        if (knownModifiedTime) {
                            // Compare with known modified time
                            if (cloudModifiedTime !== knownModifiedTime) {
                                console.log('Cloud file was modified since last sync:', {
                                    known: knownModifiedTime,
                                    current: cloudModifiedTime
                                });
                                cloudChanged = true;
                            }
                        } else {
                            // First sync or no known time - need to check if cloud data differs
                            // Download cloud data and compare hash with local
                            console.log('No known modified time - checking if cloud data differs from local');
                            const cloudData = await fetchCloudFile();
                            if (cloudData && cloudData.encryptedData) {
                                const cloudHash = await calculateDataHash(cloudData.encryptedData);
                                const localHash = await calculateDataHash(encryptedData);
                                if (cloudHash !== localHash) {
                                    console.log('Cloud data differs from local (first sync check):', {
                                        cloudHash: cloudHash.substring(0, 8) + '...',
                                        localHash: localHash.substring(0, 8) + '...'
                                    });
                                    cloudChanged = true;
                                } else {
                                    console.log('Cloud data matches local - no conflict');
                                }
                            }
                        }
                    }
                    
                    // If md5Checksum is available, use it for more accurate comparison
                    if (cloudMd5Checksum) {
                        console.log('Cloud file MD5 checksum:', cloudMd5Checksum);
                    }
                }
            }
            
            // If cloud data changed, download and show conflict dialog
            if (cloudChanged) {
                console.log('Cloud data changed - downloading and showing conflict dialog');
                hideSyncAnimation();
                
                // Download cloud data
                const cloudData = await fetchCloudFile();
                if (cloudData) {
                    // Process cloud data (will show conflict dialog)
                    await processCloudData(cloudData);
                }
                return;
            }
        } else {
            console.log('Skipping metadata check - user already chose sync direction');
        }

        // Get version from new architecture
        let currentVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
        
        // If version needs increment (because debounce was active during saves),
        // increment it now before syncing
        if (hasPendingChanges && typeof versionNeedsIncrement !== 'undefined' && versionNeedsIncrement) {
            // Version wasn't incremented during save (debounce was active)
            // Increment it now before syncing
            currentVersion = currentVersion + 1;
            localStorage.setItem(dataKey + '_version', currentVersion.toString());
            console.log(`syncToGoogleDrive: incrementing version to ${currentVersion} before sync`);
            
            // Reset flag
            versionNeedsIncrement = false;
            
            // Re-save data with updated version (this will update version in encrypted data too)
            // But don't trigger sync again (no debounce, no increment)
            if (typeof saveToLocalStorage === 'function') {
                await saveToLocalStorage(false, 0); // Don't increment again, no debounce
            }
        }
        
        const modifiedAt = new Date().toISOString();

        console.log(`Uploading to cloud: v${currentVersion}`);

        if (currentVersion === 0) {
            console.warn('Warning: Version is 0, setting version to 1');
            localStorage.setItem(dataKey + '_version', '1');
        }

        // Get salt - needed for decryption on other computers
        const saltBase64 = localStorage.getItem(dataKey + '_salt');
        if (!saltBase64) {
            // Try legacy format
            const keys = getUserStorageKeys(currentUserLogin);
            const legacySalt = localStorage.getItem(keys.encryptionSalt);
            if (!legacySalt) {
                console.error('Salt not found - cannot upload to Google Drive');
                hideSyncAnimation();
                return;
            }
        }
        
        // Calculate Hash Version for conflict detection
        const hashVersion = await calculateDataHash(encryptedData);
        
        // New format: userId, encryptedData, encryptionSalt, version, hashVersion, modifiedAt
        const exportData = {
            userId: currentUserLogin,
            encryptedData: encryptedData, // Already encrypted data from PM_DATA::<userId>
            encryptionSalt: saltBase64 || localStorage.getItem(getUserStorageKeys(currentUserLogin).encryptionSalt), // Salt needed for decryption
            version: currentVersion,
            hashVersion: hashVersion, // Hash of encrypted data for conflict detection
            modifiedAt: modifiedAt,
            lastSync: new Date().toISOString()
        };

        const jsonData = JSON.stringify(exportData);
        const blob = new Blob([jsonData], { type: 'application/json' });

        // Multipart upload to Google Drive
        const metadata = {
            name: GOOGLE_DRIVE_FILENAME
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${googleDriveFileId}?uploadType=multipart`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${googleDriveAccessToken}`
            },
            body: form
        });

        if (!response.ok) {
            // If 401 Unauthorized, try to refresh token and retry once
            if (response.status === 401) {
                console.log('Received 401 Unauthorized, attempting to refresh token...');
                const tokenRefreshed = await ensureValidGoogleToken();
                if (tokenRefreshed) {
                    // Retry upload with new token
                    console.log('Retrying upload with refreshed token...');
                    const retryResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${googleDriveFileId}?uploadType=multipart`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${googleDriveAccessToken}`
                        },
                        body: form
                    });
                    
                    if (!retryResponse.ok) {
                        throw new Error(`Upload error after token refresh: ${retryResponse.status}`);
                    }
                    // Success, continue with retryResponse
                } else {
                    throw new Error('Upload error: Token expired and could not be refreshed. Please sign in again.');
                }
            } else {
                throw new Error(`Upload error: ${response.status}`);
            }
        }

        // Update last known cloud metadata after successful upload
        if (typeof getGoogleDriveFileMetadata === 'function') {
            const updatedMetadata = await getGoogleDriveFileMetadata();
            if (updatedMetadata) {
                lastCloudModifiedTime = updatedMetadata.modifiedTime;
                // Store hashVersion for future comparison
                lastCloudHashVersion = hashVersion;
                
                // Also save to localStorage for persistence across page refreshes
                localStorage.setItem(dataKey + '_lastCloudModifiedTime', updatedMetadata.modifiedTime);
                if (hashVersion) {
                    localStorage.setItem(dataKey + '_lastCloudHashVersion', hashVersion);
                }
                
                console.log('Updated last known cloud metadata after upload:', {
                    modifiedTime: lastCloudModifiedTime,
                    hashVersion: lastCloudHashVersion ? lastCloudHashVersion.substring(0, 8) + '...' : 'none'
                });
            }
        }

        hasPendingChanges = false;
        lastSyncTime = Date.now();
        updateGoogleDriveStatus(`Synchronized ${new Date().toLocaleTimeString()}`);
        
        // Update sync status to show new version number
        if (typeof updateSyncStatus === 'function') {
            await updateSyncStatus();
        }

    } catch (error) {
        console.error('Error uploading to Google Drive:', error);
        updateGoogleDriveStatus('Sync error');
    } finally {
        hideSyncAnimation();
    }
}

/**
 * Mark data as changed and trigger sync (with debounce)
 * @param {boolean} immediate - If true, sync immediately without debounce
 */
function markDataChanged(immediate = false) {
    console.log('[SYNC] markDataChanged called:', { immediate, hasAccessToken: !!googleDriveAccessToken, isGoogleSignIn: typeof isGoogleSignIn !== 'undefined' ? isGoogleSignIn : 'undefined', timestamp: new Date().toISOString() });
    if (googleDriveAccessToken && isGoogleSignIn) {
        hasPendingChanges = true;

        // Cancel interval timer - we don't need it when using debounce
        if (syncTimer) {
            clearInterval(syncTimer);
            syncTimer = null;
        }

        // If immediate sync required (e.g. adding/removing), do it
        if (immediate) {
            console.log('[SYNC] markDataChanged: Immediate sync requested');
            // Cancel debounce timer
            if (syncDebounceTimer) {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = null;
            }
            // Sync immediately
            syncToGoogleDrive();
        } else {
            // Debounce: cancel previous timer
            if (syncDebounceTimer) {
                clearTimeout(syncDebounceTimer);
                syncDebounceTimer = null;
                console.log('[SYNC] markDataChanged: Debounce timer reset - waiting 3 seconds from now');
            } else {
                console.log('[SYNC] markDataChanged: Starting debounce timer - sync will happen in 3 seconds');
            }
            
            // Set new timer for 3 seconds (minimum delay)
            const debounceStartTime = Date.now();
            syncDebounceTimer = setTimeout(() => {
                const actualDelay = Date.now() - debounceStartTime;
                console.log(`[SYNC] markDataChanged: Debounce timer fired after ${actualDelay}ms (expected 3000ms)`);
                syncDebounceTimer = null;
                if (hasPendingChanges) {
                    console.log('[SYNC] markDataChanged: Has pending changes, calling syncToGoogleDrive');
                    syncToGoogleDrive();
                    // Reset version increment flag after sync
                    if (typeof versionNeedsIncrement !== 'undefined') {
                        versionNeedsIncrement = false;
                    }
                } else {
                    console.log('[SYNC] markDataChanged: No pending changes, skipping sync');
                }
            }, 3000); // 3 seconds delay - minimum time before sync
        }
    } else {
        console.log('[SYNC] markDataChanged: Skipping sync (no access token or not Google sign-in)', {
            hasAccessToken: !!googleDriveAccessToken,
            isGoogleSignIn: typeof isGoogleSignIn !== 'undefined' ? isGoogleSignIn : 'undefined'
        });
    }
}

// startSyncTimer() removed - debounce mechanism handles sync timing

