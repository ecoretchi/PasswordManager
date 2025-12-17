// Google Drive Conflict Resolution Module
// Handles conflict resolution dialog when versions differ

/**
 * Show conflict resolution dialog
 * @param {Object} cloudData - Cloud data object
 * @returns {Promise<void>}
 */
async function showConflictResolutionDialog(cloudData) {
    return new Promise((resolve) => {
        const modal = document.getElementById('syncConflictModal');
        const localInfo = document.getElementById('localConflictInfo');
        const cloudInfo = document.getElementById('cloudConflictInfo');
        const useLocalBtn = document.getElementById('useLocalBtn');
        const useCloudBtn = document.getElementById('useCloudBtn');
        const errorDiv = document.getElementById('syncConflictError');

        if (!modal || !localInfo || !cloudInfo || !useLocalBtn || !useCloudBtn) {
            console.error('Conflict modal elements not found');
            resolve();
            return;
        }

        // Get local info from new architecture
        const dataKey = getUserDataKey(currentUserLogin);
        const localVersion = parseInt(localStorage.getItem(dataKey + '_version') || '0', 10);
        const localModified = 'Unknown'; // Can be extracted from decrypted data if needed

        // Cloud info
        const cloudVersion = parseInt(cloudData.version || '0', 10);
        const cloudModified = cloudData.modifiedAt ? new Date(cloudData.modifiedAt).toLocaleString('en-US') : 'Unknown';

        // Render
        localInfo.innerHTML = `
            <div>Version: ${localVersion}</div>
            <div>Source: Local</div>
            <div>Modified: ${localModified}</div>
        `;

        cloudInfo.innerHTML = `
            <div>Version: ${cloudVersion}</div>
            <div>Source: Cloud</div>
            <div>Modified: ${cloudModified}</div>
        `;

        // Handlers for use buttons
        const handleUseLocal = async () => {
            try {
                // Use local data, upload to cloud
                const newVersion = localVersion + 1;
                localStorage.setItem(dataKey + '_version', newVersion.toString());
                await saveToLocalStorage(false, 0); // Save without increment (we already incremented)
                await syncToGoogleDrive(true);

                modal.style.display = 'none';
                updateGoogleDriveStatus('Conflict resolved: using local data');
                resolve();
            } catch (error) {
                console.error('Error using local data:', error);
                if (errorDiv) {
                    errorDiv.textContent = 'Error: ' + error.message;
                    errorDiv.style.display = 'block';
                }
            }
        };

        const handleUseCloud = async () => {
            try {
                // Use cloud data and save to storage (new architecture)
                localStorage.setItem(dataKey, cloudData.encryptedData);
                localStorage.setItem(dataKey + '_version', cloudVersion.toString());

                // Reload and update UI
                await loadFromLocalStorage(currentUserLogin);
                if (typeof updateCategoriesUI === 'function') {
                    updateCategoriesUI();
                }
                if (typeof updateTable === 'function') {
                    updateTable();
                }

                modal.style.display = 'none';
                updateGoogleDriveStatus('Conflict resolved: using cloud data');
                resolve();
            } catch (error) {
                console.error('Error using cloud data:', error);
                if (errorDiv) {
                    errorDiv.textContent = 'Error: ' + error.message;
                    errorDiv.style.display = 'block';
                }
            }
        };

        // Remove old handlers and add new ones
        useLocalBtn.replaceWith(useLocalBtn.cloneNode(true));
        useCloudBtn.replaceWith(useCloudBtn.cloneNode(true));

        const newUseLocalBtn = document.getElementById('useLocalBtn');
        const newUseCloudBtn = document.getElementById('useCloudBtn');

        newUseLocalBtn.addEventListener('click', handleUseLocal);
        newUseCloudBtn.addEventListener('click', handleUseCloud);

        // Show modal
        modal.style.display = 'flex';
    });
}

