// main.js
// Инициализация приложения

// Check if user has saved Google tokens
function hasSavedGoogleTokens() {
    const allKeys = Object.keys(localStorage);
    for (const key of allKeys) {
        if (key.startsWith('google_tokens_')) {
            try {
                const tokensData = JSON.parse(localStorage.getItem(key));
                const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                if (Date.now() - tokensData.savedAt <= maxAge) {
                    console.log('Found valid Google tokens:', key);
                    return true;
                } else {
                    console.log('Google tokens expired:', key);
                }
            } catch (e) {
                console.log('Error parsing Google tokens:', key, e);
                // Skip corrupted data
            }
        }
    }
    console.log('No valid Google tokens found');
    return false;
}

// Show master key only modal (for page refresh)
function showMasterKeyOnlyModal() {
    const modal = document.getElementById('masterKeyOnlyModal');
    const input = document.getElementById('masterKeyOnlyInput');
    const errorDiv = document.getElementById('masterKeyOnlyError');
    const okBtn = document.getElementById('masterKeyOnlyOk');
    const cancelBtn = document.getElementById('masterKeyOnlyCancel');
    
    if (!modal || !input || !okBtn || !cancelBtn) {
        console.error('Master key only modal elements not found');
        return;
    }
    
    // Clear previous values
    input.value = '';
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
    
    // Show modal
    modal.style.display = 'flex';
    input.focus();
    
    // Handle OK button
    const handleOk = async () => {
        const masterKey = input.value.trim();
        
        if (!masterKey) {
            if (errorDiv) {
                errorDiv.textContent = 'Enter master key';
                errorDiv.style.display = 'block';
            }
            input.focus();
            return;
        }
        
        if (masterKey.length < 6) {
            if (errorDiv) {
                errorDiv.textContent = 'Master key must be at least 6 characters';
                errorDiv.style.display = 'block';
            }
            input.focus();
            return;
        }
        
        // Get active user ID
        const activeUserId = getActiveUserId();
        if (!activeUserId) {
            if (errorDiv) {
                errorDiv.textContent = 'No active user found';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        try {
            // Get salt - check local first
            const dataKey = getUserDataKey(activeUserId);
            let saltBase64 = localStorage.getItem(dataKey + '_salt');
            let useExistingSalt = true;
            
            // If salt not found locally, try to load from Google Drive
            if (!saltBase64) {
                // Try to load salt from Google Drive if possible
                // First, we need to check if user was logged in via Google
                // We'll try to fetch from Google Drive if we have tokens
                if (typeof fetchGoogleDriveFileData === 'function' && googleDriveAccessToken && googleDriveFileId) {
                    try {
                        const cloudData = await fetchGoogleDriveFileData();
                        if (cloudData && cloudData.userId === activeUserId && cloudData.encryptionSalt) {
                            saltBase64 = cloudData.encryptionSalt;
                            // Save salt locally
                            localStorage.setItem(dataKey + '_salt', saltBase64);
                            // Also save in legacy format
                            const keys = getUserStorageKeys(activeUserId);
                            localStorage.setItem(keys.encryptionSalt, saltBase64);
                            console.log('Loaded salt from Google Drive');
                        } else {
                            throw new Error('Salt not found in Google Drive');
                        }
                    } catch (error) {
                        console.error('Failed to load salt from Google Drive:', error);
                        throw new Error('Salt not found locally and cannot load from Google Drive. Cannot decrypt data.');
                    }
                } else {
                    throw new Error('Salt not found locally. Cannot decrypt data.');
                }
            }
            
            // Try to decrypt data with master key
            await initializeEncryption(activeUserId, masterKey, useExistingSalt);
            const userData = await loadFromLocalStorage(activeUserId);
            
            if (!userData) {
                throw new Error('Failed to load user data');
            }
            
            // Check login type
            if (userData.loginType === 'Local') {
                // Local login - show main interface
                modal.style.display = 'none';
                const mainContainer = document.getElementById('mainContainer');
                if (mainContainer) {
                    mainContainer.style.display = 'block';
                }
                if (typeof updateUserLoginDisplay === 'function') {
                    updateUserLoginDisplay(activeUserId);
                }
                if (typeof initializeCategories === 'function') {
                    initializeCategories();
                }
                if (typeof initializeFilters === 'function') {
                    initializeFilters();
                }
                if (typeof updateTable === 'function') {
                    updateTable();
                }
                setupEventListeners();
            } else if (userData.loginType === 'Google') {
                // Google login - check token validity
                if (userData.googleToken) {
                    // Restore Google tokens
                    googleDriveAccessToken = userData.googleToken.accessToken;
                    googleDriveRefreshToken = userData.googleToken.refreshToken;
                    googleDriveFileId = userData.googleToken.fileId;
                    googleDriveUserEmail = userData.googleToken.email;
                    isGoogleSignIn = true;
                    
                    // Check token validity
                    if (typeof checkGoogleTokenValidity === 'function') {
                        console.log('[AUTH] Checking Google token validity...');
                        let isValid = false;
                        try {
                            isValid = await checkGoogleTokenValidity(googleDriveAccessToken);
                            console.log('[AUTH] Token validity check result:', isValid);
                        } catch (tokenCheckError) {
                            console.error('[AUTH] Error checking token validity:', tokenCheckError);
                            isValid = false; // Assume invalid if check fails
                        }
                        if (isValid) {
                            // Token valid - perform version check and sync if needed (according to architecture)
                            // Cloud Sync: check version in cloud and compare with local version
                            if (typeof fetchGoogleDriveFileData === 'function' && googleDriveFileId) {
                                try {
                                    const cloudData = await fetchGoogleDriveFileData();
                                    if (cloudData && cloudData.userId === activeUserId) {
                                        const localVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
                                        const cloudVersion = parseInt(cloudData.version || '0', 10);
                                        
                                        console.log(`Page refresh sync check: Local v${localVersion} vs Cloud v${cloudVersion}`);
                                        
                                        if (cloudVersion > localVersion) {
                                            // Cloud version is higher - sync from cloud
                                            console.log(`-> Cloud version is newer (v${cloudVersion} > v${localVersion}), syncing from cloud`);
                                            if (typeof syncFromGoogleDrive === 'function') {
                                                await syncFromGoogleDrive();
                                                // Reload data after sync
                                                await loadFromLocalStorage(activeUserId);
                                            }
                                        } else {
                                            // Local version is current - work with current data without sync
                                            console.log(`= Local version is current (v${localVersion} >= v${cloudVersion}), using local data`);
                                        }
                                    }
                                } catch (syncError) {
                                    console.error('Error checking cloud version:', syncError);
                                    // Continue with local data if sync check fails
                                }
                            }
                            
                            // Show main interface
                            modal.style.display = 'none';
                            const mainContainer = document.getElementById('mainContainer');
                            if (mainContainer) {
                                mainContainer.style.display = 'block';
                            }
                            if (typeof updateUserLoginDisplay === 'function') {
                                updateUserLoginDisplay(activeUserId);
                            }
                            if (typeof initializeCategories === 'function') {
                                initializeCategories();
                            }
                            if (typeof initializeFilters === 'function') {
                                initializeFilters();
                            }
                            if (typeof updateTable === 'function') {
                                updateTable();
                            }
                            setupEventListeners();
                            // Sync will be triggered by markDataChanged() when data changes
                            // No need to start periodic timer - debounce handles sync timing
                            if (typeof updateSyncStatus === 'function') {
                                await updateSyncStatus();
                            }
                        } else {
                            // Token expired - trigger automatic re-authorization immediately
                            // We have master key already entered, so we can proceed with re-auth
                            console.log('[AUTH] Google token expired in handleOk - triggering automatic re-authorization with entered master key...');
                                
                                // Get master key before hiding modal
                                const masterKey = input.value.trim();
                                
                                // Hide masterKeyOnlyModal
                                modal.style.display = 'none';
                                
                                // Trigger automatic re-authorization using ensureValidGoogleToken
                                // Pass master key directly to avoid issues with hidden modal
                                if (typeof ensureValidGoogleToken === 'function') {
                                    // Pass master key directly to ensureValidGoogleToken
                                    const reAuthResult = await ensureValidGoogleToken(masterKey);
                                    if (reAuthResult) {
                                        console.log('[AUTH] Automatic re-authorization successful');
                                        // After successful re-auth, ensureValidGoogleToken will call handleGoogleSignInAfterOAuth
                                        // which will show the main interface, so we don't need to do anything here
                                    } else {
                                        console.error('[AUTH] Automatic re-authorization failed');
                                        // If re-auth failed, show masterPasswordModal for manual retry
                                        if (typeof showMasterPasswordModal === 'function') {
                                            showMasterPasswordModal();
                                        }
                                    }
                                } else {
                                    console.error('[AUTH] ensureValidGoogleToken function not available');
                                    // Fallback: show masterPasswordModal
                                    if (typeof showMasterPasswordModal === 'function') {
                                        showMasterPasswordModal();
                                    }
                                }
                            }
                    } else {
                        // Can't check token - assume valid and show interface
                        modal.style.display = 'none';
                        const mainContainer = document.getElementById('mainContainer');
                        if (mainContainer) {
                            mainContainer.style.display = 'block';
                        }
                        if (typeof updateUserLoginDisplay === 'function') {
                            updateUserLoginDisplay(activeUserId);
                        }
                        if (typeof initializeCategories === 'function') {
                            initializeCategories();
                        }
                        if (typeof initializeFilters === 'function') {
                            initializeFilters();
                        }
                        if (typeof updateTable === 'function') {
                            updateTable();
                        }
                        setupEventListeners();
                    }
                } else {
                    // No Google token - show login options
                    modal.style.display = 'none';
                    if (typeof showMasterPasswordModal === 'function') {
                        showMasterPasswordModal();
                    }
                }
            }
        } catch (error) {
            console.error('Error decrypting data:', error);
            if (errorDiv) {
                errorDiv.textContent = 'Invalid master key. Please try again.';
                errorDiv.style.display = 'block';
            }
            input.value = '';
            input.focus();
        }
    };
    
    // Handle Cancel button
    const handleCancel = () => {
        modal.style.display = 'none';
        // Clear active user and show login screen
        setActiveUserId(null);
        if (typeof showMasterPasswordModal === 'function') {
            showMasterPasswordModal();
        }
    };
    
    // Remove old listeners and add new ones
    okBtn.onclick = handleOk;
    cancelBtn.onclick = handleCancel;
    
    // Handle Enter key
    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            handleOk();
        }
    };
}

// Show dialog when Google token expired
function showGoogleTokenExpiredDialog() {
    // Don't show confirmation dialog - automatically trigger re-authorization
    // The ensureValidGoogleToken function will handle automatic re-authorization
    console.log('[AUTH] Google token expired - automatic re-authorization will be handled by ensureValidGoogleToken');
    
    // If we're in masterKeyOnlyModal, we already have master key - trigger re-auth immediately
    const masterKeyOnlyModal = document.getElementById('masterKeyOnlyModal');
    const masterKeyOnlyInput = document.getElementById('masterKeyOnlyInput');
    
    if (masterKeyOnlyModal && masterKeyOnlyModal.style.display !== 'none' && masterKeyOnlyInput && masterKeyOnlyInput.value) {
        // We have master key in masterKeyOnlyModal - use it for automatic re-auth
        const masterKey = masterKeyOnlyInput.value.trim();
        if (masterKey) {
            console.log('[AUTH] Master key available in masterKeyOnlyModal, triggering automatic re-authorization...');
            // Hide masterKeyOnlyModal and show masterPasswordModal with master key pre-filled
            masterKeyOnlyModal.style.display = 'none';
            const masterPasswordModal = document.getElementById('masterPasswordModal');
            const masterPasswordInput = document.getElementById('masterPasswordInput');
            if (masterPasswordModal && masterPasswordInput) {
                masterPasswordInput.value = masterKey;
                masterPasswordModal.style.display = 'flex';
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
                
                // Automatically trigger Google sign-in (this will call ensureValidGoogleToken which will handle re-auth)
                const googleBtn = document.getElementById('googleSignInBtn');
                if (googleBtn) {
                    // Small delay to ensure modal is visible
                    setTimeout(() => {
                        googleBtn.click();
                    }, 100);
                }
            }
            return;
        }
    }
    
    // Otherwise, show masterPasswordModal (user will enter master key, then automatic re-auth will happen)
    showMasterPasswordModal();
}

// Инициализация при загрузке страницы
// Initialize when page loads and translations are ready
async function initializeApp() {
    // Hide all modals by default
    const loginModal = document.getElementById('masterPasswordModal');
    const masterKeyModal = document.getElementById('masterKeyOnlyModal');
    const mainContainer = document.getElementById('mainContainer');
    
    if (loginModal) {
        loginModal.style.display = 'none';
    }
    if (masterKeyModal) {
        masterKeyModal.style.display = 'none';
    }
    if (mainContainer) {
        mainContainer.style.display = 'none';
    }
    
    // Wait for translations to load
    if (typeof loadTranslations === 'function') {
        await loadTranslations();
    }
    
    // Function to setup Google Sign In button when modules are loaded
    const setupGoogleButton = () => {
        if (typeof window.setupGoogleSignInButton === 'function') {
            window.setupGoogleSignInButton();
        }
    };
    
    // Listen for Google Drive modules loaded event
    document.addEventListener('googleDriveModulesLoaded', setupGoogleButton);
    
    // If modules are already loaded, setup button immediately
    if (typeof window.setupGoogleSignInButton === 'function') {
        setupGoogleButton();
    }
    
    // Check for active user
    const activeUserId = getActiveUserId();
    
    if (activeUserId) {
        // Check if data exists locally
        const hasLocalData = userDataExists(activeUserId);
        const hasLocalSalt = localStorage.getItem(getUserDataKey(activeUserId) + '_salt') !== null;
        
        if (hasLocalData && hasLocalSalt) {
            // Data and salt exist locally - show master key input modal
            showMasterKeyOnlyModal();
        } else if (hasLocalData && !hasLocalSalt) {
            // Data exists but salt is missing - try to load from Google Drive if it was Google login
            // For now, show error and login screen
            console.error('Salt not found locally for user:', activeUserId);
            setActiveUserId(null); // Clear active user
            showMasterPasswordModal();
        } else {
            // No local data - check if it was Google login and try to load from cloud
            // For now, show login screen
            setActiveUserId(null); // Clear active user
            showMasterPasswordModal();
        }
    } else {
        // No active user - show full login screen
        showMasterPasswordModal();
    }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function setupEventListeners() {
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const newCategoryInput = document.getElementById('newCategoryInput');
    const addPasswordBtn = document.getElementById('addPasswordBtn');
    const searchFilter = document.getElementById('searchFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', addCategory);
    }
    
    if (newCategoryInput) {
        newCategoryInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addCategory();
            }
        });
    }
    
    if (addPasswordBtn) {
        addPasswordBtn.addEventListener('click', addNewPasswordRow);
    }
    
    // Обработчики фильтров (loadFromLocalStorage уже вызван в начале инициализации)
    if (searchFilter) {
        searchFilter.addEventListener('input', (e) => {
            currentSearchFilter = e.target.value;
            updateTable();
        });
    }
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            selectedCategories = [];
            currentSearchFilter = '';
            if (searchFilter) searchFilter.value = '';
            updateCategoryFilterButtons();
            updateTable();
        });
    }
    
    // Обработчик для чекбокса удаления без подтверждения
    const deleteWithoutConfirm = document.getElementById('deleteWithoutConfirm');
    if (deleteWithoutConfirm) {
        deleteWithoutConfirm.addEventListener('change', () => {
            saveToLocalStorage();
        });
    }
    
    // Обработчик для скрытия/показа категорий
    const categoriesToggle = document.getElementById('categoriesToggle');
    const categoryContainer = document.getElementById('categoryContainer');
    if (categoriesToggle && categoryContainer) {
        categoriesToggle.addEventListener('click', () => {
            categoriesToggle.classList.toggle('collapsed');
            categoryContainer.classList.toggle('collapsed');
        });
    }
    
    // Обработчик для скрытия/показа списка паролей
    const passwordsToggle = document.getElementById('passwordsToggle');
    const passwordsContainer = document.getElementById('passwordsContainer');
    if (passwordsToggle && passwordsContainer) {
        passwordsToggle.addEventListener('click', () => {
            passwordsToggle.classList.toggle('collapsed');
            passwordsContainer.classList.toggle('collapsed');
        });
    }
    
    // Обработчики для экспорта/импорта
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExport);
    }
    
    const importFile = document.getElementById('importFile');
    if (importFile) {
        importFile.addEventListener('change', handleImport);
    }
}

