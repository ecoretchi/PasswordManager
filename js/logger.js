// Logger utility for debugging and monitoring
// Logs data operations to console and optionally to localStorage

const LOG_STORAGE_KEY = 'app_logs';
const MAX_LOG_ENTRIES = 100;

// Log levels
const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG'
};

// Get current timestamp
function getTimestamp() {
    return new Date().toISOString();
}

// Format log entry
function formatLogEntry(level, message, data = null) {
    const entry = {
        timestamp: getTimestamp(),
        level: level,
        message: message,
        data: data
    };
    return entry;
}

// Save log to localStorage
function saveLogToStorage(entry) {
    try {
        let logs = [];
        const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);
        if (storedLogs) {
            try {
                logs = JSON.parse(storedLogs);
            } catch (e) {
                logs = [];
            }
        }
        
        logs.push(entry);
        
        // Keep only last MAX_LOG_ENTRIES entries
        if (logs.length > MAX_LOG_ENTRIES) {
            logs = logs.slice(-MAX_LOG_ENTRIES);
        }
        
        localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
    } catch (error) {
        console.error('Failed to save log to storage:', error);
    }
}

// Log function
function log(level, message, data = null) {
    const entry = formatLogEntry(level, message, data);
    
    // Console output
    const consoleMessage = `[${entry.timestamp}] [${entry.level}] ${entry.message}`;
    if (data) {
        console.log(consoleMessage, data);
    } else {
        console.log(consoleMessage);
    }
    
    // Save to storage
    saveLogToStorage(entry);
}

// Public logging functions
function logInfo(message, data = null) {
    log(LOG_LEVELS.INFO, message, data);
}

function logWarn(message, data = null) {
    log(LOG_LEVELS.WARN, message, data);
}

function logError(message, data = null) {
    log(LOG_LEVELS.ERROR, message, data);
}

function logDebug(message, data = null) {
    log(LOG_LEVELS.DEBUG, message, data);
}

// Log data save operation
function logDataSave(operation, dataInfo) {
    logInfo(`Data save: ${operation}`, {
        categoriesCount: dataInfo.categoriesCount || 0,
        passwordsCount: dataInfo.passwordsCount || 0,
        version: dataInfo.version || 'N/A',
        dataSize: dataInfo.dataSize || 'N/A',
        loginType: dataInfo.loginType || 'N/A'
    });
}

// Log data load operation
function logDataLoad(operation, dataInfo) {
    logInfo(`Data load: ${operation}`, {
        categoriesCount: dataInfo.categoriesCount || 0,
        passwordsCount: dataInfo.passwordsCount || 0,
        version: dataInfo.version || 'N/A',
        source: dataInfo.source || 'N/A'
    });
}

// Get all logs
function getAllLogs() {
    try {
        const storedLogs = localStorage.getItem(LOG_STORAGE_KEY);
        if (storedLogs) {
            return JSON.parse(storedLogs);
        }
    } catch (error) {
        console.error('Failed to get logs:', error);
    }
    return [];
}

// Clear logs
function clearLogs() {
    localStorage.removeItem(LOG_STORAGE_KEY);
    logInfo('Logs cleared');
}

// Export logs as JSON
function exportLogs() {
    const logs = getAllLogs();
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `app_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
