const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());

const comments = [
  "🔥 Hay quá trời ơi!", "Video chất lượng vãi 😍", "Ủng hộ bạn nè!",
  "Đỉnh của chóp!", "Nội dung siêu cuốn!", "Chấm hết! 😎",
];

function sanitizeUsername(username) {
  return username.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function parseCookies(cookiesRaw) {
  return cookiesRaw.split(';').map(cookieStr => {
    const [name, ...valParts] = cookieStr.trim().split('=');
    return name && valParts.length ? {
      name: name.trim(),
      value: valParts.join('=').trim(),
      domain: '.tiktok.com',
      path: '/',
      httpOnly: false,
      secure: true,
    } : null;
  }).filter(Boolean);
}

async function autoComment(page) {
  while (true) {
    const comment = comments[Math.floor(Math.random() * comments.length)];
    try {
      const selector = 'div[contenteditable][placeholder="Say something nice"]';
      await page.waitForSelector(selector, { visible: true });
      await page.focus(selector);
      await page.type(selector, comment, { delay: 100 });
      await page.keyboard.press('Enter');
      console.log(`💬 Đã gửi comment: ${comment}`);
      await new Promise(res => setTimeout(res, 15000));
    } catch (err) {
      console.log('❌ Không comment được:', err.message);
      break;
    }
  }
}

async function runTikTokAutomation({ username, password, action, videoUrl, cookiesRaw }) {
  const safeUsername = sanitizeUsername(username);
  const profileDir = path.join(__dirname, 'profiles', safeUsername);
  const cookiePath = path.join(__dirname, 'cookies', `${safeUsername}-${Date.now()}.json`);

  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const launchOptions = {
    headless: false,
    defaultViewport: null,
    userDataDir: profileDir,
    args: ['--no-sandbox'],
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  };

  let browser;
  try {
    try {
      browser = await puppeteer.launch(launchOptions);
    } catch (err) {
      if (err.message.includes('SingletonLock')) {
        fs.rmSync(profileDir, { recursive: true, force: true });
        fs.mkdirSync(profileDir, { recursive: true });
        browser = await puppeteer.launch(launchOptions);
      } else throw err;
    }

    const page = await browser.newPage();

    if (cookiesRaw) {
      const cookies = parseCookies(cookiesRaw);
      await page.setCookie(...cookies);
      await page.goto('https://www.tiktok.com/', { waitUntil: 'domcontentloaded' });

      const isLoggedIn = await page.evaluate(() => !document.body.innerText.includes('Log in'));
      if (!isLoggedIn) throw new Error("⚠️ Cookie không hợp lệ hoặc đã hết hạn");

      const updatedCookies = await page.cookies();
      fs.writeFileSync(cookiePath, JSON.stringify(updatedCookies, null, 2));
    }

    await page.goto(videoUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    if (action === 'like') {
      let count = 1;
      while (true) {
        await page.waitForSelector('div.tiktok-pn4agh.e1tv929b2', { visible: true });
        await page.click('div.tiktok-pn4agh.e1tv929b2');
        console.log(`❤️ Like lần ${count++}`);
        await new Promise(res => setTimeout(res, 30000));
      }
    } else if (action === 'comment') {
      await autoComment(page);
    } else if (action === 'share') {
      await page.click('[data-e2e="share-icon"]');
      console.log('🔁 Đã share!');
    } else {
      throw new Error(`❌ Hành động không hợp lệ: ${action}`);
    }

    return { status: "done" };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = { runTikTokAutomation };