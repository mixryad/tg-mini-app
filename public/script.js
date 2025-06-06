document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем Telegram Web App
    const tg = window.Telegram.WebApp;
    tg.expand(); // Расширяем приложение на весь экран

    // Получаем элементы DOM
    const selectFileButton = document.getElementById('select-file-button');
    const fileInput = document.getElementById('file-input');
    const uploadArea = document.getElementById('upload-area');
    const statusArea = document.getElementById('status-area');
    const statusText = document.getElementById('status-text');
    const successArea = document.getElementById('success-area');
    const successText = document.getElementById('success-text');
    const uploadAnotherButton = document.getElementById('upload-another-button');

    // Нажатие на кастомную кнопку триггерит скрытый инпут
    selectFileButton.addEventListener('click', () => {
        fileInput.click();
    });

    // Когда пользователь выбрал файл
    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            uploadFile(file);
        }
    });

    // Функция загрузки файла
    async function uploadFile(file) {
        // Показываем экран загрузки
        showScreen('status');
        statusText.textContent = `Загрузка файла: ${file.name}`;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                // Если сервер вернул ошибку
                const errorText = await response.text();
                throw new Error(errorText || 'Ошибка при загрузке.');
            }

            const result = await response.json();

            // Показываем экран успеха
            showScreen('success');
            successText.textContent = `Файл "${result.file.name}" успешно загружен.`;
            
            // Вибрация и уведомление в Telegram
            tg.HapticFeedback.notificationOccurred('success');

        } catch (error) {
            console.error(error);
            showScreen('upload'); // Возвращаем на главный экран
            
            // Показываем всплывающее окно с ошибкой в Telegram
            tg.showAlert(`Ошибка: ${error.message}`);
            tg.HapticFeedback.notificationOccurred('error');
        } finally {
            // Очищаем инпут, чтобы можно было выбрать тот же файл снова
            fileInput.value = '';
        }
    }

    // Кнопка "Загрузить еще"
    uploadAnotherButton.addEventListener('click', () => {
        showScreen('upload');
    });

    // Функция для переключения экранов
    function showScreen(screenName) {
        uploadArea.classList.add('hidden');
        statusArea.classList.add('hidden');
        successArea.classList.add('hidden');

        document.getElementById(`${screenName}-area`).classList.remove('hidden');
    }

    // Адаптация под темную/светлую тему Telegram
    if (tg.colorScheme === 'dark') {
        document.documentElement.classList.add('dark');
    }
});