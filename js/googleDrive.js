// Google Drive Integration - Main Entry Point
// Dynamically loads all Google Drive modules in correct order

(function() {
    'use strict';
    
    // List of modules to load in dependency order
    const modules = [
        'js/googleDrive/googleApiInit.js',
        'js/googleDrive/googleOAuth.js',
        'js/googleDrive/googleDriveFileManager.js',
        'js/googleDrive/googleDriveUI.js',
        'js/googleDrive/googleDriveSync.js',
        'js/googleDrive/googleDriveAuth.js',
        'js/googleDrive/googleDriveConflict.js'
    ];
    
    // Load modules sequentially to maintain dependency order
    async function loadModules() {
        for (const modulePath of modules) {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = modulePath;
                script.async = false; // Important: load sequentially, not in parallel
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load ${modulePath}`));
                document.head.appendChild(script);
            });
        }
        
        // Initialize Google Sign In button after all modules are loaded
        // Function is already available globally via window.setupGoogleSignInButton
        if (typeof window.setupGoogleSignInButton === 'function') {
            window.setupGoogleSignInButton();
        }
        
        // Dispatch custom event to notify that Google Drive modules are loaded
        const event = new CustomEvent('googleDriveModulesLoaded', {
            detail: { setupGoogleSignInButton: window.setupGoogleSignInButton }
        });
        document.dispatchEvent(event);
    }
    
    // Start loading when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadModules);
    } else {
        loadModules();
    }
})();

