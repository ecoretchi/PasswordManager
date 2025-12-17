// Google Drive UI Module
// Handles UI updates, status display, and sync animations

/**
 * Update Google Drive status message
 * @param {string} message - Status message to display
 */
function updateGoogleDriveStatus(message) {
    const statusDiv = document.getElementById('googleDriveStatus');
    if (statusDiv) {
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
    }
}

/**
 * Update sync status in UI for local/cloud
 * @returns {Promise<void>}
 */
async function updateSyncStatus() {
    const syncStatus = document.getElementById('syncStatus');
    const syncStatusText = document.getElementById('syncStatusText');

    if (!syncStatus || !syncStatusText) return;

    syncStatus.classList.remove('local', 'cloud');

    if (isGoogleSignIn && googleDriveAccessToken) {
        syncStatus.classList.add('cloud');
        
        // Get version to display - use local version as it's always up-to-date
        // Local version reflects the current state, even if sync hasn't happened yet
        let cloudVersionText = 'CLOUD SYNCED';
        if (currentUserLogin && typeof getUserDataKey === 'function') {
            const dataKey = getUserDataKey(currentUserLogin);
            const localVersion = localStorage.getItem(dataKey + '_version');
            if (localVersion) {
                cloudVersionText = `CLOUD SYNCED v.${localVersion}`;
            }
        }
        
        // Fallback: try to get from cloud if local version not available
        if (cloudVersionText === 'CLOUD SYNCED' && typeof fetchGoogleDriveFileData === 'function' && googleDriveFileId) {
            try {
                const cloudData = await fetchGoogleDriveFileData();
                if (cloudData && cloudData.version !== undefined) {
                    cloudVersionText = `CLOUD SYNCED v.${cloudData.version}`;
                }
            } catch (error) {
                // If can't fetch version, just show "CLOUD SYNCED"
                console.error('Error fetching cloud version for status:', error);
            }
        }
        
        syncStatusText.textContent = cloudVersionText;
    } else {
        syncStatus.classList.add('local');
        syncStatusText.textContent = 'local sync';
    }
}

/**
 * Show sync animation
 */
function showSyncAnimation() {
    const syncStatusText = document.getElementById('syncStatusText');
    const syncIndicator = document.getElementById('syncIndicator');

    if (!syncStatusText || !syncIndicator) return;

    syncStatusText.style.display = 'none';
    syncIndicator.style.display = 'flex';
}

/**
 * Hide sync animation
 */
function hideSyncAnimation() {
    const syncStatusText = document.getElementById('syncStatusText');
    const syncIndicator = document.getElementById('syncIndicator');

    if (!syncStatusText || !syncIndicator) return;

    syncStatusText.style.display = 'inline';
    syncIndicator.style.display = 'none';
}

