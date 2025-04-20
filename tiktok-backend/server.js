const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { runTikTokAutomation } = require('./puppeteerRunner');

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/tiktok/action', async (req, res) => {
    const { username, password, action, videoUrl, cookiesRaw } = req.body;

    try {
        const result = await runTikTokAutomation({ username, password, action, videoUrl, cookiesRaw });
        res.status(200).json({ message: '✅ Tương tác thành công!', result });
    } catch (err) {
        console.error('❌ Lỗi:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🔥 Backend TikTok chạy tại http://localhost:${port}`);
});