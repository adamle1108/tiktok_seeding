const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const comments = [
  "🔥 Hay quá trời ơi!",
  "Video chất lượng vãi 😍",
  "Ủng hộ bạn nè!",
  "Đỉnh của chóp!",
  "Nội dung siêu cuốn!",
  "Chấm hết! 😎",
];

// 🍪 Parse raw cookie string → Puppeteer-compatible format
function parseCookies(cookiesRaw) {
  return cookiesRaw.split(';').map(cookieStr => {
    const [name, ...valParts] = cookieStr.trim().split('=');
    if (!name || !valParts.length) return null;
    return {
      name: name.trim(),
      value: valParts.join('=').trim(),
      domain: '.tiktok.com',
      path: '/',
      httpOnly: false,
      secure: true,
    };
  }).filter(Boolean);
}

// 🧼 Sanitize username để tránh lỗi tên file/folder
function sanitizeUsername(username) {
  return username.replace(/[^a-zA-Z0-9_-]/g, '_');
}

// 🤖 Tự động comment ngẫu nhiên
async function autoComment(page) {
  while (true) {
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const commentSelector = 'div[contenteditable][placeholder="Say something nice"]';

    try {
      await page.waitForSelector(commentSelector, { visible: true });
      await page.focus(commentSelector);
      await page.type(commentSelector, comment, { delay: 100 });
      console.log(`💬 Đã nhập comment: "${comment}"`);
      await page.keyboard.press('Enter');
      console.log('📨 Đã gửi comment!\n');
      await new Promise(resolve => setTimeout(resolve, 15000));
    } catch (err) {
      console.log('❌ Không tìm thấy ô comment. Có thể livestream đã kết thúc hoặc UI thay đổi.');
      break;
    }
  }
}

// 🎯 Xử lý tương tác cho từng user
async function handleUserAction(user, action, videoUrl) {
  const { username, password, cookiesRaw } = user;
  const safeUsername = sanitizeUsername(username);
  const userProfilePath = path.join(__dirname, 'profiles', safeUsername);

  const launchOptions = {
    headless: false,
    defaultViewport: null,
    userDataDir: userProfilePath,
    args: ['--no-sandbox'],
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // ⚠️ Update nếu dùng OS khác
  };

  let browser;

  try {
    if (!fs.existsSync(userProfilePath)) {
      fs.mkdirSync(userProfilePath, { recursive: true });
    }

    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (launchErr) {
      if (launchErr.message.includes('SingletonLock')) {
        console.warn('⚠️ SingletonLock – Xóa profile lỗi và khởi động lại...');
        fs.rmSync(userProfilePath, { recursive: true, force: true });
        fs.mkdirSync(userProfilePath, { recursive: true });
        browser = await puppeteer.launch(launchOptions);
      } else {
        throw launchErr;
      }
    }

    const page = await browser.newPage();

    // Nếu có cookies
    if (cookiesRaw) {
      const cookies = parseCookies(cookiesRaw);
      console.log(`🍪 [${username}] Cookie từ client:`, cookies);

      await page.setCookie(...cookies);
      await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });

      const isLoggedIn = await page.evaluate(() => {
        return !document.body.innerText.includes('Log in');
      });

      console.log(`✅ [${username}] Trạng thái đăng nhập: ${isLoggedIn}`);
      if (!isLoggedIn) throw new Error("⚠️ Cookies không hợp lệ hoặc hết hạn!");

      const updatedCookies = await page.cookies();
      fs.writeFileSync(`./cookies/${safeUsername}.json`, JSON.stringify(updatedCookies, null, 2));
    }

    // Truy cập video
    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Login thủ công nếu chưa có cookies (có thể skip nếu chỉ dùng cookies)
    // Login
    // await page.click('#header-login-button');

    // await page.locator('::-p-aria([name="Phone"][role="button"])').click();

    // await page.locator('text/email').click();


    // await page.evaluate(() => {
    //   const link = document.querySelector('a[href="/login/phone-or-email/email"]');
    //   if (link) link.click();
    // });
    // await page.waitForSelector('input[name="username"]');
    // await page.type('input[name="username"]', username, { delay: 100 }); // delay cho tự nhiên
    // await page.waitForSelector('input[placeholder="Password"]');
    // await page.type('input[placeholder="Password"]', password, { delay: 100 });
    // await page.click('[data-e2e="login-button"]');

    // Thực hiện hành động
    if (action === 'like') {
      let count = 1;
      while (true) {
        await page.waitForSelector('div.tiktok-pn4agh.e1tv929b2', { visible: true });
        await page.click('div.tiktok-pn4agh.e1tv929b2');
        console.log(`❤️ [${username}] Like lần ${count}`);
        count++;
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    } else if (action === 'comment') {
      await autoComment(page);
    } else if (action === 'share') {
      await page.click('[data-e2e="share-icon"]');
      console.log(`🔁 [${username}] Đã share!`);
    } else {
      throw new Error(`❌ Action không hợp lệ: ${action}`);
    }

    return { username, status: 'success' };
  } catch (err) {
    console.error(`❌ [${username}] Lỗi: ${err.message}`);
    return { username, status: 'error', message: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

// 🚀 Route nhận danh sách user và chạy song song (giới hạn)
app.post('/tiktok/action', async (req, res) => {
  const { users, action, videoUrl } = req.body;
  console.log(`🔥 TikTok backend đang chạy tại http://localhost:${users}`);
  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: "Danh sách user không hợp lệ" });
  }

  const results = [];
  const maxConcurrency = 3;

  for (let i = 0; i < users.length; i += maxConcurrency) {
    const chunk = users.slice(i, i + maxConcurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(user => handleUserAction(user, action, videoUrl))
    );
    results.push(...chunkResults);
  }

  res.status(200).json({ results });
});

app.listen(port, () => {
  console.log(`🔥 TikTok backend đang chạy tại http://localhost:${port}`);
});