// ui.js
// Автоматически сгенерировано из script.js

function initializeFilters() {
    updateCategoryFilter();
}

function updateCategoryFilter() {
    const categoryFilterButtons = document.getElementById('categoryFilterButtons');
    if (!categoryFilterButtons) return;
    
    // Очищаем контейнер
    categoryFilterButtons.innerHTML = '';
    
    // Добавляем кнопки для каждой категории
    passwordCategories.forEach(category => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'category-filter-btn';
        button.textContent = category;
        button.dataset.category = category;
        
        // Проверяем, выбрана ли категория
        if (selectedCategories.includes(category)) {
            button.classList.add('active');
        }
        
        // Обработчик клика
        button.addEventListener('click', () => {
            toggleCategoryFilter(category);
        });
        
        categoryFilterButtons.appendChild(button);
    });
}

function toggleCategoryFilter(category) {
    const index = selectedCategories.indexOf(category);
    if (index > -1) {
        // Убираем из выбранных
        selectedCategories.splice(index, 1);
    } else {
        // Добавляем в выбранные
        selectedCategories.push(category);
    }
    
    // Обновляем UI кнопок
    updateCategoryFilterButtons();
    
    // Обновляем таблицу
    updateTable();
}

function updateCategoryFilterButtons() {
    const buttons = document.querySelectorAll('.category-filter-btn');
    buttons.forEach(button => {
        const category = button.dataset.category;
        if (selectedCategories.includes(category)) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
}

function truncateNote(text) {
    if (!text || text.trim() === '') {
        return '-';
    }
    const trimmed = text.trim();
    if (trimmed.length <= 15) {
        return trimmed;
    }
    // Обрезаем до 15 символов и добавляем "..."
    return trimmed.substring(0, 15) + '...';
}

function openNoteModal(index, noteBtn) {
    // Создаем модальное окно, если его еще нет
    let modal = document.getElementById('noteModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'noteModal';
        modal.className = 'note-modal';
        
        const modalContent = document.createElement('div');
        modalContent.className = 'note-modal-content';
        
        const modalHeader = document.createElement('div');
        modalHeader.className = 'note-modal-header';
        modalHeader.innerHTML = `<h3>${getText('passwords.note.edit')}</h3><button class="note-modal-close">&times;</button>`;
        modalContent.appendChild(modalHeader);
        
        const modalBody = document.createElement('div');
        modalBody.className = 'note-modal-body';
        
        const textarea = document.createElement('textarea');
        textarea.id = 'noteModalTextarea';
        textarea.className = 'note-modal-textarea';
        textarea.placeholder = getText('passwords.note.placeholder');
        modalBody.appendChild(textarea);
        
        modalContent.appendChild(modalBody);
        
        const modalFooter = document.createElement('div');
        modalFooter.className = 'note-modal-footer';
        
        const saveBtn = document.createElement('button');
        saveBtn.className = 'note-modal-save';
        saveBtn.textContent = getText('passwords.note.save');
        // Обработчик сохраняется при создании, но будет использовать актуальный индекс
        let currentRowIndex = index;
        saveBtn.onclick = () => {
            saveNote(currentRowIndex);
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'note-modal-cancel';
        cancelBtn.textContent = getText('passwords.note.cancel');
        cancelBtn.onclick = closeNoteModal;
        
        modalFooter.appendChild(saveBtn);
        modalFooter.appendChild(cancelBtn);
        modalContent.appendChild(modalFooter);
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Закрытие при клике на крестик
        modalHeader.querySelector('.note-modal-close').onclick = closeNoteModal;
        
        // Закрытие при клике вне модального окна
        modal.onclick = (e) => {
            if (e.target === modal) {
                closeNoteModal();
            }
        };
    }
    
    // Заполняем текстовое поле текущим значением
    const textarea = document.getElementById('noteModalTextarea');
    const currentNote = getPasswordField(passwords[index], 'NOTE');
    textarea.value = currentNote;
    textarea.dataset.rowIndex = index;
    
    // Обновляем обработчик сохранения с актуальным индексом
    const saveBtn = modal.querySelector('.note-modal-save');
    if (saveBtn) {
        saveBtn.onclick = () => saveNote(index);
    }
    
    // Показываем модальное окно
    modal.style.display = 'flex';
    textarea.focus();
}

function saveNote(index) {
    const textarea = document.getElementById('noteModalTextarea');
    const noteText = textarea.value;
    
    if (!passwords[index]) passwords[index] = {};
    const oldNote = getPasswordField(passwords[index], 'NOTE');
    const wasDraft = passwords[index]._isDraft;
    setPasswordField(passwords[index], 'NOTE', noteText);
    
    // Remove draft flag when user saves note
    if (passwords[index]._isDraft) {
        delete passwords[index]._isDraft;
        console.log('[USER ACTION] Note saved - draft flag removed:', { index, wasDraft, noteLength: noteText.length, timestamp: new Date().toISOString() });
    } else {
        console.log('[USER ACTION] Note saved:', { index, oldNoteLength: oldNote ? oldNote.length : 0, newNoteLength: noteText.length, timestamp: new Date().toISOString() });
    }
    
    // Обновляем текст на кнопке (находим кнопку по индексу строки)
    const row = document.querySelector(`tr[data-index="${index}"]`);
    if (row) {
        const btn = row.querySelector('.note-btn');
        if (btn) {
            btn.textContent = truncateNote(noteText);
            btn.title = noteText || getText('passwords.note.add');
        }
    }
    
    saveToLocalStorage();
    closeNoteModal();
}

function closeNoteModal() {
    const modal = document.getElementById('noteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

