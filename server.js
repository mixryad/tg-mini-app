const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
// Модуль fs больше не нужен, так как мы не работаем с локальной файловой системой
// const fs = require('fs');

const app = express();
// Переменная port больше не нужна, так как мы не вызываем app.listen()
// const port = 3000;

// Указываем путь к нашему фронтенду
// На Vercel статические файлы обрабатываются автоматически из папки public,
// но эта строка не мешает и полезна для локальной отладки.
app.use(express.static(path.join(__dirname, 'public')));

// Настройки для приема файлов Multer
// Используем memoryStorage, чтобы хранить файл в оперативной памяти,
// что необходимо для бессерверных сред вроде Vercel.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Настройки Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Проверяем, есть ли переменная окружения с ключом
// Эта проверка выполняется при "холодном старте" функции
if (!process.env.GOOGLE_CREDENTIALS) {
    // Важно выбросить ошибку, чтобы понять, что ключ не задан
    throw new Error('Переменная окружения GOOGLE_CREDENTIALS не найдена!');
}

// Парсим JSON из переменной окружения
let credentials;
try {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
} catch (e) {
    // Обрабатываем ошибку парсинга JSON, если вдруг ключ скопирован неверно
    console.error("Ошибка парсинга JSON из GOOGLE_CREDENTIALS:", e.message);
    throw new Error('Неверный формат JSON в переменной GOOGLE_CREDENTIALS.');
}


// Создаем экземпляр аутентификации Google
const auth = new google.auth.GoogleAuth({
    credentials, // Используем объект с данными вместо пути к файлу
    scopes: SCOPES,
});

// ID папки на Google Диске, куда будут загружаться файлы
// Проверьте, что этот ID правильный для вашей папки
const FOLDER_ID = '1vpI2bp6rXYAtrDcnFLMBEEn5eEOkiEaE'; // Ваш ID

// API-эндпоинт для загрузки
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        // Проверяем, был ли файл вообще передан
        if (!req.file) {
            return res.status(400).send('Файл не был загружен.');
        }

        // Получаем экземпляр Drive API с нашей аутентификацией
        const drive = google.drive({ version: 'v3', auth });

        // Получаем данные файла из req.file (благодаря memoryStorage)
        const { originalname, mimetype, buffer } = req.file;

        // Создаем файл на Google Диске
        const response = await drive.files.create({
            requestBody: {
                name: originalname,
                mimeType: mimetype,
                parents: [FOLDER_ID], // Указываем папку назначения
            },
            media: {
                mimeType: mimetype,
                // Используем поток из буфера для загрузки файла
                body: require('stream').Readable.from(buffer),
            },
        });

        // Временный файл не создавался, удалять ничего не нужно.

        // Логируем успех и отправляем ответ клиенту
        console.log('Файл успешно загружен:', response.data.name, response.data.id);
        res.status(200).json({ message: 'Файл успешно загружен!', file: { name: response.data.name, id: response.data.id } }); // Отправляем имя и ID загруженного файла

    } catch (error) {
        // Логируем ошибку и отправляем ответ об ошибке
        console.error('Ошибка при загрузке файла:', error); // Логируем полную ошибку для диагностики
        res.status(500).send('Произошла ошибка на сервере при загрузке файла.');
    }
});

// Это самая важная строка для Vercel!
// Мы экспортируем наше express-приложение,
// чтобы Vercel мог его использовать как бессерверную функцию.
module.exports = app;