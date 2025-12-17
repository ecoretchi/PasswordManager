// auth.js
// Автоматически сгенерировано из script.js

async function showMasterPasswordModal() {
    const modal = document.getElementById('masterPasswordModal');
    const loginInput = document.getElementById('userLoginInput');
    const masterKeyInput = document.getElementById('masterPasswordInput'); // Поле ввода мастер-ключа
    const confirmMasterKeyInput = document.getElementById('confirmPasswordInput');
    const submitBtn = document.getElementById('masterPasswordSubmit');
    const createBtn = document.getElementById('masterPasswordCreate');
    const cancelBtn = document.getElementById('masterPasswordCancel');
    const errorDiv = document.getElementById('masterPasswordError');
    const createUserMessage = document.getElementById('createUserMessage');
    const mainContainer = document.getElementById('mainContainer');
    const resetBtn = document.getElementById('masterPasswordReset');
    
    // Check if we should show modal (if user has Google tokens, don't show)
    if (typeof hasSavedGoogleTokens === 'function' && hasSavedGoogleTokens()) {
        // User has Google tokens, don't show modal
        if (modal) {
            modal.style.display = 'none';
        }
        return;
    }
    
    // Скрываем все дополнительные элементы по умолчанию
    resetBtn.style.display = 'none';
    createBtn.style.display = 'none';
    cancelBtn.style.display = 'none';
    confirmMasterKeyInput.style.display = 'none';
    createUserMessage.style.display = 'none';
    submitBtn.style.display = 'inline-block';
    submitBtn.textContent = 'Войти';
    
    // Show login input if it was hidden
    if (loginInput) {
        loginInput.style.display = 'block';
    }
    
    modal.style.display = 'flex';
    if (loginInput) {
        loginInput.focus();
    }
    
    // Обработчик входа
    const handleSubmit = async () => {
        const login = loginInput.value.trim();
        const masterKey = masterKeyInput.value.trim();
        
        if (!login) {
            showError('Введите логин');
            loginInput.focus();
            return;
        }
        
        if (!masterKey) {
            showError('Введите мастер-ключ');
            masterKeyInput.focus();
            return;
        }
        
        if (masterKey.length < 6) {
            showError('Мастер-ключ должен содержать минимум 6 символов');
            masterKeyInput.focus();
            return;
        }
        
        // Проверяем существование пользователя (according to architecture section 6)
        const userExistsCheck = userDataExists(login);
        
        // Если пользователь не существует, предлагаем создать
        if (!userExistsCheck) {
            createUserMessage.style.display = 'block';
            confirmMasterKeyInput.style.display = 'block';
            createBtn.style.display = 'inline-block';
            cancelBtn.style.display = 'inline-block';
            submitBtn.style.display = 'none';
            confirmMasterKeyInput.focus();
            return;
        }
        
        try {
            // Check if salt exists (according to architecture section 6, step 3)
            const dataKey = getUserDataKey(login);
            const hasLocalSalt = localStorage.getItem(dataKey + '_salt') !== null;
            
            if (!hasLocalSalt) {
                throw new Error('Salt not found. Data may be corrupted.');
            }
            
            // Initialize encryption with existing salt (according to architecture section 6, step 3)
            await initializeEncryption(login, masterKey, true); // useExistingSalt = true
            
            // Load data (according to architecture section 6, step 4)
            try {
                await loadFromLocalStorage(login);
            } catch (loadError) {
                // Если ошибка загрузки - значит неправильный мастер-ключ
                encryptionKey = null;
                masterKey = null;
                currentUserLogin = null;
                throw new Error('Login or master key is incorrect');
            }
            
            // Успешно - скрываем модальное окно и показываем основное приложение
            modal.style.display = 'none';
            mainContainer.style.display = 'block';
            
            // Set active user (new architecture)
            setActiveUserId(login);
            
            // Save data with new architecture (Local login type)
            isGoogleSignIn = false;
            await saveToLocalStorage();
            
            // Отображаем логин в шапке
            updateUserLoginDisplay(login);
            
            // Убеждаемся, что статус установлен как local (не Google вход)
            if (typeof updateSyncStatus === 'function') {
                updateSyncStatus();
            }
            
            // Инициализируем приложение
            initializeCategories();
            initializeFilters();
            updateTable();
            setupEventListeners();
        } catch (error) {
            // Сбрасываем ключ шифрования при ошибке
            encryptionKey = null;
            masterKey = null;
            currentUserLogin = null;
            
            // Проверяем, является ли ошибка ошибкой расшифровки
            if (error.message && (error.message.includes('неверный') || error.message.includes('расшифровки'))) {
                showError('Логин или мастер-ключ неверный');
                masterKeyInput.value = ''; // Очищаем поле мастер-ключа
                masterKeyInput.focus();
                // НЕ загружаем приложение - модальное окно остается открытым
            } else {
                showError(error.message || 'Ошибка при инициализации. Проверьте логин и мастер-ключ.');
                masterKeyInput.value = '';
                masterKeyInput.focus();
            }
        }
    };
    
    // Функция для сброса UI к режиму входа
    const resetToLoginMode = () => {
        createBtn.style.display = 'none';
        cancelBtn.style.display = 'none';
        confirmMasterKeyInput.style.display = 'none';
        createUserMessage.style.display = 'none';
        submitBtn.style.display = 'inline-block';
        submitBtn.textContent = 'Войти';
        confirmMasterKeyInput.value = '';
        hideError();
    };
    
    // Обработчик создания нового пользователя
    const handleCreate = async () => {
        const login = loginInput.value.trim();
        const masterKey = masterKeyInput.value.trim();
        const confirmMasterKey = confirmMasterKeyInput.value.trim();
        
        if (!login) {
            showError('Введите логин');
            loginInput.focus();
            return;
        }
        
        if (login.length < 3) {
            showError('Логин должен содержать минимум 3 символа');
            loginInput.focus();
            return;
        }
        
        if (!masterKey) {
            showError('Введите мастер-ключ');
            masterKeyInput.focus();
            return;
        }
        
        if (masterKey.length < 6) {
            showError('Мастер-ключ должен содержать минимум 6 символов');
            masterKeyInput.focus();
            return;
        }
        
        if (!confirmMasterKey) {
            showError('Подтвердите мастер-ключ');
            confirmMasterKeyInput.focus();
            return;
        }
        
        if (masterKey !== confirmMasterKey) {
            showError('Мастер-ключи не совпадают');
            confirmMasterKeyInput.value = '';
            confirmMasterKeyInput.focus();
            return;
        }
        
        // Проверяем, не существует ли уже такой пользователь (на случай, если создали между проверками)
        if (userExists(login)) {
            showError('Пользователь с таким логином уже существует. Используйте кнопку "Войти"');
            resetToLoginMode();
            masterKeyInput.value = '';
            return;
        }
        
        try {
            await initializeEncryption(login, masterKey, false); // false = создаем новую соль
            modal.style.display = 'none';
            mainContainer.style.display = 'block';
            
            // Set active user (new architecture)
            setActiveUserId(login);
            
            // Save data with new architecture (Local login type)
            isGoogleSignIn = false;
            await saveToLocalStorage();
            
            // Отображаем логин в шапке
            updateUserLoginDisplay(login);
            
            // Убеждаемся, что статус установлен как local (не Google вход)
            if (typeof updateSyncStatus === 'function') {
                updateSyncStatus();
            }
            
            // Инициализируем приложение с пустыми данными
            initializeCategories();
            initializeFilters();
            updateTable();
            setupEventListeners();
        } catch (error) {
            showError(error.message || 'Ошибка при создании аккаунта');
        }
    };
    
    // Обработчик отмены создания пользователя
    const handleCancel = () => {
        resetToLoginMode();
        masterKeyInput.value = '';
        masterKeyInput.focus();
    };
    
    // Обработчик сброса данных пользователя
    const handleReset = () => {
        if (!currentUserLogin) {
            showError('Сначала войдите в систему');
            return;
        }
        
        const confirmMessage = 'ВНИМАНИЕ: Все данные будут безвозвратно удалены!\n\n' +
                              'Это действие удалит для текущего пользователя:\n' +
                              '- Все сохраненные пароли\n' +
                              '- Все категории\n' +
                              '- Мастер-ключ\n\n' +
                              'Вы уверены, что хотите продолжить?';
        
        if (confirm(confirmMessage)) {
            // Двойное подтверждение
            if (confirm('Последнее предупреждение: Все данные будут потеряны навсегда. Продолжить?')) {
                const keys = getUserStorageKeys(currentUserLogin);
                
                // Удаляем все зашифрованные данные для этого пользователя
                localStorage.removeItem(keys.encryptedData);
                localStorage.removeItem(keys.encryptionSalt);
                localStorage.removeItem(keys.deleteWithoutConfirm);
                
                // Очищаем переменные
                passwords = [];
                passwordCategories = ['Игры', 'Почта', 'Разное'];
                passwordsVisible = {};
                encryptionKey = null;
                masterKey = null;
                currentUserLogin = null;
                
                // Закрываем приложение и показываем модальное окно
                mainContainer.style.display = 'none';
                modal.style.display = 'flex';
                
                // Обновляем UI модального окна
                resetToLoginMode();
                resetBtn.style.display = 'none';
                loginInput.value = '';
                masterKeyInput.value = '';
                
                alert('Все данные удалены. Теперь вы можете создать новый аккаунт.');
            }
        }
    };
    
    submitBtn.onclick = handleSubmit;
    createBtn.onclick = handleCreate;
    cancelBtn.onclick = handleCancel;
    resetBtn.onclick = handleReset;
    
    // Обработка Enter в полях ввода
    loginInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            masterKeyInput.focus();
        }
    };
    
    masterKeyInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };
    
    confirmMasterKeyInput.onkeypress = (e) => {
        if (e.key === 'Enter') {
            handleCreate();
        }
    };
    
    function showError(message) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    function hideError() {
        errorDiv.style.display = 'none';
    }
    
    // Очистка полей при открытии модального окна
    loginInput.value = '';
    masterKeyInput.value = '';
    confirmMasterKeyInput.value = '';
    hideError();
}

function updateUserLoginDisplay(login) {
    const userLoginElement = document.getElementById('currentUserLogin');
    if (userLoginElement) {
        userLoginElement.textContent = login;
    }
    
    // Обновляем статус синхронизации (async, but we don't need to wait)
    if (typeof updateSyncStatus === 'function') {
        updateSyncStatus();
    }
}

