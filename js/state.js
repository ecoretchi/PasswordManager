// Global application state

// Categories for dropdown list (games, email, misc, etc.)
let passwordCategories = ['Games', 'Email', 'Banks', 'Social Networks', 'Work', 'Misc'];

// Data storage
let passwords = [];
let passwordsVisible = {}; // Stores password visibility state for each row

// Filters
let selectedCategories = []; // Array of selected categories
let currentSearchFilter = '';

// Cryptography
let masterKey = null; // Master key for data encryption
let encryptionKey = null;
let currentUserLogin = null;

// Google Drive synchronization
let googleDriveAccessToken = null;
let googleDriveRefreshToken = null; // Refresh token for updating access token
let googleDriveFileId = null;
let googleDriveUserEmail = null; // Google user email for saving tokens
let syncTimer = null;
let syncDebounceTimer = null; // Timer for debounce synchronization
let hasPendingChanges = false;
let versionNeedsIncrement = false; // Flag to track if version needs increment on sync
let lastSyncTime = null;
let lastCloudHashVersion = null; // Last known cloud hash version for comparison
let lastCloudModifiedTime = null; // Last known cloud file modified time for comparison
let isGoogleSignIn = false;

