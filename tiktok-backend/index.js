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

function sanitizeUsername(username) {
  return username.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function autoCommentLoop(page, comments, username) {
  console.log(`💬 [${comments}] Bắt đầu vòng comment tự động...`);
  let count = 1;
  while (true) {
    const comment = comments[Math.floor(Math.random() * comments.length)];
    const commentSelector = 'div[contenteditable][placeholder="Say something nice"]';

    try {
      await page.waitForSelector(commentSelector, { visible: true, timeout: 15000 });
      await page.focus(commentSelector);
      await page.type(commentSelector, comment, { delay: 100 });
      console.log(`💬 [${username}] Nhập comment #${count}: "${comment}"`);
      await page.keyboard.press('Enter');
      console.log(`📨 [${username}] Đã gửi comment!\n`);
      count++;
      await new Promise(resolve => setTimeout(resolve, 15000));
    } catch (err) {
      console.log(`❌ [${username}] Không tìm thấy ô comment hoặc không thể comment tiếp.`);
      break;
    }
  }
}

async function handleUserAction(user, videoUrl, comments) {
  const { username, password, cookiesRaw } = user;
  const safeUsername = sanitizeUsername(username);
  const userProfilePath = path.join(__dirname, 'profiles', safeUsername);

  const launchOptions = {
    headless: false,
    defaultViewport: null,
    userDataDir: userProfilePath,
    args: ['--no-sandbox'],
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // Đổi nếu dùng Win/Linux
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
        console.warn('⚠️ SingletonLock – Xoá profile lỗi và khởi động lại...');
        fs.rmSync(userProfilePath, { recursive: true, force: true });
        fs.mkdirSync(userProfilePath, { recursive: true });
        browser = await puppeteer.launch(launchOptions);
      } else {
        throw launchErr;
      }
    }

    const page = await browser.newPage();

    // if (cookiesRaw) {
    //   const cookies = parseCookies(cookiesRaw);
    //   console.log(`🍪 [${username}] Cookies từ client:`, cookies);

    //   await page.setCookie(...cookies);
    //   await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });

    //   const isLoggedIn = await page.evaluate(() => {
    //     return !document.body.innerText.includes('Log in');
    //   });

    //   console.log(`✅ [${username}] Trạng thái đăng nhập: ${isLoggedIn}`);
    //   if (!isLoggedIn) throw new Error("⚠️ Cookies không hợp lệ hoặc hết hạn!");

    //   const updatedCookies = await page.cookies();
    //   fs.writeFileSync(`./cookies/${safeUsername}.json`, JSON.stringify(updatedCookies, null, 2));
    // }

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Like loop
    let likeCount = 1;
    const likeLoop = async () => {
      while (true) {
        try {
          await page.waitForSelector('div.tiktok-pn4agh.e1tv929b2', { visible: true, timeout: 15000 });
          await page.click('div.tiktok-pn4agh.e1tv929b2');
          console.log(`❤️ [${username}] Like lần ${likeCount}`);
          likeCount++;
          await new Promise(resolve => setTimeout(resolve, 30000));
        } catch (err) {
          console.warn(`⚠️ [${username}] Không thể like tiếp: ${err.message}`);
          break;
        }
      }
    };

    // Comment loop nếu có comment
    const commentLoop = async () => {
      console.log(`💬 [${comments}] Bắt đầu vòng comment tự động...`);
      if (Array.isArray(comments) && comments.length > 0) {
        await autoCommentLoop(page, comments, username);
      }
    };

    // Bắn cả 2
    await Promise.all([likeLoop(), commentLoop()]);

    return { username, status: 'success' };
  } catch (err) {
    console.error(`❌ [${username}] Lỗi: ${err.message}`);
    return { username, status: 'error', message: err.message };
  } finally {
    if (browser) await browser.close();
  }
}

app.post('/tiktok/action', async (req, res) => {
  const { users, videoUrl, comments = [] } = req.body;
  console.log(`🔥 Nhận yêu cầu action TikTok tại http://localhost:${port}`);

  if (!Array.isArray(users) || users.length === 0) {
    return res.status(400).json({ error: "Danh sách user không hợp lệ" });
  }

  const results = [];
  const maxConcurrency = 3;

  for (let i = 0; i < users.length; i += maxConcurrency) {
    const chunk = users.slice(i, i + maxConcurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(user => handleUserAction(user, videoUrl, comments))
    );
    results.push(...chunkResults);
  }

  res.status(200).json({ results });
});

app.listen(port, () => {
  console.log(`🚀 TikTok backend đang chạy tại http://localhost:${port}`);
});