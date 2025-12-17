// Google Drive File Manager Module
// Handles file operations: finding, creating, and managing files in Google Drive

/**
 * Find or create file in Google Drive
 * @returns {Promise<void>}
 */
async function findOrCreateDriveFile() {
    try {
        // Make sure token is set
        if (!googleDriveAccessToken) {
            throw new Error('Access token was not obtained');
        }

        // Search for existing file via fetch API (in root)
        const listUrl = `https://www.googleapis.com/drive/v3/files?q=name='${encodeURIComponent(GOOGLE_DRIVE_FILENAME)}' and trashed=false&fields=files(id,name)`;

        const listResponse = await fetch(listUrl, {
            headers: {
                'Authorization': `Bearer ${googleDriveAccessToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!listResponse.ok) {
            const errorData = await listResponse.json().catch(() => ({}));
            console.error('Error searching for file:', listResponse.status, errorData);

            // If 403, may need to re-auth for drive access
            if (listResponse.status === 403) {
                throw new Error('Insufficient permissions to access Google Drive. Check your OAuth scopes & permissions.');
            }

            throw new Error(`File search error: ${listResponse.status}`);
        }

        const listData = await listResponse.json();

        if (listData.files && listData.files.length > 0) {
            googleDriveFileId = listData.files[0].id;
            console.log('Google Drive file found:', googleDriveFileId);

            // Save fileId in storage
            saveGoogleTokensToStorage();
        } else {
            // Create new file in root
            const fileMetadata = {
                name: GOOGLE_DRIVE_FILENAME
            };

            const createResponse = await fetch('https://www.googleapis.com/drive/v3/files?fields=id', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${googleDriveAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(fileMetadata)
            });

            if (!createResponse.ok) {
                throw new Error(`File creation error: ${createResponse.status}`);
            }

            const createData = await createResponse.json();
            googleDriveFileId = createData.id;
            console.log('Created new Google Drive file:', googleDriveFileId);

            // Save fileId in storage
            saveGoogleTokensToStorage();

            // Immediately create file with default data
            // Note: This will be handled by createDefaultDriveFile from sync module
            // We just return here, the caller should handle file creation
        }
    } catch (error) {
        console.error('Error searching/creating file:', error);
        throw error;
    }
}

/**
 * Get file metadata from Google Drive (without downloading content)
 * @returns {Promise<Object|null>} File metadata with modifiedTime, md5Checksum, or null if not found
 */
async function getGoogleDriveFileMetadata() {
    if (!googleDriveAccessToken || !googleDriveFileId) {
        return null;
    }
    
    try {
        // Get file metadata (modifiedTime, md5Checksum if available)
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${googleDriveFileId}?fields=modifiedTime,md5Checksum,size`, {
            headers: {
                'Authorization': `Bearer ${googleDriveAccessToken}`
            }
        });
        
        // If 401 Unauthorized, try to refresh token and retry once
        if (response.status === 401) {
            console.log('Received 401 when getting metadata, attempting to refresh token...');
            if (typeof window !== 'undefined' && typeof window.ensureValidGoogleToken === 'function') {
                const tokenRefreshed = await window.ensureValidGoogleToken();
                if (tokenRefreshed) {
                    // Retry with new token
                    console.log('Retrying metadata request with refreshed token...');
                    response = await fetch(`https://www.googleapis.com/drive/v3/files/${googleDriveFileId}?fields=modifiedTime,md5Checksum,size`, {
                        headers: {
                            'Authorization': `Bearer ${googleDriveAccessToken}`
                        }
                    });
                } else {
                    console.error('Failed to refresh token in getGoogleDriveFileMetadata');
                }
            } else {
                console.error('ensureValidGoogleToken function is not available');
            }
        }
        
        if (!response.ok) {
            if (response.status === 404) {
                return null; // File not found
            }
            throw new Error(`Failed to get file metadata: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error getting file metadata:', error);
        return null;
    }
}

/**
 * Fetch Google Drive file data
 * @returns {Promise<Object|null>} File data or null if not found/invalid
 */
async function fetchGoogleDriveFileData() {
    if (!googleDriveAccessToken || !googleDriveFileId) {
        return null;
    }
    
    try {
        let response = await fetch(`https://www.googleapis.com/drive/v3/files/${googleDriveFileId}?alt=media`, {
            headers: {
                'Authorization': `Bearer ${googleDriveAccessToken}`
            }
        });
        
        // If 401 Unauthorized, try to refresh token and retry once
        if (response.status === 401) {
            console.log('Received 401 when fetching file, attempting to refresh token...');
            const ensureToken = window.ensureValidGoogleToken || (typeof ensureValidGoogleToken !== 'undefined' ? ensureValidGoogleToken : null);
            if (ensureToken && typeof ensureToken === 'function') {
                const tokenRefreshed = await ensureToken();
                if (tokenRefreshed) {
                    // Retry with new token
                    console.log('Retrying file fetch with refreshed token...');
                    response = await fetch(`https://www.googleapis.com/drive/v3/files/${googleDriveFileId}?alt=media`, {
                        headers: {
                            'Authorization': `Bearer ${googleDriveAccessToken}`
                        }
                    });
                }
            }
        }
        
        if (!response.ok) {
            if (response.status === 404) {
                return null; // File not found
            }
            throw new Error(`Failed to fetch file: ${response.status}`);
        }
        
        const responseText = await response.text();
        if (!responseText || responseText.trim() === '') {
            return null; // Empty file
        }
        
        const cloudData = JSON.parse(responseText);
        
        // Validate format
        if (cloudData.userId && cloudData.encryptedData !== undefined && cloudData.encryptionSalt) {
            return cloudData;
        }
        
        return null; // Invalid format
    } catch (error) {
        console.error('Error fetching Google Drive file:', error);
        return null;
    }
}

