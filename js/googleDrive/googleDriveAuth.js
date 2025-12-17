// Google Drive Authentication Module
// Handles Google sign-in flow, user scenarios, and authentication UI

/**
 * Determine user scenario (A: local exists, B: cloud only, C: new user)
 * @param {string} userId - User ID (email)
 * @returns {Promise<Object>} Scenario object with type and data
 */
async function determineUserScenario(userId) {
    // Check local existence
    const hasLocalData = userDataExists(userId);
    const hasLocalSalt = localStorage.getItem(getUserDataKey(userId) + '_salt') !== null;
    
    // Check Google Drive existence
    let hasCloudData = false;
    let cloudSalt = null;
    let cloudData = null;
    
    try {
        cloudData = await fetchGoogleDriveFileData();
        if (cloudData && cloudData.userId === userId) {
            hasCloudData = true;
            cloudSalt = cloudData.encryptionSalt;
        }
    } catch (error) {
        console.error('Error checking Google Drive:', error);
        hasCloudData = false;
    }
    
    // Determine scenario
    let useExistingSalt = false;
    let saltToUse = null;
    let isNewUser = false;
    let scenarioType = '';
    
    if (hasLocalData && hasLocalSalt) {
        // Scenario A: User exists locally
        console.log('Scenario A: User exists locally');
        scenarioType = 'A';
        useExistingSalt = true;
        saltToUse = localStorage.getItem(getUserDataKey(userId) + '_salt');
    } else if (!hasLocalData && hasCloudData && cloudSalt) {
        // Scenario B: User exists only in Google Drive
        console.log('Scenario B: User exists only in Google Drive');
        scenarioType = 'B';
        useExistingSalt = true;
        saltToUse = cloudSalt;
        // Save salt from Google Drive locally
        localStorage.setItem(getUserDataKey(userId) + '_salt', cloudSalt);
        // Also save in legacy format for compatibility
        const keys = getUserStorageKeys(userId);
        localStorage.setItem(keys.encryptionSalt, cloudSalt);
    } else if (!hasLocalData && !hasCloudData) {
        // Scenario C: New user
        console.log('Scenario C: New user');
        scenarioType = 'C';
        isNewUser = true;
        useExistingSalt = false;
        // Will generate new salt in initializeEncryption
    } else {
        // Unexpected scenario
        throw new Error('Unexpected user state: hasLocalData=' + hasLocalData + ', hasCloudData=' + hasCloudData);
    }
    
    return {
        type: scenarioType,
        hasLocalData,
        hasCloudData,
        cloudData,
        cloudSalt,
        useExistingSalt,
        saltToUse,
        isNewUser
    };
}

/**
 * Handle Scenario A: User exists locally
 * @param {string} userId - User ID
 * @param {string} masterKey - Master key
 * @param {Object} scenario - Scenario object
 * @returns {Promise<void>}
 */
async function handleScenarioA(userId, masterKey, scenario) {
    const dataKey = getUserDataKey(userId);
    const localVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
    const cloudVersion = scenario.hasCloudData ? parseInt(scenario.cloudData.version || '0', 10) : 0;

    // Get Hash Versions for comparison
    const localEncryptedData = localStorage.getItem(dataKey);
    const localHashVersion = localEncryptedData ? await calculateDataHash(localEncryptedData) : null;
    const cloudHashVersion = scenario.hasCloudData && scenario.cloudData.encryptedData ? await calculateDataHash(scenario.cloudData.encryptedData) : null;

    console.log(`Sync: Local v${localVersion} (hash: ${localHashVersion ? localHashVersion.substring(0, 8) + '...' : 'none'}) vs Cloud v${cloudVersion} (hash: ${cloudHashVersion ? cloudHashVersion.substring(0, 8) + '...' : 'none'})`);

    // If no cloud data, just upload local
    if (!scenario.hasCloudData) {
        console.log(`-> No cloud data, uploading local data`);
        await saveToLocalStorage(false, 0); // No increment, no debounce
        await syncToGoogleDrive(true);
        await loadFromLocalStorage(userId);
        return;
    }
    
    // Check conflict based on version and hash comparison rules
    const versionsMatch = localVersion === cloudVersion;
    const hashesMatch = localHashVersion && cloudHashVersion && localHashVersion === cloudHashVersion;
    
    // Rule 1: Versions match AND hashes match - data is identical, no sync needed
    if (versionsMatch && hashesMatch) {
        console.log(`= Versions and hashes match (v${cloudVersion}), data identical - no sync needed`);
        await loadFromLocalStorage(userId);
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
    // localEncryptedData already declared above for hash calculation
    const localSalt = localStorage.getItem(dataKey + '_salt') || 
                     localStorage.getItem(getUserStorageKeys(userId).encryptionSalt);
    
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
    
    if (scenario.cloudData.encryptedData && scenario.cloudData.encryptionSalt && masterKey) {
        try {
            // Use getDataStatistics from sync module if available
            if (typeof getDataStatistics === 'function') {
                cloudStats = await getDataStatistics(
                    scenario.cloudData.encryptedData,
                    scenario.cloudData.encryptionSalt,
                    userId,
                    masterKey
                );
            }
        } catch (error) {
            console.error('Error getting cloud statistics:', error);
            cloudStats.error = error.message;
        }
    }
    
    // Show confirmation dialog if conflict detected (versions differ OR versions match but hashes differ)
    if (!versionsMatch || (versionsMatch && !hashesMatch)) {
        // Log detailed statistics
        if (typeof logWarn === 'function') {
            logWarn('Sync conflict detected during sign-in', {
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
        if (typeof confirmSyncDirection === 'function') {
            const syncDirection = await confirmSyncDirection(localStats, cloudStats, localVersion, cloudVersion);
            
            if (syncDirection === 'cancel') {
                console.log('User cancelled sync - switching to local mode');
                // Switch to local mode (disable cloud sync)
                isGoogleSignIn = false;
                googleDriveAccessToken = null;
                googleDriveRefreshToken = null;
                googleDriveFileId = null;
                // Continue with local data only
                await loadFromLocalStorage(userId);
                // Update status
                if (typeof updateSyncStatus === 'function') {
                    await updateSyncStatus();
                }
                return; // Exit early, don't sync
            } else if (syncDirection === 'download') {
                // User chose to download cloud data instead
                console.log(`-> Downloading cloud data to local - User chose download`);
                // Perform merge directly without calling syncFromGoogleDrive (which would call processCloudData again)
                await mergeCloudDataToLocal(scenario.cloudData, userId, masterKey, cloudVersion);
                await loadFromLocalStorage(userId);
                return; // Exit early, data already loaded
            } else if (syncDirection === 'upload') {
                // User chose to upload local data
                console.log(`-> Uploading local data to cloud - User confirmed`);
                await saveToLocalStorage(false, 0); // No increment, no debounce
                await syncToGoogleDrive(true, true); // Force sync, skip metadata check (user already chose direction)
                await loadFromLocalStorage(userId);
                return; // Exit early, sync completed
            } else {
                // Unknown direction
                throw new Error('Unknown sync direction');
            }
        }
    }
    
    // This code should not be reached if versions and hashes match (already handled above)
    // But keep it as fallback for edge cases
    
    // Load data after sync
    await loadFromLocalStorage(userId);
}

/**
 * Handle Scenario B: User exists only in Google Drive
 * @param {string} userId - User ID
 * @param {string} masterKey - Master key
 * @param {Object} scenario - Scenario object
 * @returns {Promise<void>}
 */
async function handleScenarioB(userId, masterKey, scenario) {
    console.log('Loading data from Google Drive');
    // Master key validation happens in syncFromGoogleDrive
    // syncFromGoogleDrive will load data via processCloudData, which calls loadFromLocalStorage
    await syncFromGoogleDrive();
    // Data should already be loaded by syncFromGoogleDrive/processCloudData
    // Only reload if needed (e.g., if sync was cancelled)
    if (isGoogleSignIn && googleDriveAccessToken) {
        // Data was successfully synced, no need to reload
        console.log('Data already loaded from Google Drive');
    } else {
        // Sync was cancelled or failed, try to load local data
        try {
            await loadFromLocalStorage(userId);
        } catch (loadError) {
            console.error('Error loading from local storage in Scenario B:', loadError);
            // Don't throw - let user retry
        }
    }
}

/**
 * Handle Scenario C: New user
 * @param {string} userId - User ID
 * @param {string} masterKey - Master key
 * @param {Object} scenario - Scenario object
 * @returns {Promise<void>}
 */
async function handleScenarioC(userId, masterKey, scenario) {
    console.log('Creating new user data');
    // Data will be created with default categories
    await saveToLocalStorage(true, 0); // Increment version, no debounce
    await syncToGoogleDrive(true);
    // Load data after creation
    await loadFromLocalStorage(userId);
}

/**
 * Validate master key confirmation for new user
 * @param {string} masterKey - Master key
 * @returns {Promise<boolean>} True if valid
 */
async function validateMasterKeyConfirmation(masterKey) {
    const confirmMasterKeyInput = document.getElementById('confirmPasswordInput');
    const masterKeyInput = document.getElementById('masterPasswordInput');
    const errorDiv = document.getElementById('masterPasswordError');
    
    if (confirmMasterKeyInput && confirmMasterKeyInput.style.display !== 'none') {
        const confirmMasterKey = confirmMasterKeyInput.value.trim();
        if (masterKey !== confirmMasterKey) {
            if (errorDiv) {
                errorDiv.textContent = 'Master passwords do not match';
                errorDiv.style.display = 'block';
            }
            confirmMasterKeyInput.focus();
            return false;
        }
    } else {
        const confirmMasterKey = prompt('Confirm your master password:');
        if (masterKey !== confirmMasterKey) {
            if (errorDiv) {
                errorDiv.textContent = 'Master passwords do not match';
                errorDiv.style.display = 'block';
            }
            if (masterKeyInput) masterKeyInput.focus();
            return false;
        }
    }
    return true;
}

/**
 * Finalize Google sign-in (UI updates and initialization)
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
async function finalizeGoogleSignIn(userId) {
    // Set active user (new architecture)
    if (typeof setActiveUserId === 'function') {
        setActiveUserId(userId);
    }
    
    // Save data with new architecture (Google login type, with Google tokens)
    // Use immediate save to ensure tokens are saved right away (no debounce, no version increment)
    isGoogleSignIn = true;
    if (typeof saveToLocalStorageImmediate === 'function') {
        await saveToLocalStorageImmediate(false); // Don't increment version (already incremented during sync)
    } else {
        await saveToLocalStorage(false, 0); // No debounce, no version increment
    }

    // Hide modal & show app main UI
    const modal = document.getElementById('masterPasswordModal');
    const mainContainer = document.getElementById('mainContainer');
    if (modal) modal.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';

    // Show login in UI
    updateUserLoginDisplay(userId);

    // App re-initialization steps
    initializeCategories();
    initializeFilters();
    updateTable();
    setupEventListeners();

    // Sync will be triggered by markDataChanged() when data changes
    // No need to start periodic timer - debounce handles sync timing

    // Update status
    updateGoogleDriveStatus('Connected to Google Drive');

    await updateSyncStatus();
}

/**
 * Handle error during Google sign-in
 * @param {Error} error - Error object
 */
function handleGoogleSignInError(error) {
    console.error('Error during Google sign in:', error);
    
    // If Google error - show normal login window (login + password)
    const modal = document.getElementById('masterPasswordModal');
    const mainContainer = document.getElementById('mainContainer');
    const loginInput = document.getElementById('userLoginInput');
    const masterKeyInput = document.getElementById('masterPasswordInput');
    const submitBtn = document.getElementById('masterPasswordSubmit');
    const errorDiv = document.getElementById('masterPasswordError');
    
    // Hide main container
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
    
    // Show normal login modal (with login and password fields)
    if (modal) {
        modal.style.display = 'flex';
    }
    
    // Show login input (normal login window)
    if (loginInput) {
        loginInput.style.display = 'block';
        loginInput.placeholder = 'Login';
    }
    if (masterKeyInput) {
        masterKeyInput.placeholder = 'Master key (for encryption)';
        masterKeyInput.value = '';
    }
    if (submitBtn) {
        submitBtn.style.display = 'inline-block';
        submitBtn.textContent = 'Login';
    }
    
    // Show error message
    if (errorDiv) {
        errorDiv.textContent = 'Google sign in error: ' + error.message;
        errorDiv.style.display = 'block';
    }
    
    // Reset state
    encryptionKey = null;
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
    
    // Focus on login input
    if (loginInput) {
        loginInput.focus();
    }
}

/**
 * Handle Google sign-in after OAuth (main function)
 * @param {string} email - User email
 * @returns {Promise<void>}
 */
async function handleGoogleSignInAfterOAuth(email) {
    try {
        // Use email as userId (according to architecture)
        const userId = email || 'google_user';
        
        if (!email) {
            throw new Error('Google email is required');
        }

        const masterKeyInput = document.getElementById('masterPasswordInput');
        if (!masterKeyInput) {
            throw new Error('Master password input not found');
        }

        const masterKey = masterKeyInput.value.trim();
        
        if (!masterKey) {
            throw new Error('Master key is required');
        }

        // Step 1: Find or create file in Google Drive (need fileId first)
        await findOrCreateDriveFile();
        
        // Step 2: Determine user scenario
        const scenario = await determineUserScenario(userId);
        
        // Step 3: If new user, validate master key confirmation
        if (scenario.isNewUser) {
            const isValid = await validateMasterKeyConfirmation(masterKey);
            if (!isValid) {
                return; // User needs to re-enter
            }
        }
        
        // Step 4: Initialize encryption with correct salt
        await initializeEncryption(userId, masterKey, scenario.useExistingSalt);

        // Step 5: Ensure currentUserLogin is set (needed for sync functions)
        currentUserLogin = userId;
        
        // Step 6: Handle scenario-specific logic
        switch (scenario.type) {
            case 'A':
                await handleScenarioA(userId, masterKey, scenario);
                break;
            case 'B':
                await handleScenarioB(userId, masterKey, scenario);
                break;
            case 'C':
                await handleScenarioC(userId, masterKey, scenario);
                break;
            default:
                throw new Error('Unknown scenario type: ' + scenario.type);
        }

        // Step 7: Finalize sign-in
        await finalizeGoogleSignIn(userId);
        
    } catch (error) {
        handleGoogleSignInError(error);
    }
}

/**
 * Setup Google Sign In button
 * Make it available globally
 */
window.setupGoogleSignInButton = function setupGoogleSignInButton() {
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    if (googleSignInBtn) {
        // Remove existing event listeners by cloning the button
        const newBtn = googleSignInBtn.cloneNode(true);
        googleSignInBtn.parentNode.replaceChild(newBtn, googleSignInBtn);
        
        newBtn.addEventListener('click', async () => {
            const modal = document.getElementById('masterPasswordModal');
            const loginInput = document.getElementById('userLoginInput');
            const masterKeyInput = document.getElementById('masterPasswordInput');
            const errorDiv = document.getElementById('masterPasswordError');
            const submitBtn = document.getElementById('masterPasswordSubmit');
            const createBtn = document.getElementById('masterPasswordCreate');
            const cancelBtn = document.getElementById('masterPasswordCancel');
            const confirmInput = document.getElementById('confirmPasswordInput');
            const createUserMessage = document.getElementById('createUserMessage');

            const showError = (message) => {
                if (errorDiv) {
                    errorDiv.textContent = message;
                    errorDiv.style.display = 'block';
                    setTimeout(() => {
                        errorDiv.style.display = 'none';
                    }, 5000);
                } else {
                    alert(message);
                }
            };

            const hideError = () => {
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                }
            };

            // Show modal if it's hidden (when user has saved Google tokens)
            if (modal && modal.style.display === 'none') {
                modal.style.display = 'flex';
                // Hide login input, show only master key for Google sign-in
                if (loginInput) {
                    loginInput.style.display = 'none';
                }
                if (submitBtn) {
                    submitBtn.style.display = 'none';
                }
                if (createBtn) {
                    createBtn.style.display = 'none';
                }
                if (cancelBtn) {
                    cancelBtn.style.display = 'none';
                }
                if (confirmInput) {
                    confirmInput.style.display = 'none';
                }
                if (createUserMessage) {
                    createUserMessage.style.display = 'none';
                }
                if (masterKeyInput) {
                    masterKeyInput.placeholder = 'Master key (for Google Drive data)';
                    masterKeyInput.focus();
                }
            }

            try {
                if (!masterKeyInput) {
                    showError('Master password input not found');
                    return;
                }

                const masterKey = masterKeyInput.value.trim();
                if (!masterKey) {
                    showError('Enter master password');
                    if (masterKeyInput) masterKeyInput.focus();
                    return;
                }

                if (masterKey.length < 6) {
                    showError('Master password must be at least 6 characters');
                    if (masterKeyInput) masterKeyInput.focus();
                    return;
                }

                hideError();

                if (!checkProtocol()) {
                    showError('Google OAuth requires HTTP/HTTPS. Use a server (python -m http.server 8000)');
                    return;
                }

                if (!checkGoogleConfig()) {
                    showError('Google API keys are not configured! See the README.md.');
                    return;
                }

                try {
                    await initGoogleAPI();
                } catch (initError) {
                    console.error('Error initializing Google API:', initError);
                    showError('Error initializing Google API: ' + initError.message);
                    return;
                }

                try {
                    // Get access token
                    const accessToken = await getGoogleDriveAccessToken();
                    
                    // Get user info to pass email to handleGoogleSignInAfterOAuth
                    let userEmail = null;
                    try {
                        const userInfo = await getUserInfoFromGoogle();
                        userEmail = userInfo.email;
                    } catch (error) {
                        console.error('Error fetching user info:', error);
                        // Try to get email from saved tokens
                        const savedToken = loadGoogleTokensFromStorage();
                        if (savedToken && savedToken.email) {
                            userEmail = savedToken.email;
                        }
                    }
                    
                    // Handle sign-in after OAuth
                    await handleGoogleSignInAfterOAuth(userEmail);
                } catch (error) {
                    console.error('Error during Google sign in:', error);
                    showError('Error during Google sign in: ' + error.message);
                }
            } catch (error) {
                console.error('Error during Google sign in:', error);
                showError('Error during Google sign in: ' + error.message);
            }
        });
    }
}

