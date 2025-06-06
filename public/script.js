document.addEventListener('DOMContentLoaded', () => {
    // --- ИНИЦИАЛИЗАЦИЯ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ---
    const tg = window.Telegram.WebApp;
    tg.expand();
    
    // Получаем данные пользователя из Telegram
    const tgUser = tg.initDataUnsafe?.user;
    
    // Состояние приложения
    const state = {
        currentUser: null,
        currentCaseId: null,
        submittedCaseIds: [],
    };

    // --- DOM ЭЛЕМЕНТЫ ---
    const screens = {
        loading: document.getElementById('loading-screen'),
        registration: document.getElementById('registration-screen'),
        main: document.getElementById('main-screen'),
        upload: document.getElementById('upload-screen'),
        admin: document.getElementById('admin-panel'),
    };
    
    const elements = {
        ageCategorySelector: document.getElementById('age-category-selector'),
        registrationError: document.getElementById('registration-error'),
        casesList: document.getElementById('cases-list'),
        uploadTitle: document.getElementById('upload-title'),
        fileInput: document.getElementById('file-input'),
        selectFileButton: document.getElementById('select-file-button'),
        backToMainButton: document.getElementById('back-to-main-button'),
        statusArea: document.getElementById('status-area'),
        uploadArea: document.getElementById('upload-area'),
        adminPanelButton: document.getElementById('admin-panel-button'),
        createCaseButton: document.getElementById('create-case-button'),
        adminStatus: document.getElementById('admin-status'),
        adminBackButton: document.getElementById('admin-back-button'),
    };

    // --- ФУНКЦИИ ---

    // Функция для переключения экранов
    function showScreen(screenName) {
        Object.values(screens).forEach(screen => screen.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    // Функция для отрисовки кейсов
    function renderCases(cases) {
        elements.casesList.innerHTML = '';
        if (cases.length === 0) {
            elements.casesList.innerHTML = '<p>Пока нет доступных кейсов для вашей категории.</p>';
            return;
        }

        cases.forEach(caseItem => {
            const isSubmitted = state.submittedCaseIds.includes(caseItem._id);
            const card = document.createElement('div');
            card.className = 'case-card';
            card.innerHTML = `
                <h2>${caseItem.title}</h2>
                <p>${caseItem.description}</p>
                <div class="buttons">
                    <button class="view-case-btn" data-url="${caseItem.ispringUrl}">Посмотреть кейс</button>
                    ${isSubmitted 
                        ? `<div class="submitted-status"><span>✅ Решение отправлено</span></div>`
                        : `<button class="upload-solution-btn" data-case-id="${caseItem._id}" data-case-title="${caseItem.title}">Отправить решение</button>`
                    }
                </div>
            `;
            elements.casesList.appendChild(card);
        });
    }

    // Инициализация приложения
    async function init() {
        if (!tgUser?.id) {
            showScreen('registration');
            elements.registrationError.textContent = 'Не удалось получить данные Telegram. Пожалуйста, перезапустите приложение.';
            return;
        }

        try {
            const response = await fetch(`/api/user/me?tgId=${tgUser.id}`);
            
            if (response.status === 404) {
                // Пользователь не найден, показываем регистрацию
                showScreen('registration');
            } else if (response.ok) {
                // Пользователь найден
                const { user, submissions } = await response.json();
                state.currentUser = user;
                state.submittedCaseIds = submissions.map(sub => sub.caseId);
                
                // Проверяем, админ ли пользователь
                if (user.isAdmin) {
                    elements.adminPanelButton.classList.remove('hidden');
                }

                await loadCases(user.ageCategory);
                showScreen('main');
            } else {
                throw new Error('Ошибка сервера при проверке пользователя.');
            }
        } catch (error) {
            console.error(error);
            showScreen('registration');
            elements.registrationError.textContent = 'Не удалось подключиться к серверу. Попробуйте позже.';
        }
    }
    
    // Загрузка кейсов
    async function loadCases(ageCategory) {
        try {
            const response = await fetch(`/api/cases?ageCategory=${ageCategory}`);
            const cases = await response.json();
            renderCases(cases);
        } catch (error) {
            console.error('Ошибка загрузки кейсов:', error);
            elements.casesList.innerHTML = '<p>Не удалось загрузить кейсы.</p>';
        }
    }

    // Регистрация пользователя
    async function registerUser(ageCategory) {
        try {
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tgId: tgUser.id,
                    firstName: tgUser.first_name,
                    lastName: tgUser.last_name,
                    username: tgUser.username,
                    ageCategory: ageCategory,
                }),
            });
            if (response.ok) {
                // После успешной регистрации снова инициализируем приложение
                await init();
            } else {
                throw new Error('Ошибка регистрации на сервере.');
            }
        } catch (error) {
            console.error(error);
            elements.registrationError.textContent = 'Произошла ошибка. Попробуйте снова.';
        }
    }
    
    // Загрузка файла решения
    async function uploadFile(file) {
        elements.uploadArea.classList.add('hidden');
        elements.statusArea.classList.remove('hidden');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('userId', state.currentUser._id);
        formData.append('caseId', state.currentCaseId);
        
        try {
            const response = await fetch('/upload', { method: 'POST', body: formData });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Ошибка при загрузке.');
            }
            
            tg.HapticFeedback.notificationOccurred('success');
            tg.showPopup({
                title: 'Успешно!',
                message: 'Ваше решение было отправлено.',
                buttons: [{ type: 'ok' }]
            });
            // Обновляем состояние и перерисовываем главный экран
            state.submittedCaseIds.push(state.currentCaseId);
            await loadCases(state.currentUser.ageCategory);
            showScreen('main');
        } catch (error) {
            tg.HapticFeedback.notificationOccurred('error');
            tg.showAlert(`Ошибка: ${error.message}`);
        } finally {
            elements.uploadArea.classList.remove('hidden');
            elements.statusArea.classList.add('hidden');
            elements.fileInput.value = '';
        }
    }


    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    // Выбор категории возраста
    elements.ageCategorySelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('age-button')) {
            const category = e.target.dataset.category;
            registerUser(category);
        }
    });

    // Клик по списку кейсов (делегирование событий)
    elements.casesList.addEventListener('click', (e) => {
        const target = e.target;
        if (target.classList.contains('view-case-btn')) {
            tg.openLink(target.dataset.url);
        }
        if (target.classList.contains('upload-solution-btn')) {
            state.currentCaseId = target.dataset.caseId;
            elements.uploadTitle.textContent = `Решение для: ${target.dataset.caseTitle}`;
            showScreen('upload');
        }
    });
    
    // Кнопка выбора файла
    elements.selectFileButton.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', (e) => {
        if(e.target.files[0]) {
            uploadFile(e.target.files[0]);
        }
    });
    
    // Кнопки "Назад"
    elements.backToMainButton.addEventListener('click', () => showScreen('main'));
    elements.adminBackButton.addEventListener('click', () => showScreen('main'));

    // Кнопка админ-панели
    elements.adminPanelButton.addEventListener('click', () => showScreen('admin'));

    // Создание кейса в админке
    elements.createCaseButton.addEventListener('click', async () => {
        const title = document.getElementById('admin-case-title').value;
        const description = document.getElementById('admin-case-description').value;
        const url = document.getElementById('admin-case-url').value;
        const category = document.getElementById('admin-case-category').value;
        
        if (!title || !url) {
            return alert('Название и ссылка обязательны!');
        }
        
        // Запрашиваем секретный ключ
        const secret = prompt('Введите секретный ключ администратора:');
        if (!secret) return;

        try {
            const response = await fetch('/api/admin/cases', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-secret': secret
                },
                body: JSON.stringify({ title, description, ispringUrl: url, ageCategory: category }),
            });

            if (response.ok) {
                elements.adminStatus.textContent = 'Кейс успешно создан!';
                setTimeout(() => elements.adminStatus.textContent = '', 3000);
            } else {
                throw new Error('Ошибка создания кейса. Проверьте ключ.');
            }
        } catch (error) {
            alert(error.message);
        }
    });

    // --- ЗАПУСК ПРИЛОЖЕНИЯ ---
    init();
});