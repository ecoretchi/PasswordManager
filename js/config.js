// Конфигурация приложения

// Фиксированные колонки таблицы
const fixedColumns = ['Сервис / сайт', 'Логин', 'Пароль', 'Примечание'];

// Имя файла в Google Drive
const GOOGLE_DRIVE_FILENAME = 'password_manager_data.json';

// Google Drive API настройки (нужно будет создать OAuth клиент в Google Cloud Console)
// ВАЖНО: Замените на ваши реальные значения из Google Cloud Console
// 
// ВАРИАНТ 1: Web application (если localhost не работает, используйте вариант 2)
// 1. Перейдите в https://console.cloud.google.com/
// 2. Создайте проект или выберите существующий
// 3. Включите Google Drive API
// 4. Создайте OAuth 2.0 Client ID (тип: Web application)
// 5. Добавьте авторизованные источники JavaScript: http://127.0.0.1:8000 (или ваш домен)
// 6. Добавьте авторизованные URI перенаправления: http://127.0.0.1:8000 (или ваш домен)
// 7. Создайте API Key
// 8. Скопируйте Client ID и API Key сюда
//
// ВАРИАНТ 2: Desktop application (рекомендуется для локальной разработки)
// 1. Перейдите в https://console.cloud.google.com/
// 2. Создайте проект или выберите существующий
// 3. Включите Google Drive API
// 4. Создайте OAuth 2.0 Client ID (тип: Desktop application)
// 5. НЕ нужно добавлять redirect URIs для Desktop приложений
// 6. Создайте API Key
// 7. Скопируйте Client ID и API Key сюда
const GOOGLE_CLIENT_ID = '228596405968-jlqiemcnlgpe87f4ffkiujb32181n4rg.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyBEOjTVF2BYknV3U3qea07axZGCN3Dad8k';
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'];
// Scopes для доступа к Google Drive и информации о пользователе
// drive.file - доступ к файлам, созданным приложением
// drive.appdata - доступ к appDataFolder (скрытая папка приложения)
// userinfo.email - доступ к email пользователя
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata https://www.googleapis.com/auth/userinfo.email';

// Проверка, что ключи настроены
function checkGoogleConfig() {
    if (GOOGLE_CLIENT_ID === 'YOUR_CLIENT_ID.apps.googleusercontent.com' || 
        GOOGLE_API_KEY === 'YOUR_API_KEY') {
        return false;
    }
    return true;
}





