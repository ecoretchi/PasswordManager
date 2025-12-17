// importExport.js
// Automatically generated from script.js

function handleExport() {
    const formatSelect = document.getElementById('exportFormat');
    const format = formatSelect ? formatSelect.value : 'csv';
    
    if (format === 'csv') {
        exportToCSV();
    } else if (format === 'json') {
        exportEncryptedData();
    }
}

async function handleImport(event) {
    const file = event.target.files[0];
    if (!file) {
        event.target.value = '';
        return;
    }
    
    const fileName = file.name.toLowerCase();
    
    try {
        if (fileName.endsWith('.csv')) {
            // Импорт CSV
            await importFromCSV(event);
        } else if (fileName.endsWith('.json')) {
            // Импорт JSON (зашифрованные данные)
            await importEncryptedData(event);
        } else {
            alert('Неподдерживаемый формат файла. Используйте .csv или .json');
            event.target.value = '';
        }
    } catch (error) {
        console.error('Ошибка при импорте:', error);
        event.target.value = '';
    }
}

async function exportEncryptedData() {
    if (!currentUserLogin) {
        alert(getText('import.error.loginFirst'));
        return;
    }
    
    try {
        const keys = getUserStorageKeys(currentUserLogin);
        const encryptedData = localStorage.getItem(keys.encryptedData);
        const encryptionSalt = localStorage.getItem(keys.encryptionSalt);
        const deleteWithoutConfirm = localStorage.getItem(keys.deleteWithoutConfirm);
        
        if (!encryptedData || !encryptionSalt) {
            alert(getText('import.error.noData'));
            return;
        }
        
        // Создаем объект с данными для экспорта
        const exportData = {
            login: currentUserLogin, // Сохраняем логин для удобства
            encryptedData: encryptedData,
            encryptionSalt: encryptionSalt,
            deleteWithoutConfirm: deleteWithoutConfirm || false,
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        // Создаем JSON файл
        const jsonContent = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `password_manager_backup_${currentUserLogin}_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(getText('import.success.export'));
    } catch (error) {
        console.error('Ошибка при экспорте данных:', error);
        alert(getText('import.error.export') + ' ' + error.message);
    }
}

async function importEncryptedData(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            
            // Проверяем формат файла
            if (!importData.encryptedData || !importData.encryptionSalt) {
                alert(getText('import.error.invalidFormat'));
                event.target.value = '';
                return;
            }
            
            // Запрашиваем логин и пароль для импорта
            const login = prompt(getText('import.prompt.login'));
            if (!login || login.trim() === '') {
                alert(getText('import.error.emptyLogin'));
                event.target.value = '';
                return;
            }
            
            const masterKey = prompt(getText('import.prompt.masterKey'));
            if (!masterKey || masterKey.trim() === '') {
                alert(getText('import.error.emptyKey'));
                event.target.value = '';
                return;
            }
            
            // Проверяем, не существует ли уже пользователь с таким логином
            if (userExists(login.trim())) {
                if (!confirm(getText('import.confirm.userExists', { login: login.trim() }))) {
                    event.target.value = '';
                    return;
                }
            }
            
            // Инициализируем шифрование с логином и паролем из файла
            try {
                // Сохраняем импортированные данные во временное хранилище
                const tempKeys = getUserStorageKeys(login.trim());
                localStorage.setItem(tempKeys.encryptedData, importData.encryptedData);
                localStorage.setItem(tempKeys.encryptionSalt, importData.encryptionSalt);
                if (importData.deleteWithoutConfirm !== undefined) {
                    localStorage.setItem(tempKeys.deleteWithoutConfirm, importData.deleteWithoutConfirm);
                }
                
                // Инициализируем шифрование
                await initializeEncryption(login.trim(), masterKey, true);
                
                // Пробуем загрузить данные для проверки пароля
                await loadFromLocalStorage(login.trim());
                
                // Успешно - показываем приложение
                const modal = document.getElementById('masterPasswordModal');
                const mainContainer = document.getElementById('mainContainer');
                if (modal) modal.style.display = 'none';
                if (mainContainer) mainContainer.style.display = 'block';
                
                // Отображаем логин в шапке
                updateUserLoginDisplay(login.trim());
                
                // Инициализируем приложение
                initializeCategories();
                initializeFilters();
                updateTable();
                setupEventListeners();
                
                alert(getText('import.success.import'));
            } catch (importError) {
                // Удаляем временные данные при ошибке
                const tempKeys = getUserStorageKeys(login.trim());
                localStorage.removeItem(tempKeys.encryptedData);
                localStorage.removeItem(tempKeys.encryptionSalt);
                localStorage.removeItem(tempKeys.deleteWithoutConfirm);
                
                throw new Error(getText('import.error.decryptFailed'));
            }
        } catch (error) {
            console.error('Ошибка при импорте данных:', error);
            alert(getText('import.error.import') + ' ' + error.message);
        } finally {
            // Очищаем input
            event.target.value = '';
        }
    };
    
    reader.onerror = function() {
        alert(getText('import.error.read'));
        event.target.value = '';
    };
    
    reader.readAsText(file, 'UTF-8');
}

// Экранирование полей CSV (обработка запятых, кавычек, переносов строк)
function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    const stringField = String(field);
    
    // Если поле содержит запятую, кавычку или перенос строки, оборачиваем в кавычки
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
        // Экранируем кавычки (удваиваем их)
        return '"' + stringField.replace(/"/g, '""') + '"';
    }
    
    return stringField;
}

function exportToCSV() {
    if (passwords.length === 0) {
        alert('No data to export');
        return;
    }
    
    // CSV headers
    const headers = ['Service / Site', 'Login', 'Password', 'Category', 'Note'];
    
    // Создаем CSV строку
    let csvContent = headers.join(',') + '\n';
    
    // Добавляем данные
    passwords.forEach(password => {
        const row = [
            escapeCSVField(getPasswordField(password, 'SERVICE')),
            escapeCSVField(getPasswordField(password, 'LOGIN')),
            escapeCSVField(getPasswordField(password, 'PASSWORD')),
            escapeCSVField(getPasswordField(password, 'CATEGORY')),
            escapeCSVField(getPasswordField(password, 'NOTE'))
        ];
        csvContent += row.join(',') + '\n';
    });
    
    // Создаем BOM для правильного отображения кириллицы в Excel
    const BOM = '\uFEFF';
    csvContent = BOM + csvContent;
    
    // Создаем blob и скачиваем файл
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `passwords_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function importFromCSV(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            
            if (lines.length < 2) {
                alert(getText('import.error.csv.empty'));
                return;
            }
            
            // Парсим заголовки
            const headers = parseCSVLine(lines[0]);
            const expectedHeaders = ['Service / Site', 'Login', 'Password', 'Category', 'Note'];
            
            // Проверяем заголовки (не строго, на случай разных порядков)
            const hasAllHeaders = expectedHeaders.every(header => 
                headers.some(h => h.trim() === header)
            );
            
            if (!hasAllHeaders) {
                if (!confirm(getText('import.error.csv.format'))) {
                    event.target.value = '';
                    return;
                }
            }
            
            // Парсим данные
            const importedPasswords = [];
            const categorySet = new Set(passwordCategories.map(cat => cat.toLowerCase()));
            const maxCategories = 15;
            let addedCategoriesCount = 0;
            
            for (let i = 1; i < lines.length; i++) {
                const values = parseCSVLine(lines[i]);
                if (values.length === 0) continue;
                
                const password = {};
                setPasswordField(password, 'SERVICE', values[0] || '');
                setPasswordField(password, 'LOGIN', values[1] || '');
                setPasswordField(password, 'PASSWORD', values[2] || '');
                setPasswordField(password, 'CATEGORY', values[3] || '');
                setPasswordField(password, 'NOTE', values[4] || '');
                
                // Generate Hash ID for imported password
                const randomBytes = new Uint8Array(32);
                crypto.getRandomValues(randomBytes);
                const binaryString = String.fromCharCode(...randomBytes);
                password._hashId = btoa(binaryString);
                
                importedPasswords.push(password);
                
                // Add category if it doesn't exist (case-insensitive) and limit not exceeded
                const category = getPasswordField(password, 'CATEGORY');
                if (category) {
                    const categoryLower = category.toLowerCase();
                    if (!categorySet.has(categoryLower)) {
                        // Check category limit (15)
                        if (passwordCategories.length < maxCategories) {
                            passwordCategories.push(category);
                            categorySet.add(categoryLower);
                            addedCategoriesCount++;
                        }
                        // If limit exceeded, just ignore category addition
                    } else {
                        // If category already exists (case-insensitive), use existing version
                        const existingCategory = findCategoryCaseInsensitive(category);
                        if (existingCategory) {
                            setPasswordField(password, 'CATEGORY', existingCategory);
                        }
                    }
                }
            }
            
            if (importedPasswords.length === 0) {
                alert(getText('import.error.csv.failed'));
                return;
            }
            
            // Спрашиваем, как импортировать
            const importMode = confirm(
                getText('import.csv.found', { count: importedPasswords.length }) + '\n\n' +
                getText('import.csv.mode.add') + '\n' +
                getText('import.csv.mode.replace')
            );
            
            if (importMode) {
                // Добавляем к существующим
                passwords = passwords.concat(importedPasswords);
            } else {
                // Заменяем все данные
                passwords = importedPasswords;
            }
            
            // Обновляем UI
            updateCategoriesUI();
            updateTable();
            saveToLocalStorage();
            
            // Form success message
            let message = getText('import.csv.success', { count: importedPasswords.length });
            if (addedCategoriesCount > 0) {
                message += '\n' + getText('import.csv.categories.added', { count: addedCategoriesCount });
            }
            if (passwordCategories.length >= maxCategories && addedCategoriesCount === 0) {
                message += '\n\n' + getText('import.csv.categories.limit', { limit: maxCategories });
            }
            alert(message);
            
        } catch (error) {
            console.error('Ошибка при импорте CSV:', error);
            alert(getText('import.error.import') + ' ' + error.message);
        } finally {
            // Очищаем input, чтобы можно было загрузить тот же файл снова
            event.target.value = '';
        }
    };
    
    reader.onerror = function() {
        alert(getText('import.error.read'));
        event.target.value = '';
    };
    
    reader.readAsText(file, 'UTF-8');
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Двойная кавычка - экранированная кавычка
                current += '"';
                i++; // Пропускаем следующую кавычку
            } else {
                // Переключаем режим кавычек
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Запятая вне кавычек - разделитель полей
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    // Добавляем последнее поле
    result.push(current);
    
    return result;
}

