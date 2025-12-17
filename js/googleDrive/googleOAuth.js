// Google OAuth Module
// Handles OAuth 2.0 authentication, token management, and user info

/**
 * Save Google tokens to storage (DEPRECATED)
 * Tokens are now saved inside encrypted PM_DATA::<userId>
 * This function is kept for backward compatibility
 * @param {string|null} email - User email
 */
function saveGoogleTokensToStorage(email = null) {
    // DEPRECATED: Google tokens are now saved inside encrypted PM_DATA::<userId>
    // This function is kept for backward compatibility but tokens are saved via saveToLocalStorage()
    // Save email in global for current session
    if (email) {
        googleDriveUserEmail = email;
    }
    
    // Tokens will be saved in encrypted data via saveToLocalStorage()
    // Only save email for session use
    console.log('Google tokens will be saved in encrypted data');
}

/**
 * Load Google tokens from storage (legacy support)
 * @param {string|null} email - User email
 * @returns {Object|null} Tokens data or null
 */
function loadGoogleTokensFromStorage(email = null) {
    // Search tokens by email, otherwise use currentUserLogin
    const identifier = email || currentUserLogin;
    if (!identifier) {
        // If no identifier, search all saved Google tokens (and return the not-too-old one)
        const allKeys = Object.keys(localStorage);
        for (const key of allKeys) {
            if (key.startsWith('google_tokens_')) {
                try {
                    const tokensData = JSON.parse(localStorage.getItem(key));
                    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
                    if (Date.now() - tokensData.savedAt <= maxAge) {
                        return tokensData;
                    }
                } catch (e) {
                    // Skip corrupted data
                }
            }
        }
        return null;
    }

    const storageKey = `google_tokens_${btoa(identifier).replace(/[+/=]/g, '')}`;
    const savedData = localStorage.getItem(storageKey);

    if (!savedData) return null;

    try {
        const tokensData = JSON.parse(savedData);
        // Check that tokens are not too old (not older than 7 days)
        const maxAge = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - tokensData.savedAt > maxAge) {
            localStorage.removeItem(storageKey);
            return null;
        }
        return tokensData;
    } catch (error) {
        console.error('Error loading tokens:', error);
        return null;
    }
}

/**
 * Check if Google access token is valid
 * @param {string} accessToken - Access token to validate
 * @returns {Promise<boolean>}
 */
async function checkGoogleTokenValidity(accessToken) {
    if (!accessToken) return false;

    try {
        // Test call to Google OAuth tokeninfo endpoint
        const response = await fetch('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + accessToken);
        if (response.ok) {
            const data = await response.json();
            // Check that the token hasn't expired
            if (data.expires_in && data.expires_in > 0) {
                return true;
            }
        }
        return false;
    } catch (error) {
        console.error('Error checking token validity:', error);
        return false;
    }
}

/**
 * Refresh Google access token using refresh token
 * @param {string} refreshToken - Refresh token
 * @returns {Promise<string>} New access token
 */
async function refreshGoogleAccessToken(refreshToken) {
    if (!refreshToken) {
        throw new Error('Refresh token not found');
    }

    try {
        // Refreshing token in browser requires Google Identity Services
        if (typeof gapi !== 'undefined' && gapi.client) {
            return new Promise((resolve, reject) => {
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: GOOGLE_CLIENT_ID,
                    scope: SCOPES,
                    callback: (response) => {
                        if (response.error) {
                            reject(new Error(response.error));
                        } else {
                            resolve(response.access_token);
                        }
                    }
                });

                // Request a new token silently
                tokenClient.requestAccessToken({ prompt: '' });
            });
        } else {
            throw new Error('Google API is not loaded');
        }
    } catch (error) {
        console.error('Error refreshing access token:', error);
        throw error;
    }
}

/**
 * Check saved tokens and validate them
 * @returns {Promise<Object|null>} Valid tokens or null
 */
async function checkSavedTokens() {
    const savedToken = loadGoogleTokensFromStorage();
    if (savedToken && savedToken.accessToken) {
        // Validate saved token
        try {
            const isValid = await checkGoogleTokenValidity(savedToken.accessToken);
            if (isValid) {
                googleDriveAccessToken = savedToken.accessToken;
                googleDriveRefreshToken = savedToken.refreshToken;
                googleDriveFileId = savedToken.fileId;
                gapi.client.setToken({ access_token: googleDriveAccessToken });
                console.log('Using saved Google Drive token');

                // Load user info and sign in
                try {
                    const userInfo = await getUserInfoFromGoogle();
                    console.log('User info obtained:', userInfo.email);

                    // Save/refresh email and tokens
                    googleDriveUserEmail = userInfo.email;
                    saveGoogleTokensToStorage(userInfo.email);

                    return {
                        accessToken: googleDriveAccessToken,
                        refreshToken: googleDriveRefreshToken,
                        fileId: googleDriveFileId,
                        email: userInfo.email,
                        userInfo: userInfo
                    };
                } catch (error) {
                    console.error('Error fetching user info:', error);
                    // Use saved email if available
                    if (savedToken.email) {
                        googleDriveUserEmail = savedToken.email;
                        saveGoogleTokensToStorage(savedToken.email);
                    }
                    return {
                        accessToken: googleDriveAccessToken,
                        refreshToken: googleDriveRefreshToken,
                        fileId: googleDriveFileId,
                        email: savedToken.email || null
                    };
                }
            } else {
                // Token not valid, try refreshing
                if (savedToken.refreshToken) {
                    try {
                        const newToken = await refreshGoogleAccessToken(savedToken.refreshToken);
                        googleDriveAccessToken = newToken;
                        gapi.client.setToken({ access_token: googleDriveAccessToken });
                        console.log('Google Drive token refreshed');

                        try {
                            const userInfo = await getUserInfoFromGoogle();
                            console.log('User info obtained:', userInfo.email);

                            // Save refreshed tokens with email
                            saveGoogleTokensToStorage(userInfo.email);

                            return {
                                accessToken: googleDriveAccessToken,
                                refreshToken: savedToken.refreshToken,
                                fileId: savedToken.fileId,
                                email: userInfo.email,
                                userInfo: userInfo
                            };
                        } catch (error) {
                            console.error('Error fetching user info:', error);
                            saveGoogleTokensToStorage(savedToken.email || null);
                            return {
                                accessToken: googleDriveAccessToken,
                                refreshToken: savedToken.refreshToken,
                                fileId: savedToken.fileId,
                                email: savedToken.email || null
                            };
                        }
                    } catch (refreshError) {
                        console.log('Could not refresh token, requesting new token');
                        return null;
                    }
                }
            }
        } catch (checkError) {
            console.log('Error checking token validity, requesting new token');
            return null;
        }
    }
    return null;
}

/**
 * Request new Google access token
 * @returns {Promise<Object>} Token response with access token
 */
async function requestNewToken() {
    return new Promise((resolve, reject) => {
        if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
            reject(new Error('Google OAuth API is not loaded. Make sure Google scripts are included.'));
            return;
        }

        try {
            const tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: GOOGLE_CLIENT_ID,
                scope: SCOPES,
                callback: async (response) => {
                    if (response.error) {
                        // User cancelled
                        if (response.error === 'popup_closed_by_user' || response.error === 'access_denied') {
                            console.log('User cancelled authorization');
                            reject(new Error('Authorization cancelled'));
                            return;
                        }
                        reject(new Error(response.error));
                        return;
                    }

                    // Success
                    googleDriveAccessToken = response.access_token;
                    if (response.refresh_token) {
                        googleDriveRefreshToken = response.refresh_token;
                    }
                    console.log('Obtained Google Drive access token');

                    // Set token for gapi client
                    gapi.client.setToken({ access_token: googleDriveAccessToken });

                    try {
                        const userInfo = await getUserInfoFromGoogle();
                        console.log('User info obtained:', userInfo.email);

                        // Save tokens with email
                        saveGoogleTokensToStorage(userInfo.email);

                        resolve({
                            accessToken: googleDriveAccessToken,
                            refreshToken: googleDriveRefreshToken,
                            email: userInfo.email,
                            userInfo: userInfo
                        });
                    } catch (error) {
                        console.error('Error fetching user info:', error);
                        // Save tokens without email
                        saveGoogleTokensToStorage();
                        resolve({
                            accessToken: googleDriveAccessToken,
                            refreshToken: googleDriveRefreshToken,
                            email: null
                        });
                    }
                }
            });

            // No valid saved token, prompt for new one (silent mode if possible)
            tokenClient.requestAccessToken({
                prompt: ''
            });
        } catch (error) {
            console.error('Error initializing OAuth client:', error);
            reject(new Error('Error initializing OAuth: ' + error.message));
        }
    });
}

/**
 * Get Google Drive access token (main OAuth flow)
 * @returns {Promise<string>} Access token
 */
async function getGoogleDriveAccessToken() {
    // Check protocol for OAuth
    if (!checkProtocol()) {
        const errorMsg = 'Google OAuth requires launching from an HTTP/HTTPS server.\n\n' +
                        'For local development, use a local server:\n\n' +
                        'Python 3:\n' +
                        '  python -m http.server 8000\n\n' +
                        'Node.js (npx):\n' +
                        '  npx http-server -p 8000\n\n' +
                        'Then open: http://localhost:8000';
        alert(errorMsg);
        throw new Error('App must be launched over HTTP/HTTPS server');
    }

    // First, check if there is a saved token
    const savedTokenData = await checkSavedTokens();
    if (savedTokenData) {
        return savedTokenData.accessToken;
    }

    // No valid saved token, request new one
    const newTokenData = await requestNewToken();
    return newTokenData.accessToken;
}

/**
 * Get user info from Google
 * @returns {Promise<Object>} User info object
 */
async function getUserInfoFromGoogle() {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${googleDriveAccessToken}`
            }
        });

        if (!response.ok) {
            throw new Error('Could not get user info from Google');
        }

        return await response.json();
    } catch (error) {
        console.error('Error getting user info:', error);
        throw error;
    }
}

