// passwords.js
// Automatically generated from script.js

// Field names mapping for backward compatibility
const FIELD_NAMES = {
    SERVICE: 'Service / Site',
    LOGIN: 'Login',
    PASSWORD: 'Password',
    CATEGORY: 'Category',
    NOTE: 'Note'
};

// Hash ID field name (hidden, used for synchronization)
const HASH_ID_FIELD = '_hashId';

/**
 * Generate a unique Hash ID for a password entry (32 bytes)
 * @returns {string} Base64-encoded hash ID
 */
async function generatePasswordHashId() {
    // Generate 32 random bytes
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    
    // Convert to base64 for storage
    const binaryString = String.fromCharCode(...randomBytes);
    return btoa(binaryString);
}

// Hash ID access is done directly via password._hashId
// No need for separate getter/setter functions

// Legacy field names (Russian) for backward compatibility
const LEGACY_FIELD_NAMES = {
    SERVICE: ' / ',
    LOGIN: '',
    PASSWORD: '',
    CATEGORY: '',
    NOTE: ''
};

// Helper function to get field value with backward compatibility
function getPasswordField(password, fieldName) {
    if (!password) return '';
    // Try new English field name first
    if (password[FIELD_NAMES[fieldName]] !== undefined) {
        return password[FIELD_NAMES[fieldName]];
    }
    // Fall back to legacy Russian field name
    if (password[LEGACY_FIELD_NAMES[fieldName]] !== undefined) {
        return password[LEGACY_FIELD_NAMES[fieldName]];
    }
    return '';
}

// Helper function to set field value (always use English)
function setPasswordField(password, fieldName, value) {
    if (!password) return;
    password[FIELD_NAMES[fieldName]] = value;
    // Remove legacy field if exists
    if (password[LEGACY_FIELD_NAMES[fieldName]] !== undefined) {
        delete password[LEGACY_FIELD_NAMES[fieldName]];
    }
}

function filterPasswords() {
    return passwords.filter((password, index) => {
        // Filter by categories (if categories selected)
        if (selectedCategories.length > 0) {
            const passwordCategory = getPasswordField(password, 'CATEGORY').toLowerCase();
            const selectedCategoriesLower = selectedCategories.map(cat => cat.toLowerCase());
            if (!selectedCategoriesLower.includes(passwordCategory)) {
                return false;
            }
        }
        
        // Filter by search query
        if (currentSearchFilter) {
            const searchText = currentSearchFilter.toLowerCase();
            const searchableFields = [
                getPasswordField(password, 'SERVICE'),
                getPasswordField(password, 'LOGIN'),
                getPasswordField(password, 'PASSWORD'),
                getPasswordField(password, 'CATEGORY'),
                getPasswordField(password, 'NOTE')
            ];
            
            const matches = searchableFields.some(field => 
                field.toLowerCase().includes(searchText)
            );
            
            if (!matches) {
                return false;
            }
        }
        
        return true;
    });
}

function updateTable() {
    const tableHead = document.getElementById('tableHead');
    const tableBody = document.getElementById('tableBody');
    
    // Удаляем все старые меню категорий из body
    document.querySelectorAll('.category-menu').forEach(menu => {
        menu.remove();
    });
    
    // Очистка
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';
    
    // Создание заголовков (фиксированные колонки)
    const headerRow = document.createElement('tr');
    
    // Service / Site
    const serviceTh = document.createElement('th');
    serviceTh.textContent = getText('passwords.table.service');
    headerRow.appendChild(serviceTh);
    
    // Login
    const loginTh = document.createElement('th');
    loginTh.textContent = getText('passwords.table.login');
    headerRow.appendChild(loginTh);
    
    // Password
    const passwordTh = document.createElement('th');
    passwordTh.textContent = getText('passwords.table.password');
    headerRow.appendChild(passwordTh);
    
    // Show/Hide
    const eyeTh = document.createElement('th');
    eyeTh.textContent = '';
    eyeTh.style.textAlign = 'center';
    headerRow.appendChild(eyeTh);
    
    // Category
    const categoryTh = document.createElement('th');
    categoryTh.textContent = getText('passwords.table.category');
    headerRow.appendChild(categoryTh);
    
    // Note
    const noteTh = document.createElement('th');
    noteTh.textContent = getText('passwords.table.note');
    headerRow.appendChild(noteTh);
    
    // Actions
    const deleteTh = document.createElement('th');
    deleteTh.textContent = getText('passwords.table.actions');
    deleteTh.style.textAlign = 'center';
    headerRow.appendChild(deleteTh);
    
    tableHead.appendChild(headerRow);
    
    // Фильтруем пароли с сохранением индексов
    const filteredPasswordsWithIndex = passwords
        .map((password, index) => ({ password, index }))
        .filter(({ password }) => {
            // Filter by categories (if categories selected)
            if (selectedCategories.length > 0) {
                const passwordCategory = getPasswordField(password, 'CATEGORY').toLowerCase();
                const selectedCategoriesLower = selectedCategories.map(cat => cat.toLowerCase());
                if (!selectedCategoriesLower.includes(passwordCategory)) {
                    return false;
                }
            }
            
            // Filter by search query
            if (currentSearchFilter) {
                const searchText = currentSearchFilter.toLowerCase();
                const searchableFields = [
                    getPasswordField(password, 'SERVICE'),
                    getPasswordField(password, 'LOGIN'),
                    getPasswordField(password, 'PASSWORD'),
                    getPasswordField(password, 'CATEGORY'),
                    getPasswordField(password, 'NOTE')
                ];
                
                const matches = searchableFields.some(field => 
                    field.toLowerCase().includes(searchText)
                );
                
                if (!matches) {
                    return false;
                }
            }
            
            return true;
        });
    
    // Добавляем строки с паролями
    if (filteredPasswordsWithIndex.length === 0) {
        const emptyRow = document.createElement('tr');
        const emptyCell = document.createElement('td');
        emptyCell.colSpan = 7; // Всего 7 колонок
        emptyCell.className = 'empty-message';
        if (passwords.length === 0) {
            emptyCell.textContent = getText('passwords.table.empty');
        } else {
            emptyCell.textContent = getText('passwords.table.empty.filtered');
        }
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
    } else {
        filteredPasswordsWithIndex.forEach(({ password, index }) => {
            addPasswordRow(password, index);
        });
    }
}

function addPasswordRow(passwordData, index) {
    const tableBody = document.getElementById('tableBody');
    const row = document.createElement('tr');
    row.dataset.index = index;
    
    // Сервис / сайт
    const serviceTd = document.createElement('td');
    const serviceInput = document.createElement('input');
    serviceInput.type = 'text';
    serviceInput.value = getPasswordField(passwordData, 'SERVICE');
    serviceInput.placeholder = getText('passwords.service.placeholder');
    serviceInput.addEventListener('input', (e) => {
        if (!passwords[index]) passwords[index] = {};
        const oldValue = getPasswordField(passwords[index], 'SERVICE');
        setPasswordField(passwords[index], 'SERVICE', e.target.value);
        console.log('[USER ACTION] Service field edited:', { index, oldValue, newValue: e.target.value, timestamp: new Date().toISOString() });
        saveToLocalStorage();
    });
    serviceTd.appendChild(serviceInput);
    row.appendChild(serviceTd);
    
    // Login
    const loginTd = document.createElement('td');
    const loginInput = document.createElement('input');
    loginInput.type = 'text';
    loginInput.value = getPasswordField(passwordData, 'LOGIN');
    loginInput.placeholder = getText('passwords.login.placeholder');
    loginInput.addEventListener('input', (e) => {
        if (!passwords[index]) passwords[index] = {};
        const oldValue = getPasswordField(passwords[index], 'LOGIN');
        const wasDraft = passwords[index]._isDraft;
        setPasswordField(passwords[index], 'LOGIN', e.target.value);
        // Remove draft flag when user starts entering data
        if (passwords[index]._isDraft) {
            delete passwords[index]._isDraft;
            console.log('[USER ACTION] Login field edited - draft flag removed:', { index, wasDraft, timestamp: new Date().toISOString() });
        } else {
            console.log('[USER ACTION] Login field edited:', { index, oldValue, newValue: e.target.value, timestamp: new Date().toISOString() });
        }
        saveToLocalStorage();
    });
    loginTd.appendChild(loginInput);
    row.appendChild(loginTd);
    
    // Password
    const passwordTd = document.createElement('td');
    passwordTd.className = 'password-cell';
    const passwordInput = document.createElement('input');
    passwordInput.type = passwordsVisible[index] ? 'text' : 'password';
    passwordInput.className = 'password-input';
    passwordInput.value = getPasswordField(passwordData, 'PASSWORD');
    passwordInput.placeholder = getText('passwords.password.placeholder');
    passwordInput.addEventListener('input', (e) => {
        if (!passwords[index]) passwords[index] = {};
        const wasDraft = passwords[index]._isDraft;
        setPasswordField(passwords[index], 'PASSWORD', e.target.value);
        // Remove draft flag when user starts entering data
        if (passwords[index]._isDraft) {
            delete passwords[index]._isDraft;
            console.log('[USER ACTION] Password field edited - draft flag removed:', { index, wasDraft, timestamp: new Date().toISOString() });
        } else {
            console.log('[USER ACTION] Password field edited:', { index, timestamp: new Date().toISOString() });
        }
        saveToLocalStorage();
    });
    passwordTd.appendChild(passwordInput);
    row.appendChild(passwordTd);
    
    // Показать/Скрыть
    const eyeTd = document.createElement('td');
    eyeTd.style.textAlign = 'center';
    const eyeBtn = document.createElement('button');
    eyeBtn.className = 'toggle-password';
    eyeBtn.textContent = '';
    eyeBtn.onclick = () => togglePasswordVisibility(index);
    eyeTd.appendChild(eyeBtn);
    row.appendChild(eyeTd);
    
    // Категория (прозрачная кнопка с текстом категории)
    const categoryTd = document.createElement('td');
    categoryTd.className = 'category-cell';
    
    const categoryContainer = document.createElement('div');
    categoryContainer.className = 'category-select-container';
    
    // Кнопка с текстом категории (вместо отдельного текста и кнопки)
    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = 'select-category-btn';
    selectBtn.textContent = getPasswordField(passwordData, 'CATEGORY') || getText('passwords.category.empty');
    categoryContainer.appendChild(selectBtn);
    
    // Контекстное меню (создаем в body)
    const categoryMenu = document.createElement('div');
    categoryMenu.className = 'category-menu';
    categoryMenu.style.display = 'none';
    categoryMenu.dataset.rowIndex = index; // Сохраняем индекс строки
    
    // Функция закрытия меню
    const closeCategoryMenu = () => {
        categoryMenu.style.display = 'none';
    };
    
    // Функция открытия меню с правильным позиционированием
    const openCategoryMenu = () => {
        // Закрываем все другие меню
        document.querySelectorAll('.category-menu').forEach(menu => {
            if (menu !== categoryMenu) {
                menu.style.display = 'none';
            }
        });
        
        // Вычисляем позицию кнопки
        const rect = selectBtn.getBoundingClientRect();
        
        // Позиционируем меню
        categoryMenu.style.position = 'fixed';
        categoryMenu.style.top = (rect.bottom + 4) + 'px';
        categoryMenu.style.left = rect.left + 'px';
        categoryMenu.style.width = Math.max(rect.width, 150) + 'px';
        categoryMenu.style.zIndex = '10000';
        categoryMenu.style.display = 'block';
        
        // Проверяем, не выходит ли меню за нижний край экрана (после отрисовки)
        requestAnimationFrame(() => {
            const menuHeight = categoryMenu.offsetHeight || categoryMenu.scrollHeight;
            const viewportHeight = window.innerHeight;
            const menuBottom = rect.bottom + menuHeight;
            
            if (menuBottom > viewportHeight && rect.top > menuHeight) {
                // Показываем меню сверху от кнопки
                categoryMenu.style.top = (rect.top - menuHeight - 4) + 'px';
            }
        });
    };
    
    // Clear option
    const clearOption = document.createElement('div');
    clearOption.className = 'category-menu-item';
    clearOption.textContent = getText('passwords.category.clear');
    clearOption.onclick = () => {
        if (!passwords[index]) passwords[index] = {};
        setPasswordField(passwords[index], 'CATEGORY', '');
        selectBtn.textContent = getText('passwords.category.empty');
        closeCategoryMenu();
        saveToLocalStorage();
    };
    categoryMenu.appendChild(clearOption);
    
    // Separator
    const separator = document.createElement('div');
    separator.className = 'category-menu-separator';
    categoryMenu.appendChild(separator);
    
    // Categories from user list
    passwordCategories.forEach(category => {
        const menuItem = document.createElement('div');
        menuItem.className = 'category-menu-item';
        menuItem.textContent = category;
        menuItem.onclick = () => {
            if (!passwords[index]) passwords[index] = {};
            const oldCategory = getPasswordField(passwords[index], 'CATEGORY');
            const wasDraft = passwords[index]._isDraft;
            setPasswordField(passwords[index], 'CATEGORY', category);
            selectBtn.textContent = category;
            // Remove draft flag when user selects category
            if (passwords[index]._isDraft) {
                delete passwords[index]._isDraft;
                console.log('[USER ACTION] Category selected - draft flag removed:', { index, oldCategory, newCategory: category, wasDraft, timestamp: new Date().toISOString() });
            } else {
                console.log('[USER ACTION] Category selected:', { index, oldCategory, newCategory: category, timestamp: new Date().toISOString() });
            }
            closeCategoryMenu();
            saveToLocalStorage();
        };
        categoryMenu.appendChild(menuItem);
    });
    
    // Добавляем меню в body
    document.body.appendChild(categoryMenu);
    
    // Обработчик клика на кнопку
    selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const isVisible = categoryMenu.style.display === 'block';
        if (!isVisible) {
            openCategoryMenu();
        } else {
            closeCategoryMenu();
        }
    });
    
    // Используем один обработчик для всех меню
    if (!window.categoryMenuClickHandler) {
        window.categoryMenuClickHandler = (e) => {
            const menus = document.querySelectorAll('.category-menu');
            let clickedInside = false;
            menus.forEach(menu => {
                if (menu.contains(e.target) || menu.previousElementSibling?.contains?.(e.target)) {
                    clickedInside = true;
                }
            });
            // Проверяем, не кликнули ли на кнопку "Выбрать"
            if (e.target.classList.contains('select-category-btn')) {
                clickedInside = true;
            }
            if (!clickedInside) {
                menus.forEach(menu => {
                    menu.style.display = 'none';
                });
            }
        };
        document.addEventListener('click', window.categoryMenuClickHandler);
    }
    categoryTd.appendChild(categoryContainer);
    row.appendChild(categoryTd);
    
    // Примечание (кнопка с модальным окном)
    const noteTd = document.createElement('td');
    noteTd.className = 'note-cell';
    
    const noteContainer = document.createElement('div');
    noteContainer.className = 'note-container';
    
    // Кнопка с текстом примечания
    const noteBtn = document.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = 'note-btn';
    const noteText = getPasswordField(passwordData, 'NOTE');
    noteBtn.textContent = truncateNote(noteText);
    noteBtn.title = noteText || getText('passwords.note.add');
    noteBtn.onclick = () => openNoteModal(index, noteBtn);
    noteContainer.appendChild(noteBtn);
    
    noteTd.appendChild(noteContainer);
    row.appendChild(noteTd);
    
    // Действия
    const deleteTd = document.createElement('td');
    deleteTd.style.textAlign = 'center';
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-row-btn';
    deleteBtn.title = getText('passwords.delete');
    deleteBtn.innerHTML = `
        <svg class="trash-icon" viewBox="0 0 408.483 408.483" fill="currentColor">
            <path d="M87.748,388.784c0.461,11.01,9.521,19.699,20.539,19.699h191.911c11.018,0,20.078-8.689,20.539-19.699l13.705-289.316H74.043L87.748,388.784z M247.655,171.329c0-4.61,3.738-8.349,8.35-8.349h13.355c4.609,0,8.35,3.738,8.35,8.349v165.293c0,4.611-3.738,8.349-8.35,8.349h-13.355c-4.61,0-8.35-3.736-8.35-8.349V171.329z M189.216,171.329c0-4.61,3.738-8.349,8.349-8.349h13.355c4.609,0,8.349,3.738,8.349,8.349v165.293c0,4.611-3.737,8.349-8.349,8.349h-13.355c-4.61,0-8.349-3.736-8.349-8.349V171.329L189.216,171.329z M130.775,171.329c0-4.61,3.738-8.349,8.349-8.349h13.356c4.61,0,8.349,3.738,8.349,8.349v165.293c0,4.611-3.738,8.349-8.349,8.349h-13.356c-4.61,0-8.349-3.736-8.349-8.349V171.329z"/>
            <path d="M343.567,21.043h-88.535V4.305c0-2.377-1.927-4.305-4.305-4.305h-92.971c-2.377,0-4.304,1.928-4.304,4.305v16.737H64.916c-7.125,0-12.9,5.776-12.9,12.901V74.47h304.451V33.944C356.467,26.819,350.692,21.043,343.567,21.043z"/>
        </svg>
    `;
    deleteBtn.onclick = () => deletePasswordRow(index);
    deleteTd.appendChild(deleteBtn);
    row.appendChild(deleteTd);
    
    tableBody.appendChild(row);
}

function togglePasswordVisibility(index) {
    passwordsVisible[index] = !passwordsVisible[index];
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        const passwordInput = row.querySelector('.password-input');
        const eyeBtn = row.querySelector('.toggle-password');
        if (passwordInput) {
            passwordInput.type = passwordsVisible[index] ? 'text' : 'password';
        }
        // Текст кнопки не меняется, только иконка
    }
    saveToLocalStorage();
}

function deletePasswordRow(index) {
    const passwordEntry = passwords[index];
    const service = passwordEntry ? getPasswordField(passwordEntry, 'SERVICE') : 'unknown';
    const login = passwordEntry ? getPasswordField(passwordEntry, 'LOGIN') : 'unknown';
    console.log('[USER ACTION] deletePasswordRow:', { index, service, login, timestamp: new Date().toISOString() });
    
    if (confirm(getText('passwords.delete.confirm'))) {
        // Check if deleting a draft entry
        const isDraft = passwords[index] && passwords[index]._isDraft;
        console.log('[USER ACTION] Password deletion confirmed:', { index, isDraft, service, login });
        
        passwords.splice(index, 1);
        delete passwordsVisible[index];
        // Перенумеровываем индексы
        const newPasswordsVisible = {};
        passwords.forEach((_, newIndex) => {
            if (passwordsVisible[newIndex + 1] !== undefined) {
                newPasswordsVisible[newIndex] = passwordsVisible[newIndex + 1];
            }
        });
        passwordsVisible = newPasswordsVisible;
        updateTable();
        saveToLocalStorage();
        
        // Sync only if deleting a non-draft entry (draft entries don't need sync)
        if (!isDraft && typeof markDataChanged === 'function') {
            console.log('[USER ACTION] Triggering immediate sync after password deletion (non-draft)');
            markDataChanged(true); // Immediate sync for deletion of real entries
        } else if (isDraft) {
            console.log('[USER ACTION] Skipping sync for draft entry deletion');
        }
    } else {
        console.log('[USER ACTION] Password deletion cancelled by user');
    }
}

async function addNewPasswordRow() {
    // Очищаем фильтры, чтобы новая запись была видна
    selectedCategories = [];
    currentSearchFilter = '';
    
    // Очищаем UI фильтров
    const searchFilter = document.getElementById('searchFilter');
    if (searchFilter) {
        searchFilter.value = '';
    }
    updateCategoryFilterButtons();
    
    // Generate Hash ID for new entry
    const hashId = await generatePasswordHashId();
    
    // Add new entry with Hash ID (draft/empty entry - won't trigger sync)
    const newPassword = {
        [FIELD_NAMES.SERVICE]: '',
        [FIELD_NAMES.LOGIN]: '',
        [FIELD_NAMES.PASSWORD]: '',
        [FIELD_NAMES.CATEGORY]: '',
        [FIELD_NAMES.NOTE]: '',
        [HASH_ID_FIELD]: hashId,
        _isDraft: true // Mark as draft - won't sync until user enters data
    };
    passwords.push(newPassword);
    
    // Обновляем таблицу
    updateTable();
    
    // Save locally but don't trigger sync (draft entry)
    // Sync will be triggered when user enters data via input event handlers
    await saveToLocalStorage(false, 0); // Save without version increment, no debounce
    
    // Прокручиваем к новой записи
    setTimeout(() => {
        const tableBody = document.getElementById('tableBody');
        if (tableBody && tableBody.lastElementChild) {
            tableBody.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

