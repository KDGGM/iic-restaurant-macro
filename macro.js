const { chromium } = require('playwright');
const fs = require('fs');

const TARGET_URL = 'https://iic-restaurant2.vercel.app/';
const TARGET_TIME = '12:00';
const MAX_RETRIES = 10;
const RETRY_INTERVAL_MS = 3000;

const data = JSON.parse(fs.readFileSync('numbers.json', 'utf-8'));
const RESERVATIONS = data.예약자목록;

async function isSiteOpen() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();

  try {
    await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);

    const slotInfo = await page.evaluate((time) => {
      const all = Array.from(document.querySelectorAll('*'));
      const el = all.find(e => e.children.length === 0 && e.innerText?.trim() === time);
      if (!el) return { found: false };
      const parent = el.parentElement;
      return { found: true, parentText: parent?.innerText?.trim() };
    }, TARGET_TIME);

    console.log('사이트 상태 확인:', JSON.stringify(slotInfo));
    await browser.close();

    if (!slotInfo.found) {
      console.log('❌ 예약 사이트가 닫혀 있습니다. 오늘은 종료합니다.');
      return false;
    }
    return true;
  } catch (err) {
    await browser.close();
    console.log('❌ 사이트 접속 실패:', err.message);
    return false;
  }
}

async function reserveOne(이름, phoneNumber) {
  console.log(`\n📱 [${이름} / ${phoneNumber}] 예약 시작`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const context = await browser.newContext({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
  const page = await context.newPage();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`[시도 ${attempt}/${MAX_RETRIES}] 페이지 로딩 중...`);
      await page.goto(TARGET_URL, { waitUntil: 'load', timeout: 60000 });
      await page.waitForTimeout(5000);

      const slotInfo = await page.evaluate((time) => {
        const all = Array.from(document.querySelectorAll('*'));
        const el = all.find(e => e.children.length === 0 && e.innerText?.trim() === time);
        if (!el) return { found: false };
        const parent = el.parentElement;
        return { found: true, parentText: parent?.innerText?.trim() };
      }, TARGET_TIME);

      console.log(`${TARGET_TIME} 슬롯 상태:`, slotInfo.parentText);

      if (!slotInfo.found) {
        console.log('슬롯 못 찾음. 재시도...');
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      if (slotInfo.parentText?.toUpperCase().includes('FULL')) {
        console.log('FULL 상태. 재시도...');
        await page.reload({ waitUntil: 'load' });
        await page.waitForTimeout(RETRY_INTERVAL_MS);
        continue;
      }

      const timeSlot = page.locator(`text="${TARGET_TIME}"`).first();
      await timeSlot.scrollIntoViewIfNeeded();
      await timeSlot.click({ force: true });
      console.log(`${TARGET_TIME} 클릭 완료`);
      await page.waitForTimeout(2000);

      const phoneInput = page.locator('input').first();
      await phoneInput.scrollIntoViewIfNeeded();
      await phoneInput.click({ force: true });
      await phoneInput.fill('');
      await page.waitForTimeout(300);
      await phoneInput.type(phoneNumber, { delay: 80 });
      console.log('연락처 입력 완료:', phoneNumber);
      await page.waitForTimeout(1000);

      const submitBtn = page.locator('button:has-text("예약하기 →")').first();
      await submitBtn.scrollIntoViewIfNeeded();
      await submitBtn.click({ force: true });
      console.log('예약하기 클릭 완료!');

      await page.waitForTimeout(5000);
      await page.screenshot({ path: `result_${phoneNumber}.png` });
      console.log(`✅ [${이름}] 예약 완료!`);

      await browser.close();
      return true;

    } catch (err) {
      console.error(`오류: ${err.message}`);
      await page.screenshot({ path: `error_${phoneNumber}_${attempt}.png` }).catch(() => {});
      await page.waitForTimeout(RETRY_INTERVAL_MS);
    }
  }

  await browser.close();
  console.log(`❌ [${이름}] 예약 실패`);
  return false;
}

async function runAll() {
  console.log(`[${new Date().toISOString()}] 전체 예약 시작 - ${TARGET_TIME}`);
  console.log(`예약 대상 ${RESERVATIONS.length}명:`, RESERVATIONS.map(r => r.이름).join(', '));

  const open = await isSiteOpen();
  if (!open) return;

  for (let i = 0; i < RESERVATIONS.length; i++) {
    const { 이름, 번호 } = RESERVATIONS[i];
    console.log(`\n===== ${i + 1}/${RESERVATIONS.length} 번째 예약 =====`);
    await reserveOne(이름, 번호);
    if (i < RESERVATIONS.length - 1) await new Promise(r => setTimeout(r, 3000));
  }

  console.log('\n🎉 전체 예약 작업 완료!');
}

runAll();
