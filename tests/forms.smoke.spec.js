const path = require('path');
const fs = require('fs');
const { test, expect } = require('@playwright/test');

const root = path.join(__dirname, '..');
const photoForms = [
  'forms/complaint-count.html',
  'forms/complaint-access.html',
  'forms/complaint-refusal.html',
  'forms/complaint-paper-ballot.html',
  'forms/complaint-movement.html',
  'forms/complaint-transport.html',
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

test('profile saves, restores, applies only to profile fields, and can be removed', async ({ page }) => {
  await page.goto(url('forms.html'));
  await page.locator('#profile-full-name').fill('Тестовый Пользователь');
  await page.locator('#profile-uik').fill('4321');
  await page.getByRole('button', { name: 'Сохранить данные' }).click();
  await expect(page.getByRole('status')).toContainText('30 дней');
  await expect.poll(() => page.evaluate(() => document.cookie)).toContain('vote_profile_v1');
  await page.reload();
  await expect(page.locator('#profile-full-name')).toHaveValue('Тестовый Пользователь');
  await expect(page.locator('#profile-uik')).toHaveValue('4321');

  await page.goto(url('forms/complaint-count.html'));
  await expect(page.locator('#applicant')).toHaveAttribute('data-profile-field', 'fullName');
  await expect(page.locator('#uik')).toHaveAttribute('data-profile-field', 'uik');
  await expect(page.locator('#applicant')).toHaveValue('Тестовый Пользователь');
  await expect(page.locator('#uik')).toHaveValue('4321');
  await page.goto(url('forms/complaint-movement.html'));
  await expect(page.locator('#observer')).toHaveValue('Тестовый Пользователь');
  await expect(page.locator('#uik')).toHaveValue('4321');
  await page.goto(url('uvedomlenie_form.html'));
  await expect(page.locator('#fio')).toHaveAttribute('data-profile-field', 'fullName');
  await expect(page.locator('#uik')).toHaveAttribute('data-profile-field', 'uik');
  await expect(page.locator('#fio')).toHaveValue('Тестовый Пользователь');
  await expect(page.locator('#uik')).toHaveValue('4321');

  await page.goto(url('forms/complaint-paper-ballot.html'));
  await expect(page.locator('#memberName')).toHaveValue('');
  await expect(page.locator('#voterName')).toHaveValue('');
  await page.locator('#memberName').fill('Введено вручную');
  await page.reload();
  await expect(page.locator('#memberName')).toHaveValue('');

  await page.goto(url('forms.html'));
  await page.getByRole('button', { name: 'Удалить сохранённые данные' }).click();
  await expect(page.getByRole('status')).toContainText('удалены');
  await expect.poll(() => page.evaluate(() => document.cookie)).not.toContain('vote_profile_v1');
});

test('profile apply does not overwrite manually entered profile fields', async ({ page }) => {
  await page.goto(url('forms.html'));
  await page.locator('#profile-full-name').fill('Сохранённое имя');
  await page.locator('#profile-uik').fill('4321');
  await page.getByRole('button', { name: 'Сохранить данные' }).click();
  await page.goto(url('forms/safepack-copy.html'));
  await page.locator('#applicant').fill('Введённое имя');
  await page.locator('#uik').fill('9876');
  await page.evaluate(() => window.VoteProfile.apply());
  await expect(page.locator('#applicant')).toHaveValue('Введённое имя');
  await expect(page.locator('#uik')).toHaveValue('9876');
});

test('invalid profile cookie is ignored without a page error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url('forms.html'));
  await page.evaluate(() => { document.cookie = 'vote_profile_v1=%7Bbroken; Path=/'; });
  await page.reload();
  expect(errors).toEqual([]);
  await expect(page.locator('#profile-full-name')).toHaveValue('');
  await expect(page.locator('#profile-uik')).toHaveValue('');
});

test('ordinary forms default document date to election day and keep event date empty', async ({ page }) => {
  await page.goto(url('forms/complaint-count.html'));
  await expect(page.locator('#date')).toHaveValue('2026-09-20');
  await expect(page.locator('#eventDate')).toHaveValue('2026-09-20');

  await page.goto(url('forms/complaint-refusal.html'));
  await expect(page.locator('#date')).toHaveValue('2026-09-20');
  await expect(page.locator('#eventDate')).toHaveValue('2026-09-20');

  await page.goto(url('forms/safepack-copy.html'));
  await expect(page.locator('#date')).toHaveValue('2026-09-20');
  await expect(page.locator('#actDate')).toHaveValue('');
  await expect(page.locator('body')).toHaveAttribute('data-print-required', 'uik,applicant,date');
  for (const id of ['boxType', 'actDate', 'serial']) await expect(page.locator(`#${id}`)).not.toHaveAttribute('required', '');
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
  await expect(page.locator('#p_uik, #p_fio, #p_tech1, #p_tech2, #p_tech3, #p_date')).toHaveText(['', '', '', '', '', '']);
});

test('photo forms preserve fixed phrases and date constraints', async ({ page }) => {
  const cases = {
    'forms/complaint-count.html': ['Такие действия направлены на сокрытие действительных итогов голосования, что дает основания полагать, что такие нарушения используются для сокрытия действительных итогов голосования.'],
    'forms/complaint-access.html': ['В Территориальную избирательную комиссию города Москвы', 'председатель, заместитель председателя, секретарь УИК', 'Прошу принять меры в рамках установленных законом полномочий, в том числе обеспечить мой допуск в помещение для голосования.'],
    'forms/complaint-paper-ballot.html': ['В нарушение пункта 15 статьи 64', 'решением Московской городской избирательной комиссии от 27.08.2026 № 147/4', 'решением Московской городской избирательной комиссии от 14.08.2026 № 145/3', 'Прошу принять меры по недопущению в дальнейшем подобных действий, привлечь к ответственности виновное лицо.'],
    'forms/complaint-movement.html': ['требование ограничить мои перемещения', 'пункт 9 статьи 30, пункт 11 статьи 61', 'Прошу незамедлительно устранить указанные нарушения.'],
    'forms/complaint-refusal.html': ['подп. «к» пункта 6 статьи 27', 'был заявлен отказ рассмотреть жалобу', 'принять мотивированное решение по существу вопроса'],
    'forms/complaint-transport.html': ['организованного подвоза более 100 избирателей', 'принцип свободного и добровольного участия', 'организовавших подвох', 'выдать мне заверенную копию решения'],
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

test('new complaint forms print fields and clear their values', async ({ page }) => {
  const cases = {
    'forms/complaint-refusal.html': {
      fields: ['applicant', 'uik', 'date'],
      optionalFields: ['eventDate', 'eventTime', 'memberName'],
      printed: { applicant: 'Сидорова Анна Сергеевна', uik: '1234', eventDate: '18.09.2026', eventTime: '12:10', memberName: 'Иванов И. И.', date: '18.09.2026' },
    },
    'forms/complaint-transport.html': {
      fields: ['observer', 'date', 'transportUik'],
      optionalFields: ['transportEventDate', 'transportEventTime'],
      printed: { observer: 'Орлова Мария Игоревна', date: '18.09.2026' },
    },
  };

  for (const [file, expected] of Object.entries(cases)) {
    await page.goto(url(file));
    for (const id of expected.optionalFields || []) await expect(page.locator(`#${id}`)).not.toHaveAttribute('required', '');
    await page.getByRole('button', { name: 'Заполнить примером' }).click();
    for (const [id, value] of Object.entries(expected.printed)) await expect(page.locator(`[data-print="${id}"]`)).toHaveText(value);
    if (file === 'forms/complaint-transport.html') await expect(page.locator('#doc')).toContainText('18.09.2026');
    await page.getByRole('button', { name: 'Очистить' }).click();
    for (const id of [...expected.fields, ...(expected.optionalFields || [])]) await expect(page.locator(`#${id}`)).toHaveValue('');
    for (const id of Object.keys(expected.printed)) await expect(page.locator(`[data-print="${id}"]`)).toHaveText('');
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

test('all forms print with empty fields', async ({ page }) => {
  for (const file of photoForms) {
    await page.goto(url(file));
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
    await expect(page.locator('#doc')).not.toContainText('Invalid Date');
  }
});

test('safepack prints with only document date', async ({ page }) => {
  await page.goto(url('forms/safepack-copy.html'));
  await page.locator('#uik').fill('1234');
  await page.locator('#applicant').fill('Тестовый заявитель');
  await page.locator('#date').fill('2026-09-20');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
  await expect(page.locator('[data-print="boxType"]').locator('..')).toBeHidden();
  await expect(page.locator('[data-print="serial"]').locator('..')).toBeHidden();
  await expect(page.locator('[data-print="date"]')).toHaveText('20.09.2026');
});

test('refusal prints with only applicant, polling station, and document date', async ({ page }) => {
  await page.goto(url('forms/complaint-refusal.html'));
  await page.locator('#uik').fill('1234');
  await page.locator('#applicant').fill('Сидорова Анна Сергеевна');
  await page.locator('#date').fill('2026-09-20');
  await page.locator('#eventDate').fill('');
  await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
  await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
  await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
  await expect(page.locator('[data-event-time-prefix]')).toBeHidden();
  await expect(page.locator('[data-print="eventDate"]')).toHaveText('');
  await expect(page.locator('[data-print="eventTime"]')).toHaveText('');
  await expect(page.locator('[data-print="memberName"]')).toHaveText('');
});

test('all complaint forms print with only polling station, applicant, and document date', async ({ page }) => {
  const cases = {
    'forms/complaint-access.html': ['applicant', 'uik', 'date'],
    'forms/complaint-count.html': ['uik', 'applicant', 'date'],
    'forms/complaint-movement.html': ['uik', 'observer', 'date'],
    'forms/complaint-paper-ballot.html': ['applicant', 'uik', 'date'],
    'forms/complaint-refusal.html': ['uik', 'applicant', 'date'],
    'forms/complaint-transport.html': ['observer', 'date', 'transportUik'],
  };

  for (const [file, requiredFields] of Object.entries(cases)) {
    await page.goto(url(file));
    const required = await page.locator('body').getAttribute('data-print-required');
    expect(required.split(',')).toEqual(requiredFields);
    for (const input of await page.locator('input, textarea, select').all()) await input.fill('');
    for (const id of requiredFields) await page.locator(`#${id}`).fill(id === 'date' ? '2026-09-20' : `Тест ${id}`);
    await page.evaluate(() => { window.print = () => { window.__printed = true; }; });
    await page.getByRole('button', { name: 'Печать / сохранить PDF' }).click();
    await expect.poll(() => page.evaluate(() => window.__printed)).toBe(true);
    if (await page.locator('[data-print="eventTime"]').count()) await expect(page.locator('[data-print="eventTime"]')).toHaveText('');
    if (file !== 'forms/complaint-transport.html') await expect(page.locator('[data-print="eventDate"]')).toHaveText('');
  }
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
    p_uik: '1234', p_fio: 'Иванов Иван Иванович', p_date: '20.09.2026',
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
  await page.locator('#uik').fill('1234');
  await page.locator('#fio').fill('Иванов Иван Иванович');
  await page.locator('#date').fill('2026-09-20');
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
