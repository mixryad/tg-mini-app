// server.js

const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const multer = require('multer');
const { google } = require('googleapis');
const path = require('path');

const app = express();

// --- MIDDLEWARE ---
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json()); // Для парсинга JSON-тел запросов

// --- ПОДКЛЮЧЕНИЕ К MONGODB ---
// Эту строку нужно будет добавить в переменные окружения на Vercel
// под именем MONGO_URI
const MONGO_URI = process.env.MONGO_URI; 
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB подключена успешно.'))
  .catch(err => console.error('Ошибка подключения к MongoDB:', err));

// --- МОДЕЛИ ДАННЫХ (СХЕМЫ) ---
const UserSchema = new mongoose.Schema({
    tgId: { type: String, required: true, unique: true },
    firstName: String,
    lastName: String,
    username: String,
    ageCategory: { type: String, enum: ['6-7', '8-9', '10-11'], required: true },
    isAdmin: { type: Boolean, default: false }
});
const User = mongoose.model('User', UserSchema);

const CaseSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    ispringUrl: { type: String, required: true },
    ageCategory: { type: String, enum: ['6-7', '8-9', '10-11'], required: true },
});
const Case = mongoose.model('Case', CaseSchema);

const SubmissionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    caseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Case', required: true },
    googleDriveFileId: { type: String, required: true },
    submittedAt: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema);

// --- НАСТРОЙКИ GOOGLE DRIVE И MULTER (остаются как были) ---
// ... ваш код для Google Drive и Multer (с memoryStorage) ...
// Не забудьте FOLDER_ID
const FOLDER_ID = '...';

// --- API МАРШРУТЫ ---

// 1. Регистрация нового пользователя
app.post('/api/register', async (req, res) => {
    try {
        const { tgId, firstName, lastName, username, ageCategory } = req.body;
        const newUser = new User({ tgId, firstName, lastName, username, ageCategory });
        await newUser.save();
        res.status(201).json(newUser);
    } catch (error) {
        res.status(500).json({ message: 'Ошибка регистрации', error });
    }
});

// 2. Получение данных текущего пользователя
app.get('/api/user/me', async (req, res) => {
    const tgId = req.query.tgId;
    const user = await User.findOne({ tgId });
    if (user) {
        // Также получим список отправленных им решений
        const submissions = await Submission.find({ userId: user._id }).select('caseId');
        res.json({ user, submissions });
    } else {
        res.status(404).json({ message: 'Пользователь не найден' });
    }
});

// 3. Получение списка кейсов для категории пользователя
app.get('/api/cases', async (req, res) => {
    const { ageCategory } = req.query;
    const cases = await Case.find({ ageCategory });
    res.json(cases);
});

// 4. Загрузка файла (МОДЕРНИЗИРОВАННАЯ)
// Теперь мы принимаем userId и caseId вместе с файлом
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.post('/upload', upload.single('file'), async (req, res) => {
    const { userId, caseId } = req.body; // Получаем ID из тела запроса
    if (!userId || !caseId || !req.file) {
        return res.status(400).send('Не хватает данных: userId, caseId или файла.');
    }

    // ... ваш код для загрузки файла на Google Drive ...
    // После успешной загрузки вы получаете `response.data.id` от Google
    const googleFileId = response.data.id;

    // Сохраняем информацию о решении в нашу базу
    const newSubmission = new Submission({
        userId,
        caseId,
        googleDriveFileId: googleFileId
    });
    await newSubmission.save();
    
    res.status(200).json({ message: 'Решение успешно загружено!' });
});

// 5. Маршруты для АДМИНИСТРАТОРА (защищенные)
// Простая защита: проверяем секретный заголовок
const adminAuth = (req, res, next) => {
    if (req.headers['x-admin-secret'] === process.env.ADMIN_SECRET) {
        next();
    } else {
        res.status(403).send('Доступ запрещен');
    }
};

app.post('/api/admin/cases', adminAuth, async (req, res) => {
    // Логика создания нового кейса
    const { title, description, ispringUrl, ageCategory } = req.body;
    const newCase = new Case({ title, description, ispringUrl, ageCategory });
    await newCase.save();
    res.status(201).json(newCase);
});

// --- ЭКСПОРТ ДЛЯ VERCEL ---
module.exports = app;