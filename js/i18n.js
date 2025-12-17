// Internationalization helper functions
// This file provides additional utilities for i18n

// Function to update all UI elements with current language
function updateUIWithLanguage() {
    // Update login modal
    const loginTitle = document.querySelector('#masterPasswordModal h2');
    if (loginTitle) loginTitle.textContent = getText('login.title');
    
    const loginHint = document.querySelector('#masterPasswordModal .master-password-hint');
    if (loginHint) loginHint.textContent = getText('login.hint');
    
    const loginInput = document.getElementById('userLoginInput');
    if (loginInput) loginInput.placeholder = getText('login.placeholder');
    
    const masterKeyInput = document.getElementById('masterPasswordInput');
    if (masterKeyInput) masterKeyInput.placeholder = getText('login.masterKey.placeholder');
    
    const confirmKeyInput = document.getElementById('confirmPasswordInput');
    if (confirmKeyInput) confirmKeyInput.placeholder = getText('login.confirmKey.placeholder');
    
    const submitBtn = document.getElementById('masterPasswordSubmit');
    if (submitBtn) submitBtn.textContent = getText('login.button');
    
    const createBtn = document.getElementById('masterPasswordCreate');
    if (createBtn) createBtn.textContent = getText('login.create');
    
    const cancelBtn = document.getElementById('masterPasswordCancel');
    if (cancelBtn) cancelBtn.textContent = getText('login.cancel');
    
    const resetBtn = document.getElementById('masterPasswordReset');
    if (resetBtn) resetBtn.textContent = getText('login.reset');
    
    const googleSignInBtn = document.getElementById('googleSignInBtn');
    if (googleSignInBtn) {
        const svg = googleSignInBtn.querySelector('svg');
        googleSignInBtn.innerHTML = '';
        if (svg) googleSignInBtn.appendChild(svg);
        googleSignInBtn.appendChild(document.createTextNode(' ' + getText('login.googleSignIn')));
    }
    
    const orDivider = document.querySelector('.google-signin-divider span');
    if (orDivider) orDivider.textContent = getText('login.or');
    
    // Update main app
    const appTitle = document.querySelector('header h1');
    if (appTitle) appTitle.textContent = getText('app.title');
    
    const userLabel = document.querySelector('.user-label');
    if (userLabel) userLabel.textContent = getText('app.user');
    
    // Update categories section
    const categoriesTitle = document.querySelector('#categoriesToggle span:first-child');
    if (categoriesTitle) categoriesTitle.textContent = getText('categories.title');
    
    const newCategoryInput = document.getElementById('newCategoryInput');
    if (newCategoryInput) newCategoryInput.placeholder = getText('categories.new.placeholder');
    
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) addCategoryBtn.textContent = getText('categories.add');
    
    const deleteWithoutConfirmLabel = document.querySelector('label[for="deleteWithoutConfirm"]');
    if (deleteWithoutConfirmLabel) {
        const checkbox = document.getElementById('deleteWithoutConfirm');
        if (checkbox) {
            deleteWithoutConfirmLabel.innerHTML = '';
            deleteWithoutConfirmLabel.appendChild(checkbox);
            deleteWithoutConfirmLabel.appendChild(document.createTextNode(' ' + getText('categories.deleteWithoutConfirm')));
        }
    }
    
    // Update passwords section
    const passwordsTitle = document.querySelector('#passwordsToggle span:first-child');
    if (passwordsTitle) passwordsTitle.textContent = getText('passwords.title');
    
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.textContent = getText('passwords.export');
    
    const importLabel = document.querySelector('.import-btn-label');
    if (importLabel) {
        const input = importLabel.querySelector('input');
        importLabel.innerHTML = '';
        if (input) {
            importLabel.appendChild(input);
            importLabel.appendChild(document.createTextNode(getText('passwords.import')));
        }
    }
    
    const categoryFilterLabel = document.querySelector('.category-filters-group label');
    if (categoryFilterLabel) categoryFilterLabel.textContent = getText('passwords.filter.category');
    
    const searchFilterLabel = document.querySelector('label[for="searchFilter"]');
    if (searchFilterLabel) searchFilterLabel.textContent = getText('passwords.filter.search');
    
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) searchFilter.placeholder = getText('passwords.filter.search.placeholder');
    
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn) clearFiltersBtn.textContent = getText('passwords.filter.clear');
    
    const addPasswordBtn = document.getElementById('addPasswordBtn');
    if (addPasswordBtn) addPasswordBtn.textContent = getText('passwords.add');
    
    // Update table headers (will be updated in updateTable function)
    if (typeof updateTable === 'function') {
        updateTable();
    }
    
    // Update category filter buttons
    if (typeof updateCategoryFilter === 'function') {
        updateCategoryFilter();
    }
    
    // Update categories list
    if (typeof updateCategoriesUI === 'function') {
        updateCategoriesUI();
    }
}

// Function to create language selector
function createLanguageSelector() {
    const header = document.querySelector('header');
    if (!header) return;
    
    // Check if selector already exists
    if (document.getElementById('languageSelector')) return;
    
    const languageDiv = document.createElement('div');
    languageDiv.id = 'languageSelector';
    languageDiv.className = 'language-selector';
    languageDiv.style.cssText = 'margin-left: 20px; display: flex; align-items: center; gap: 10px;';
    
    const label = document.createElement('span');
    label.textContent = 'Language:';
    label.style.cssText = 'font-size: 14px; color: #666;';
    
    const select = document.createElement('select');
    select.id = 'languageSelect';
    select.style.cssText = 'padding: 5px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;';
    
    const optionEn = document.createElement('option');
    optionEn.value = 'en';
    optionEn.textContent = languageNames.en;
    if (currentLanguage === 'en') optionEn.selected = true;
    
    const optionRu = document.createElement('option');
    optionRu.value = 'ru';
    optionRu.textContent = languageNames.ru;
    if (currentLanguage === 'ru') optionRu.selected = true;
    
    select.appendChild(optionEn);
    select.appendChild(optionRu);
    
    select.addEventListener('change', (e) => {
        setLanguage(e.target.value);
        updateUIWithLanguage();
    });
    
    languageDiv.appendChild(label);
    languageDiv.appendChild(select);
    
    const headerRight = document.querySelector('.header-right');
    if (headerRight) {
        headerRight.appendChild(languageDiv);
    } else {
        header.appendChild(languageDiv);
    }
}

// Initialize language selector when DOM is ready and translations are loaded
async function initializeLanguageUI() {
    // Wait for translations to load
    if (typeof loadTranslations === 'function') {
        await loadTranslations();
    }
    
    createLanguageSelector();
    updateUIWithLanguage();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLanguageUI);
} else {
    initializeLanguageUI();
}
