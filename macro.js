const { chromium } = require('playwright');

const PHONE_NUMBER = '01044801692';
const TARGET_URL = 'https://iic-restaurant2.vercel.app/';
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 10000; // 10초마다 재시도

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
      await page.waitForTimeout(2000);

      // ───────────────────────────────────────────
      // STEP 1: 12:00 버튼 찾기 및 클릭
      // ───────────────────────────────────────────
      console.log('STEP 1: 12:00 시간 슬롯 탐색 중...');

      // 12:00이 포함된 버튼/div 탐색 (FULL이 아닌 활성화 상태)
      const timeSlot = await page.locator('text=12:00').first();
      const slotExists = await timeSlot.count();

      if (slotExists === 0) {
        console.log('  → 12:00 슬롯을 찾을 수 없습니다. 재시도...');
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      // 부모 컨테이너 확인하여 비활성화(FULL) 여부 체크
      const slotParent = timeSlot.locator('xpath=../..');
      const slotText = await slotParent.textContent();
      console.log(`  → 12:00 슬롯 텍스트: "${slotText?.trim()}"`);

      const isFull =
        slotText?.toLowerCase().includes('full') ||
        slotText?.includes('꽉') ||
        slotText?.includes('마감');

      if (isFull) {
        console.log('  → 12:00 슬롯이 아직 FULL 상태입니다. 재시도...');
        await page.reload({ waitUntil: 'networkidle' });
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      // 클릭 시도
      await timeSlot.click({ force: true });
      console.log('  → 12:00 슬롯 클릭 완료!');
      await page.waitForTimeout(1000);

      // ───────────────────────────────────────────
      // STEP 2: 연락처 입력 필드 클릭
      // ───────────────────────────────────────────
      console.log('STEP 2: 연락처 입력 필드 클릭 중...');
      const phoneInput = await page
        .locator('input[placeholder*="010"]')
        .first();
      await phoneInput.click();
      await page.waitForTimeout(500);
      console.log('  → 입력 필드 클릭 완료');

      // ───────────────────────────────────────────
      // STEP 3: 연락처 입력
      // ───────────────────────────────────────────
      console.log(`STEP 3: 연락처 입력 중... (${PHONE_NUMBER})`);
      await phoneInput.fill('');
      await phoneInput.type(PHONE_NUMBER, { delay: 80 });
      console.log('  → 연락처 입력 완료');
      await page.waitForTimeout(500);

      // ───────────────────────────────────────────
      // STEP 4: 예약하기 버튼 클릭
      // ───────────────────────────────────────────
      console.log('STEP 4: 예약하기 버튼 클릭 중...');
      const submitBtn = page
        .locator('button')
        .filter({ hasText: /예약하기/ })
        .first();
      await submitBtn.click();
      console.log('  → 예약하기 버튼 클릭 완료!');

      await page.waitForTimeout(3000);

      // 결과 스크린샷 저장
      await page.screenshot({ path: 'reservation_result.png', fullPage: false });
      console.log('✅ 예약 완료! 스크린샷 저장됨: reservation_result.png');

      await browser.close();
      return true;
    } catch (err) {
      console.error(`  → 오류 발생: ${err.message}`);
      await page.screenshot({ path: `error_attempt_${attempt}.png` }).catch(() => {});

      if (attempt < MAX_RETRIES) {
        console.log(`  → ${RETRY_INTERVAL_MS / 1000}초 후 재시도...`);
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        await page.reload({ waitUntil: 'networkidle' }).catch(() => {});
      }
    }
  }

  await browser.close();
  console.error('❌ 모든 재시도 실패. 예약하지 못했습니다.');
  process.exit(1);
}

runMacro();
