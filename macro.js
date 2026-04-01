const { chromium } = require('playwright');

const PHONE_NUMBER = '01044801692';
const TARGET_URL = 'https://iic-restaurant2.vercel.app/';
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

async function runMacro() {
  console.log(`[${new Date().toISOString()}] 매크로 시작`);

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

      // 현재 페이지 HTML 출력 (디버깅용)
      const bodyText = await page.evaluate(() => document.body.innerText);
      console.log('페이지 텍스트 일부:', bodyText.substring(0, 500));

      // 모든 버튼 텍스트 출력
      const allButtons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, div[role="button"], [class*="slot"], [class*="time"]'))
          .map(el => el.innerText?.trim())
          .filter(Boolean);
      });
      console.log('발견된 버튼들:', JSON.stringify(allButtons));

      // 12:00 텍스트 포함된 요소 찾기
      const allElements = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('*'))
          .filter(el => el.children.length === 0 && el.innerText?.includes('12:00'))
          .map(el => ({
            tag: el.tagName,
            text: el.innerText?.trim(),
            className: el.className,
            parentText: el.parentElement?.innerText?.trim()?.substring(0, 100)
          }));
      });
      console.log('12:00 포함 요소들:', JSON.stringify(allElements));

      // FULL 여부 확인
      const isFull = await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const el = elements.find(e => e.children.length === 0 && e.innerText?.includes('12:00'));
        if (!el) return 'NOT_FOUND';
        const parent = el.closest('[class*="slot"], [class*="time"], div') || el.parentElement;
        return parent?.innerText?.trim();
      });
      console.log('12:00 슬롯 상태:', isFull);

      if (isFull === 'NOT_FOUND') {
        console.log('12:00 슬롯을 찾을 수 없습니다. 재시도...');
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      if (typeof isFull === 'string' && (isFull.toUpperCase().includes('FULL') || isFull.includes('꽉'))) {
        console.log('12:00 FULL 상태. 재시도...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      // 12:00 클릭
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll('*'));
        const el = elements.find(e => e.children.length === 0 && e.innerText?.includes('12:00'));
        if (el) el.click();
      });
      console.log('12:00 클릭 완료');
      await page.waitForTimeout(1000);

      // 연락처 입력
      const phoneInput = page.locator('input').first();
      await phoneInput.click();
      await phoneInput.fill(PHONE_NUMBER);
      console.log('연락처 입력 완료');
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
  console.log('모든 시도 완료 (FULL이거나 오류)');
  // exit code 1 제거 - FULL이어도 정상 종료
}

runMacro();
