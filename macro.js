const { chromium } = require('playwright');

const PHONE_NUMBER = '01044801692';
const TARGET_URL = 'https://iic-restaurant2.vercel.app/';
const TARGET_TIME = '13:00'; // 테스트용 13:00 (나중에 12:00으로 변경)
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

async function runMacro() {
  console.log(`[${new Date().toISOString()}] 매크로 시작 - ${TARGET_TIME} 예약 시도`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  });

  const page = await context.newPage();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[시도 ${attempt}/${MAX_RETRIES}] 페이지 로딩 중...`);
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(3000);

      // 페이지 텍스트 출력 (디버깅)
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('페이지 텍스트:', bodyText.substring(0, 500));

      // 슬롯 상태 확인
      const slotStatus = await page.evaluate((time) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const el = elements.find(e => e.children.length === 0 && e.innerText?.includes(time));
        if (!el) return 'NOT_FOUND';
        const parent = el.closest('div') || el.parentElement;
        return parent?.innerText?.trim();
      }, TARGET_TIME);

      console.log(`${TARGET_TIME} 슬롯 상태:`, slotStatus);

      if (slotStatus === 'NOT_FOUND') {
        console.log('슬롯을 찾을 수 없습니다. 재시도...');
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      if (slotStatus.toUpperCase().includes('FULL') || slotStatus.includes('꽉')) {
        console.log('FULL 상태. 재시도...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      // 시간 슬롯 클릭
      await page.evaluate((time) => {
        const elements = Array.from(document.querySelectorAll('*'));
        const el = elements.find(e => e.children.length === 0 && e.innerText?.includes(time));
        if (el) el.click();
      }, TARGET_TIME);
      console.log(`${TARGET_TIME} 클릭 완료`);
      await page.waitForTimeout(1000);

      // 연락처 입력
      const phoneInput = page.locator('input').first();
      await phoneInput.click();
      await phoneInput.fill(PHONE_NUMBER);
      console.log('연락처 입력 완료:', PHONE_NUMBER);
      await page.waitForTimeout(500);

      // 예약하기 클릭
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const btn = btns.find(b => b.innerText?.includes('예약하기'));
        if (btn) btn.click();
      });
      console.log('예약하기 클릭 완료!');

      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'reservation_result.png' });
      console.log('✅ 예약 완료!');

      await browser.close();
      return;

    } catch (err) {
      console.error(`오류: ${err.message}`);
      await page.screenshot({ path: `error_attempt_${attempt}.png` }).catch(() => {});
      await page.waitForTimeout(RETRY_INTERVAL_MS);
    }
  }

  await browser.close();
  console.log('모든 시도 완료');
}

runMacro();
