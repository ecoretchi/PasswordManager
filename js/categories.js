// categories.js
// Автоматически сгенерировано из script.js

function initializeCategories() {
    const categoriesList = document.getElementById('categoriesList');
    passwordCategories.forEach(category => {
        addCategoryToUI(category);
    });
}

function addCategoryToUI(category) {
    const categoriesList = document.getElementById('categoriesList');
    const categoryItem = document.createElement('div');
    categoryItem.className = 'category-item';
    categoryItem.dataset.category = category;
    
    categoryItem.innerHTML = `
        <span class="category-name">${category}</span>
        <button class="delete-btn" onclick="deleteCategory('${category}')" title="${getText('categories.delete')}">
            <svg class="trash-icon" viewBox="0 0 408.483 408.483" fill="currentColor">
                <path d="M87.748,388.784c0.461,11.01,9.521,19.699,20.539,19.699h191.911c11.018,0,20.078-8.689,20.539-19.699l13.705-289.316H74.043L87.748,388.784z M247.655,171.329c0-4.61,3.738-8.349,8.35-8.349h13.355c4.609,0,8.35,3.738,8.35,8.349v165.293c0,4.611-3.738,8.349-8.35,8.349h-13.355c-4.61,0-8.35-3.736-8.35-8.349V171.329z M189.216,171.329c0-4.61,3.738-8.349,8.349-8.349h13.355c4.609,0,8.349,3.738,8.349,8.349v165.293c0,4.611-3.737,8.349-8.349,8.349h-13.355c-4.61,0-8.349-3.736-8.349-8.349V171.329L189.216,171.329z M130.775,171.329c0-4.61,3.738-8.349,8.349-8.349h13.356c4.61,0,8.349,3.738,8.349,8.349v165.293c0,4.611-3.738,8.349-8.349,8.349h-13.356c-4.61,0-8.349-3.736-8.349-8.349V171.329z"/>
                <path d="M343.567,21.043h-88.535V4.305c0-2.377-1.927-4.305-4.305-4.305h-92.971c-2.377,0-4.304,1.928-4.304,4.305v16.737H64.916c-7.125,0-12.9,5.776-12.9,12.901V74.47h304.451V33.944C356.467,26.819,350.692,21.043,343.567,21.043z"/>
            </svg>
        </button>
    `;
    
    categoriesList.appendChild(categoryItem);
}

function findCategoryCaseInsensitive(categoryName) {
    const lowerName = categoryName.toLowerCase();
    return passwordCategories.find(cat => cat.toLowerCase() === lowerName);
}

function hasCategoryCaseInsensitive(categoryName) {
    return findCategoryCaseInsensitive(categoryName) !== undefined;
}

function getAllCategories() {
    const categoriesSet = new Set(passwordCategories);
    
    // Добавляем все категории, которые используются в паролях
    passwords.forEach(password => {
        const category = getPasswordField(password, 'CATEGORY');
        if (category && category.trim() !== '') {
            categoriesSet.add(category);
        }
    });
    
    // Сортируем: сначала категории из списка, потом остальные
    const listCategories = Array.from(categoriesSet).filter(cat => 
        passwordCategories.some(listCat => listCat.toLowerCase() === cat.toLowerCase())
    );
    const otherCategories = Array.from(categoriesSet).filter(cat => 
        !passwordCategories.some(listCat => listCat.toLowerCase() === cat.toLowerCase())
    );
    
    return [...listCategories, ...otherCategories.sort()];
}

function deleteCategory(categoryName) {
    console.log('[USER ACTION] deleteCategory:', { categoryName, timestamp: new Date().toISOString() });
    const deleteWithoutConfirm = document.getElementById('deleteWithoutConfirm');
    const shouldDelete = deleteWithoutConfirm && deleteWithoutConfirm.checked 
        ? true 
        : confirm(getText('categories.deleteConfirm', { name: categoryName }));
    
    if (shouldDelete) {
        // Удаляем только из списка категорий, но не из данных паролей
        const categoryToDelete = findCategoryCaseInsensitive(categoryName);
        if (categoryToDelete) {
            console.log('[USER ACTION] Category deleted, updating UI and saving...', { categoryName: categoryToDelete });
            passwordCategories = passwordCategories.filter(cat => cat !== categoryToDelete);
            updateCategoriesUI();
            updateTable(); // Обновляем таблицу, чтобы выпадающие списки обновились
            saveToLocalStorage();
            // Немедленная синхронизация при удалении категории
            if (typeof markDataChanged === 'function') {
                console.log('[USER ACTION] Triggering immediate sync after category deletion');
                markDataChanged(true);
            }
        }
    } else {
        console.log('[USER ACTION] Category deletion cancelled by user');
    }
}

function updateCategoriesUI() {
    const categoriesList = document.getElementById('categoriesList');
    if (!categoriesList) {
        return; // Categories list not available yet
    }
    
    // Clear existing UI
    categoriesList.innerHTML = '';
    
    // Use Set to track already added categories (case-insensitive)
    const seenCategories = new Set();
    
    // Add categories to UI, skipping duplicates
    passwordCategories.forEach(category => {
        const key = category.toLowerCase();
        if (!seenCategories.has(key)) {
            seenCategories.add(key);
            addCategoryToUI(category);
        }
    });
    
    updateCategoryFilter();
}

function addCategory() {
    const input = document.getElementById('newCategoryInput');
    const categoryName = input.value.trim();
    
    if (!categoryName) {
        alert(getText('categories.error.empty'));
        return;
    }
    
    if (hasCategoryCaseInsensitive(categoryName)) {
        alert(getText('categories.error.exists'));
        return;
    }
    
    passwordCategories.push(categoryName);
    addCategoryToUI(categoryName);
    updateCategoryFilter(); // Обновляем фильтр категорий, чтобы новая категория появилась в кнопках
    input.value = '';
    updateTable(); // Обновляем таблицу, чтобы добавить новую категорию в select
    saveToLocalStorage();
    // Немедленная синхронизация при добавлении категории
    if (typeof markDataChanged === 'function') {
        markDataChanged(true);
    }
}

