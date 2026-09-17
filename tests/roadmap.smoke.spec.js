const path = require('path');
const { test, expect } = require('@playwright/test');

const pages = ['vote_roadmap_2026_cards.html', 'vote_roadmap_2026_picker.html'];
const expectedIds = Array.from({ length: 169 }, (_, index) => `T1-E${String(index + 1).padStart(3, '0')}`);

for (const file of pages) {
  test.describe(file, () => {
    test('loads the model and UI without browser errors', async ({ page }) => {
      const errors = [];
      page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
      page.on('pageerror', error => errors.push(`page: ${error.message}`));
      await page.goto(`file://${path.join(__dirname, '..', file)}`);
      await expect(page.locator('#app')).toBeVisible();
      await expect(page.locator('#page-title')).toBeVisible();
      for (const selector of ['#query', '#clearBtn', '#helpBtn', '#exportBtn', '#eventPicker', '#eventDetail']) await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator('.picker-btn')).toHaveCount(39);
      await expect(page.locator('#resultCount')).toContainText('169');
      await expect(page.locator('#sliceCount')).toHaveText('169');
      await expect(page.locator('.notice')).toContainText('116 по расписанию / 38 вне расписания / 15 справочных.');
      await expect(page.locator('#drawer')).toHaveAttribute('aria-hidden', 'true');
      const model = await page.evaluate(() => ({
        expected: window.voteRoadmap.expected,
        invariant: window.voteRoadmap.invariant,
        eventIds: window.voteRoadmap.events.map(item => item.id),
        scheduleCounts: window.voteRoadmap.events.reduce((counts, item) => { counts[item.scheduleClass] += 1; return counts; }, {scheduled: 0, unscheduled: 0, reference: 0}),
        groupIds: window.voteRoadmap.groups.map(group => group.id),
        groupCoverage: window.voteRoadmap.groups.flatMap(group => group.sourceEventIds)
      }));
      expect(model.expected).toEqual({ groups: 39, events: 169, blocks: 5, glossary: 10, sections: 19 });
      expect(model.invariant.valid).toBe(true);
      expect(model.invariant.sourceIds).toBe(169);
      expect(model.invariant.uniqueSourceIds).toBe(169);
      expect(model.eventIds).toEqual(expectedIds);
      expect(model.scheduleCounts).toEqual({ scheduled: 116, unscheduled: 38, reference: 15 });
      expect(model.groupIds).toEqual(Array.from({ length: 39 }, (_, index) => `T1-G${String(index + 1).padStart(2, '0')}`));
      expect(model.groupCoverage).toEqual(expectedIds);
      expect(errors).toEqual([]);
    });

    test('hides every direct service child and preserves search and selection', async ({ page }) => {
      const errors = [];
      page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
      page.on('pageerror', error => errors.push(`page: ${error.message}`));
      await page.goto(`file://${path.join(__dirname, '..', file)}`);
      const visibleDirectChildren = await page.locator('body > *:not([id="app"]):not([id="drawer"])').evaluateAll(nodes => nodes.filter(node => getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').map(node => node.tagName.toLowerCase()));
      expect(visibleDirectChildren).toEqual([]);
      await expect(page.locator('body > header#title-block-header')).toBeHidden();
      await expect(page.locator('.picker-btn')).toHaveCount(39);
      await page.locator('#query').fill('сейф-пакет');
      await expect(page.locator('#resultCount')).toHaveText('В выборке: 16 из 169 исходных пунктов');
      await expect(page.locator('.picker-btn:visible')).toHaveCount(5);
      const matchingCard = page.locator('.picker-btn:visible', { hasText: 'Вскрытие переносных ящиков и сейф-пакетов' });
      await expect(matchingCard).toHaveCount(1);
      await matchingCard.click();
      await expect(page.locator('#eventDetail .action-card')).toBeVisible();
      await expect(page.locator('#eventDetail .action-card')).toContainText('Вскрытие переносных ящиков и сейф-пакетов');
      await expect(page.locator('#eventDetail .item-block').first()).toBeVisible();
      await page.locator('#clearBtn').click();
      await expect(page.locator('#resultCount')).toContainText('169');
      await expect(page.locator('.picker-btn')).toHaveCount(39);
      expect(errors).toEqual([]);
    });
  });
}
