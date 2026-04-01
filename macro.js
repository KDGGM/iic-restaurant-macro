const { chromium } = require('playwright');

const PHONE_NUMBER = '01044801692';
const TARGET_URL = 'https://iic-restaurant2.vercel.app/';
const TARGET_TIME = '13:00';
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
      await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(5000);

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
        await page.reload({ waitUntil: 'load' });
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
      await page.waitForTimeout(1500);

      // 연락처 입력
      const phoneInput = page.locator('input').first();
      await phoneInput.click();
      await phoneInput.fill('');
      await phoneInput.type(PHONE_NUMBER, { delay: 50 });
      console.log('연락처 입력 완료:', PHONE_NUMBER);
      await page.waitForTimeout(1000);

      // 예약하기 버튼 찾기 - 여러 방식으로 시도
      console.log('예약하기 버튼 탐색 중...');
      const btnInfo = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*'));
        return all
          .filter(el => el.innerText?.trim() === '예약하기 →' || el.innerText?.trim() === '예약하기')
          .map(el => ({
            tag: el.tagName,
            text: el.innerText?.trim(),
            className: el.className,
            disabled: el.disabled,
            type: el.type
          }));
      });
      console.log('예약하기 버튼 정보:', JSON.stringify(btnInfo));

      // 클릭 시도 1: Playwright locator
      try {
        const btn = page.locator('button:has-text("예약하기")').first();
        await btn.click({ timeout: 5000 });
        console.log('예약하기 버튼 클릭 완료 (방법1)');
      } catch (e) {
        console.log('방법1 실패, 방법2 시도...');
        // 클릭 시도 2: evaluate로 직접 클릭
        await page.evaluate(() => {
          const all = Array.from(document.querySelectorAll('*'));
          const btn = all.find(el => el.innerText?.includes('예약하기'));
          if (btn) {
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
            console.log('방법2 클릭:', btn.tagName, btn.className);
          }
        });
        console.log('예약하기 버튼 클릭 완료 (방법2)');
      }

      // 결과 대기 및 스크린샷
      await page.waitForTimeout(5000);
      const afterText = await page.evaluate(() => document.body.innerText);
      console.log('클릭 후 페이지:', afterText.substring(0, 300));
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
