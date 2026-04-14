import { getTextFromElementOnward, findScopeRoot } from '../scripts/core/textExtractor.js';

function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
}

describe('findScopeRoot', () => {
  test('returns nearest content-heavy ancestor', () => {
    mount(`
      <nav>Home | About</nav>
      <main>
        <article>
          <p>${'Lorem ipsum dolor sit amet. '.repeat(30)}</p>
          <p>${'Another paragraph of substantial text. '.repeat(30)}</p>
        </article>
      </main>
      <footer>Copyright 2026</footer>
    `);
    const start = document.querySelector('article p');
    expect(findScopeRoot(start)).toBe(document.querySelector('article'));
  });

  test('falls back to body when no ancestor meets criteria', () => {
    mount('<p>short</p>');
    expect(findScopeRoot(document.querySelector('p'))).toBe(document.body);
  });
});

describe('getTextFromElementOnward', () => {
  test('collects readable blocks from scope root onward', () => {
    mount(`
      <article>
        <p>First paragraph here.</p>
        <p>Second paragraph here.</p>
        <p>Third paragraph here.</p>
      </article>
    `);
    const start = document.querySelectorAll('article p')[0];
    const result = getTextFromElementOnward(start);
    expect(result.sentences.length).toBeGreaterThanOrEqual(3);
    expect(result.sentences[0]).toMatch(/First paragraph/);
    expect(result.sentences.some(s => /Second paragraph/.test(s))).toBe(true);
    expect(result.sentences.some(s => /Third paragraph/.test(s))).toBe(true);
  });

  test('skips aside and role=navigation', () => {
    mount(`
      <article>
        <p>Real content one.</p>
        <aside><p>Ad content here.</p></aside>
        <nav role="navigation"><p>Nav link.</p></nav>
        <p>Real content two.</p>
      </article>
    `);
    const start = document.querySelector('article p');
    const joined = getTextFromElementOnward(start).sentences.join(' ');
    expect(joined).toMatch(/Real content one/);
    expect(joined).toMatch(/Real content two/);
    expect(joined).not.toMatch(/Ad content/);
    expect(joined).not.toMatch(/Nav link/);
  });

  test('skips aria-hidden=true elements', () => {
    mount(`
      <article>
        <p>Visible.</p>
        <div aria-hidden="true"><p>Hidden from AT.</p></div>
        <p>Also visible.</p>
      </article>
    `);
    const start = document.querySelector('article p');
    const joined = getTextFromElementOnward(start).sentences.join(' ');
    expect(joined).toMatch(/Visible/);
    expect(joined).toMatch(/Also visible/);
    expect(joined).not.toMatch(/Hidden from AT/);
  });

  test('clips at 30,000 characters', () => {
    const para = '<p>' + 'x'.repeat(1000) + '.</p>';
    mount('<article>' + para.repeat(100) + '</article>');
    const start = document.querySelector('article p');
    const result = getTextFromElementOnward(start);
    const total = result.sentences.join('').length;
    expect(total).toBeLessThanOrEqual(30000);
  });

  test('collects text from open shadow roots within scope', () => {
    mount('<article><p>outside paragraph.</p><div id="host"></div></article>');
    const host = document.getElementById('host');
    const shadow = host.attachShadow({ mode: 'open' });
    const p = document.createElement('p');
    p.textContent = 'inside shadow root.';
    shadow.appendChild(p);
    const start = document.querySelector('article p');
    const joined = getTextFromElementOnward(start).sentences.join(' ');
    expect(joined).toMatch(/outside paragraph/);
    expect(joined).toMatch(/inside shadow root/);
  });
});
