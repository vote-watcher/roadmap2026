const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const root = path.join(__dirname, '..');
const photoForms = [
  'forms/complaint-count.html',
  'forms/complaint-access.html',
  'forms/complaint-paper-ballot.html',
  'forms/complaint-movement.html',
  'forms/safepack-copy.html',
];
const documents = ['uvedomlenie_form.html', ...photoForms, 'forms/pamyatka-nablyudatelya.html'];
const htmlDocuments = ['forms.html', 'uvedomlenie_form.html', ...photoForms, 'forms/pamyatka-nablyudatelya.html'];

const url = file => `file://${path.join(root, file)}`;

test('forms catalog contains every document and follows every HTML link', async ({ page }) => {
  await page.goto(url('forms.html'));
  await expect(page).toHaveTitle('Формы');
  await expect(page.locator('h1')).toHaveText('Формы');
  const hrefs = await page.locator('main a').evaluateAll(links => links.map(link => link.getAttribute('href')));
  await expect(page.locator('h2')).not.toContainText('Справочные документы');
  await expect(page.locator('a[href$=".pdf"]')).toHaveCount(0);
  for (const href of hrefs) {
    if (href.endsWith('.html')) {
      await page.goto(url(decodeURIComponent(href)));
      await expect(page.locator('body')).toBeVisible();
    } else {
      expect(fs.existsSync(path.join(root, decodeURIComponent(href)))).toBe(true);
    }
  }
  expect(fs.existsSync(path.join(root, 'forms/pamyatka-nablyudatelya.html'))).toBe(true);
  expect(fs.existsSync(path.join(root, 'docs', 'ТЕЛЕФОНЫ ШТАБА.pdf'))).toBe(false);
});

test('navigation does not use the retired catalog name', async ({ page }) => {
  for (const file of htmlDocuments) {
    await page.goto(url(file));
    await expect(page.locator('body')).not.toContainText('Формы и памятка');
  }
});

test('all form pages follow their local HTML links through file URLs', async ({ page }) => {
  for (const file of htmlDocuments) {
    await page.goto(url(file));
    const hrefs = await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')));
    for (const href of hrefs.filter(href => href && href.endsWith('.html'))) {
      const target = new URL(href, `file://${path.join(root, file)}`).pathname;
      expect(fs.existsSync(decodeURIComponent(target))).toBe(true);
    }
  }
});

for (const file of documents) {
  test(`${file} opens without page errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url(file));
    await expect(page.locator('body')).toBeVisible();
    expect(errors).toEqual([]);
  });
}

for (const file of photoForms) {
  test(`${file} has labels, example, print DOM, clear, and acceptance block`, async ({ page }) => {
    await page.goto(url(file));
    const labels = await page.locator('label').evaluateAll(elements => elements.map(label => ({ for: label.htmlFor, exists: Boolean(document.getElementById(label.htmlFor)) })));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every(label => label.for && label.exists)).toBe(true);
    await page.getByRole('button', { name: 'Заполнить примером' }).click();
    await expect(page.locator('#doc')).toContainText('2026');
    await expect(page.locator('.accept-top')).toHaveCount(1);
    await expect(page.locator('.accept-bottom')).toHaveCount(2);
    await expect(page.locator('.accept-signature')).toHaveCount(1);
    await expect(page.locator('.accept-top')).toContainText('ПРИНЯТО');
    await expect(page.locator('.accept-top')).toContainText('(дата, время)');
    await expect(page.locator('.accept-top')).toContainText('М.П.');
    await expect(page.locator('.accept-bottom').first()).toContainText('Должность:');
    await expect(page.locator('.accept-bottom').first()).toContainText('(подпись)');
    await expect(page.locator('.accept-signature')).toContainText('(расшифровка)');
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
    const printText = await page.locator('#doc').innerText();
    expect(printText).not.toContain('2027-01-03');
    if (file === 'forms/complaint-paper-ballot.html') {
      expect(printText).not.toContain('часов');
    }
    await page.getByRole('button', { name: 'Очистить' }).click();
    const cleared = await page.evaluate(() => ({
      screen: [...document.querySelectorAll('input,textarea,select')].every(element => !element.value),
      printed: [...document.querySelectorAll('[data-print]')].every(element => !element.textContent),
    }));
    expect(cleared).toEqual({ screen: true, printed: true });
  });
}

test('notification has labels, print acceptance block, and clears all printed values', async ({ page }) => {
  await page.goto(url('uvedomlenie_form.html'));
  const labels = await page.locator('label').evaluateAll(elements => elements.map(label => ({ for: label.htmlFor, exists: Boolean(document.getElementById(label.htmlFor)) })));
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every(label => label.for && label.exists)).toBe(true);
  await page.getByRole('button', { name: 'Заполнить примером' }).click();
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Скачать PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
  await expect(page.locator('#doc')).toContainText('ПРИНЯТО');
  await page.getByRole('button', { name: 'Очистить' }).click();
  await expect(page.locator('#p_uik, #p_fio, #p_tech1, #p_tech2, #p_tech3')).toHaveText(['', '', '', '', '']);
});

test('photo forms preserve fixed phrases and date constraints', async ({ page }) => {
  const cases = {
    'forms/complaint-count.html': ['Такие действия направлены на сокрытие действительных итогов голосования, что дает основания полагать, что такие нарушения используются для сокрытия действительных итогов голосования.'],
    'forms/complaint-access.html': ['В Территориальную избирательную комиссию города Москвы', 'председатель, заместитель председателя, секретарь УИК', 'Прошу принять меры в рамках установленных законом полномочий, в том числе обеспечить мой допуск в помещение для голосования.'],
    'forms/complaint-paper-ballot.html': ['В нарушение пункта 15 статьи 64', 'решением Московской городской избирательной комиссии от 27.08.2026 № 147/4', 'решением Московской городской избирательной комиссии от 14.08.2026 № 145/3', 'Прошу принять меры по недопущению в дальнейшем подобных действий, привлечь к ответственности виновное лицо.'],
    'forms/complaint-movement.html': ['требование ограничить мои перемещения', 'пункт 9 статьи 30, пункт 11 статьи 61', 'Прошу незамедлительно устранить указанные нарушения.'],
    'forms/safepack-copy.html': ['пунктом 3.5', 'из переносного ящика для голосования', 'Прошу выдать копию непосредственно после запечатывания сейф-пакета и составления акта либо в течение времени, отведённого на подготовку копии, но до конца дня голосования.'],
  };
  for (const [file, phrases] of Object.entries(cases)) {
    await page.goto(url(file));
    await page.getByRole('button', { name: 'Заполнить примером' }).click();
    const text = await page.locator('#doc').innerText();
    for (const phrase of phrases) expect(text).toContain(phrase);
    const dates = await page.locator('input[type="date"]').evaluateAll(inputs => inputs.map(input => ({ min: input.min, max: input.max })));
    expect(dates.every(date => date.min === '2026-09-01' && date.max === '2026-09-30')).toBe(true);
    if (file === 'forms/safepack-copy.html') {
      expect(await page.locator('#packDate').count()).toBe(0);
      expect(text).not.toContain('Дата сейф-пакета');
      expect(text).not.toContain('2026-09-18');
    }
  }
});

test('access keeps the confirmed addressee and header without unconfirmed official fields', async ({ page }) => {
  await page.goto(url('forms/complaint-access.html'));
  await page.getByRole('button', { name: 'Заполнить примером' }).click();
  const text = await page.locator('#doc').innerText();
  expect(text).toContain('В Территориальную избирательную комиссию города Москвы');
  expect(text).toContain('От кандидата/доверенного лица кандидата/наблюдателя');
  for (const id of ['official', 'officialName']) expect(await page.locator(`#${id}`).count()).toBe(0);
});

test('empty required fields prevent printing', async ({ page }) => {
  let dialogMessage = '';
  page.on('dialog', async dialog => { dialogMessage = dialog.message(); await dialog.dismiss(); });
  await page.goto(url('forms/complaint-paper-ballot.html'));
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
  expect(dialogMessage).toContain('Заполните обязательное поле');
  expect(await page.evaluate(() => window.__printed)).not.toBe(true);
  await expect(page.locator('#applicant')).toBeFocused();
});

test('notification preserves source text, p_* values, print interception, and clear', async ({ page }) => {
  await page.goto(url('uvedomlenie_form.html'));
  const labels = await page.locator('label').evaluateAll(elements => elements.map(label => ({ for: label.htmlFor, exists: Boolean(document.getElementById(label.htmlFor)) })));
  expect(labels.every(label => label.for && label.exists)).toBe(true);
  await page.getByRole('button', { name: 'Заполнить примером' }).click();
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Скачать PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
  const expectedPrinted = {
    p_uik: '1234', p_fio: 'Иванов Иван Иванович',
    p_tech1: '1. Смартфон Samsung Galaxy S23', p_tech2: '2. Экшн-камера GoPro Hero 11', p_tech3: '3. Диктофон Zoom H1n'
  };
  for (const [id, text] of Object.entries(expectedPrinted)) await expect(page.locator(`#${id}`)).toHaveText(text);
  await expect(page.locator('#doc')).toContainText('От наблюдателя');
  await expect(page.locator('#doc')).toContainText('при необходимости будет производиться аудио-, фото- и видеосъемка');
  await expect(page.locator('#doc')).toContainText('на основании пп. «к» п. 9 ст. 30 ФЗ');
  for (const id of ['p_fio2', 'p_address', 'p_uchastok']) await expect(page.locator(`#${id}`)).toHaveCount(0);
  for (const phrase of ['Расшифровка подписи', '18, 19, 20 сентября']) await expect(page.locator('#doc')).not.toContainText(phrase);
  const beforeClear = await page.locator('[id^="p_"]').allTextContents();
  expect(beforeClear.some(Boolean)).toBe(true);
  await page.getByRole('button', { name: 'Очистить' }).click();
  for (const id of Object.keys(expectedPrinted)) await expect(page.locator(`#${id}`)).toHaveText('');
});

test('notification refuses more than three equipment lines', async ({ page }) => {
  let dialogMessage = '';
  page.on('dialog', async dialog => { dialogMessage = dialog.message(); await dialog.dismiss(); });
  await page.goto(url('uvedomlenie_form.html'));
  await page.locator('#tech').fill('one\ntwo\nthree\nfour');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Скачать PDF' }).click();
  expect(dialogMessage).toContain('не более 3 строк');
  expect(await page.evaluate(() => window.__printed)).not.toBe(true);
});

test('screen hides form documents and shows observer memo', async ({ page }) => {
  await page.goto(url(photoForms[0]));
  await expect(page.locator('#doc')).toBeHidden();
  await page.goto(url('forms/pamyatka-nablyudatelya.html'));
  await expect(page.locator('form, input, textarea, select')).toHaveCount(0);
  await expect(page.locator('#doc')).toBeVisible();
  const phrases = ['ПАМЯТКА НАБЛЮДАТЕЛЯ НА УЧАСТКОВОЙ ИЗБИРАТЕЛЬНОЙ КОМИССИИ (УИК)', 'До начала работы', 'Вы вправе', 'списком избирателей', 'переносную урну', 'подсчете голосов', 'заверенную копию', 'обжаловать действия комиссии', 'Чего делать нельзя', 'Открытие', 'В течение дня', 'Надомное голосование', 'пятницы и субботы', 'Подсчет голосов', 'Протокол', 'Если видите нарушение', 'жалобу в двух экземплярах', 'Главный принцип', 'вероятностью 99% приведет к удалению'];
  for (const phrase of phrases) await expect(page.locator('#doc')).toContainText(phrase);
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
});

test('catalog links to the static observer memo', async ({ page }) => {
  await page.goto(url('forms.html'));
  await page.locator('a[href="forms/pamyatka-nablyudatelya.html"]').click();
  await expect(page).toHaveURL(url('forms/pamyatka-nablyudatelya.html'));
  await expect(page.locator('#doc')).toBeVisible();
});
