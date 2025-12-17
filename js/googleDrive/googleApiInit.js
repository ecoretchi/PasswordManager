// Google API Initialization Module
// Handles initialization and protocol checks for Google API

/**
 * Initialize Google API client
 * @returns {Promise<void>}
 */
async function initGoogleAPI() {
    return new Promise((resolve, reject) => {
        // Check if gapi is loaded
        if (typeof gapi === 'undefined') {
            reject(new Error('Google API is not loaded. Check that Google scripts are included.'));
            return;
        }

        gapi.load('client', () => {
            gapi.client.init({
                apiKey: GOOGLE_API_KEY,
                discoveryDocs: DISCOVERY_DOCS
            }).then(() => {
                console.log('Google API initialized');
                resolve();
            }).catch((error) => {
                console.error('Error initializing Google API:', error);
                // More informative error message for API discovery problems
                if (error.message && error.message.includes('API discovery')) {
                    reject(new Error('Failed to load Google Drive API. Check that API_KEY is correct and that Google Drive API is enabled in your project.'));
                } else {
                    reject(error);
                }
            });
        });
    });
}

// initGoogleSignIn() removed - initialization is performed via OAuth token client

/**
 * Check if protocol is HTTP/HTTPS (required for OAuth)
 * @returns {boolean}
 */
function checkProtocol() {
    if (window.location.protocol === 'file:') {
        return false;
    }
    return true;
}
