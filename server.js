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
const upload = multer({ dest: 'uploads/' }); // Временная папка для файлов

// Настройки Google Drive API
const KEYFILEPATH = path.join(__dirname, 'credentials.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

const auth = new google.auth.GoogleAuth({
    keyFile: KEYFILEPATH,
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
        const { path: filePath, originalname, mimetype } = req.file;

        const response = await drive.files.create({
            requestBody: {
                name: originalname,
                mimeType: mimetype,
                parents: [FOLDER_ID],
            },
            media: {
                mimeType: mimetype,
                body: fs.createReadStream(filePath),
            },
        });

        // Удаляем временный файл после загрузки
        fs.unlinkSync(filePath);

        console.log('Файл успешно загружен:', response.data);
        res.status(200).json({ message: 'Файл успешно загружен!', file: response.data });

    } catch (error) {
        console.error('Ошибка при загрузке файла:', error.message);
        res.status(500).send('Произошла ошибка на сервере.');
    }
});

app.listen(port, () => {
    console.log(`Сервер запущен на http://localhost:${port}`);
});