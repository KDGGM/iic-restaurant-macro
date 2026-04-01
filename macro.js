const { chromium } = require('playwright');

const TARGET_URL = 'https://iic-restaurant2.vercel.app/';
const TARGET_TIME = '12:00';
const MAX_RETRIES = 5;
const RETRY_INTERVAL_MS = 5000;

const PHONE_NUMBERS = [
  '01044801692',
  '01098899387',
  '01062250205',
];

async function reserveOne(phoneNumber) {
  console.log(`\n📱 [${phoneNumber}] 예약 시작`);

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
      const timeSlot = page.locator(`text=${TARGET_TIME}`).first();
      await timeSlot.scrollIntoViewIfNeeded();
      await timeSlot.click({ force: true });
      console.log(`${TARGET_TIME} 클릭 완료`);
      await page.waitForTimeout(2000);

      // 연락처 입력
      const phoneInput = page.locator('input').first();
      await phoneInput.scrollIntoViewIfNeeded();
      await phoneInput.click({ force: true });
      await phoneInput.fill('');
      await page.waitForTimeout(300);
      await phoneInput.type(phoneNumber, { delay: 80 });
      console.log('연락처 입력 완료:', phoneNumber);
      await page.waitForTimeout(1000);

      // 예약하기 버튼 클릭
      const submitBtn = page.locator('button:has-text("예약하기 →")').first();
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click({ force: true });
      console.log('예약하기 버튼 클릭 완료!');

      await page.waitForTimeout(5000);
      await page.screenshot({ path: `result_${phoneNumber}.png` });
      console.log(`✅ [${phoneNumber}] 예약 완료!`);

      await browser.close();
      return true;

    } catch (err) {
      console.error(`오류: ${err.message}`);
      await page.screenshot({ path: `error_${phoneNumber}_${attempt}.png` }).catch(() => {});
      await page.waitForTimeout(RETRY_INTERVAL_MS);
    }
  }

  await browser.close();
  console.log(`❌ [${phoneNumber}] 예약 실패`);
  return false;
}

async function runAll() {
  console.log(`[${new Date().toISOString()}] 전체 예약 시작 - ${TARGET_TIME}`);

  for (let i = 0; i < PHONE_NUMBERS.length; i++) {
    console.log(`\n===== ${i + 1}/${PHONE_NUMBERS.length} 번째 예약 =====`);
    await reserveOne(PHONE_NUMBERS[i]);
    // 각 예약 사이 3초 대기
    if (i < PHONE_NUMBERS.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n🎉 전체 예약 작업 완료!');
}

runAll();
