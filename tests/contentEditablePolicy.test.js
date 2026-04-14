import { isComposerElement } from '../scripts/core/inputHandler.js';

function mount(html) {
  document.body.replaceChildren();
  const range = document.createRange();
  range.selectNode(document.body);
  document.body.appendChild(range.createContextualFragment(html));
  return document.body.firstElementChild;
}

describe('isComposerElement', () => {
  test('rejects <textarea>', () => {
    expect(isComposerElement(mount('<textarea>hi</textarea>'))).toBe(true);
  });
  test('rejects <input type=text>', () => {
    expect(isComposerElement(mount('<input type="text" value="hi">'))).toBe(true);
  });
  test('rejects <input type=search>', () => {
    expect(isComposerElement(mount('<input type="search" value="hi">'))).toBe(true);
  });
  test('rejects elements with data-testid=chat-input-textbox', () => {
    expect(isComposerElement(mount('<div data-testid="chat-input-textbox" contenteditable="true">hi</div>'))).toBe(true);
  });
  test('accepts plain contenteditable for displayed content', () => {
    expect(isComposerElement(mount('<div contenteditable="true" class="notion-page">displayed page</div>'))).toBe(false);
  });
  test('accepts a <p> with no contenteditable', () => {
    expect(isComposerElement(mount('<p>regular paragraph</p>'))).toBe(false);
  });
  test('rejects elements inside a known composer ancestor', () => {
    mount('<div data-testid="chat-input-textbox"><span>inner</span></div>');
    expect(isComposerElement(document.querySelector('span'))).toBe(true);
  });
});
