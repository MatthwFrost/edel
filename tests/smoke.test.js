function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
}

describe('test infra', () => {
  test('jsdom gives us a document', () => {
    expect(typeof document).toBe('object');
    expect(document.body).toBeTruthy();
  });
  test('can create elements and query them', () => {
    mount('<p id="hi">hello</p>');
    expect(document.querySelector('#hi').textContent).toBe('hello');
  });
});
