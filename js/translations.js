// Translations for Password Manager
// Loads translations from JSON files

// Language names
const languageNames = {
    en: 'English',
    ru: 'Русский'
};

// Translations storage
let translations = {
    en: {},
    ru: {}
};

// Current language (default: English)
let currentLanguage = 'en';

// Translation loading promise
let translationsLoaded = false;
let translationsLoadPromise = null;

// Function to load translations from JSON files
async function loadTranslations() {
    if (translationsLoaded) {
        return Promise.resolve();
    }
    
    if (translationsLoadPromise) {
        return translationsLoadPromise;
    }
    
    translationsLoadPromise = Promise.all([
        fetch('js/lang/en.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load en.json: ${response.status}`);
                }
                // Use arrayBuffer() and TextDecoder for explicit UTF-8 handling
                return response.arrayBuffer();
            })
            .then(buffer => {
                // Explicitly decode as UTF-8
                const decoder = new TextDecoder('utf-8');
                const text = decoder.decode(buffer);
                translations.en = JSON.parse(text);
            })
            .catch(error => {
                console.error('Error loading English translations:', error);
                translations.en = {};
            }),
        fetch('js/lang/ru.json')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Failed to load ru.json: ${response.status}`);
                }
                return response.arrayBuffer();
            })
            .then(buffer => {
                // Decode as Windows-1251 (cp1251)
                const decoder = new TextDecoder('windows-1251');
                const text = decoder.decode(buffer);
                translations.ru = JSON.parse(text);
            })
            .catch(error => {
                console.error('Error loading Russian translations:', error);
                translations.ru = {};
            })
    ]).then(() => {
        translationsLoaded = true;
    });
    
    return translationsLoadPromise;
}

// Function to get translated text by ID
function getText(textId, params = {}) {
    // If translations not loaded yet, return textId as fallback
    if (!translationsLoaded) {
        console.warn('Translations not loaded yet, returning textId:', textId);
        return textId;
    }
    
    const translation = translations[currentLanguage]?.[textId] || translations['en']?.[textId] || textId;
    
    // Replace placeholders like {count}, {name}, etc.
    if (params && Object.keys(params).length > 0) {
        return translation.replace(/\{(\w+)\}/g, (match, key) => {
            return params[key] !== undefined ? params[key] : match;
        });
    }
    
    return translation;
}

// Function to set language
function setLanguage(lang) {
    if (translations[lang] && Object.keys(translations[lang]).length > 0) {
        currentLanguage = lang;
        localStorage.setItem('appLanguage', lang);
        // Reload UI with new language
        if (typeof updateUIWithLanguage === 'function') {
            updateUIWithLanguage();
        }
        return true;
    }
    return false;
}

// Load saved language preference
function loadLanguagePreference() {
    const savedLang = localStorage.getItem('appLanguage');
    if (savedLang && (savedLang === 'en' || savedLang === 'ru')) {
        currentLanguage = savedLang;
    }
}

// Initialize translations and language preference
async function initializeTranslations() {
    loadLanguagePreference();
    await loadTranslations();
    
    // If UI update function exists, call it after translations are loaded
    if (typeof updateUIWithLanguage === 'function') {
        updateUIWithLanguage();
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeTranslations);
} else {
    initializeTranslations();
}
