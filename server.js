const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 3000;

// Указываем путь к нашему фронтенду (создадим его на следующем шаге)
app.use(express.static(path.join(__dirname, 'public')));

// Настройки для приема файлов
const storage = multer.memoryStorage(); // Используем хранилище в памяти
const upload = multer({ storage: storage });

// Настройки Google Drive API
const SCOPES = ['https://www.googleapis.com/auth/drive'];

// Проверяем, есть ли переменная окружения с ключом
if (!process.env.GOOGLE_CREDENTIALS) {
    throw new Error('Переменная окружения GOOGLE_CREDENTIALS не найдена!');
}

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
    credentials, // Используем объект с данными вместо пути к файлу
    scopes: SCOPES,
});

// ID папки на Google Диске, куда будут загружаться файлы
// Откройте папку на Диске в браузере, ID будет в URL:
// https://drive.google.com/drive/folders/1vpI2bp6rXYAtrDcnFLMBEEn5eEOkiEaE
const FOLDER_ID = '1vpI2bp6rXYAtrDcnFLMBEEn5eEOkiEaE';

// API-эндпоинт для загрузки
app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('Файл не был загружен.');
        }

        const drive = google.drive({ version: 'v3', auth });
        const { originalname, mimetype, buffer } = req.file; // Теперь у нас есть buffer вместо path

        const response = await drive.files.create({
            requestBody: {
                name: originalname,
                mimeType: mimetype,
                parents: [FOLDER_ID],
            },
            media: {
                mimeType: mimetype,
                body: require('stream').Readable.from(buffer), // Превращаем буфер в поток для отправки
            },
        });

        // Удалять временный файл больше не нужно!

        console.log('Файл успешно загружен:', response.data);
        res.status(200).json({ message: 'Файл успешно загружен!', file: response.data });

    } catch (error) {
        console.error('Ошибка при загрузке файла:', error.message);
        res.status(500).send('Произошла ошибка на сервере.');
    }
});