import { SanitizeBodyPipe } from '../../../src/common/pipes/sanitize-body.pipe';

describe('SanitizeBodyPipe', () => {
  const pipe = new SanitizeBodyPipe();

  it('strips HTML from body strings, recursively', () => {
    const out: any = pipe.transform(
      { name: '<b>Ajith</b><script>x()</script>', nested: { note: '<img src=x onerror=1>hi' }, list: ['<i>a</i>'] },
      { type: 'body' },
    );
    expect(out).toEqual({ name: 'Ajith', nested: { note: 'hi' }, list: ['a'] });
  });

  it('sanitises query and route params too', () => {
    expect(pipe.transform({ q: '<a>x</a>' }, { type: 'query' })).toEqual({ q: 'x' });
    expect(pipe.transform('<p>id</p>', { type: 'param' })).toBe('id');
  });

  it('leaves multer file objects (custom params) untouched — regression for avatar upload 500', () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const file = { originalname: 'profile.jpg', mimetype: 'image/jpeg', size: 4, buffer };
    const out: any = pipe.transform(file, { type: 'custom' });
    expect(out).toBe(file);
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect(out.buffer.length).toBe(4);
  });

  it('preserves Buffers, typed arrays and Dates even inside a body', () => {
    const buffer = Buffer.from('abc');
    const bytes = new Uint8Array([1, 2, 3]);
    const when = new Date('2026-09-15T00:00:00Z');
    const out: any = pipe.transform({ buffer, bytes, when, label: '<u>x</u>' }, { type: 'body' });
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect(out.buffer.length).toBe(3);
    expect(out.bytes).toBe(bytes);
    expect(out.when).toBe(when);
    expect(out.label).toBe('x');
  });

  it('passes primitives and null through', () => {
    expect(pipe.transform(42, { type: 'body' })).toBe(42);
    expect(pipe.transform(null, { type: 'body' })).toBeNull();
    expect(pipe.transform(undefined, { type: 'custom' })).toBeUndefined();
  });
});
