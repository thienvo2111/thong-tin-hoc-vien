import { afterEach, describe, expect, it, vi } from 'vitest';
import { guiFormVle } from './guiFormVle';

describe('guiFormVle', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('dựng form POST đúng action + hidden input theo fields (giá trị gán qua DOM property), submit cùng tab rồi dọn khỏi DOM', () => {
    let formKhiSubmit: HTMLFormElement | undefined;
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(function (
      this: HTMLFormElement,
    ) {
      formKhiSubmit = this;
    });

    guiFormVle('https://vlebdhvs.hcmue.edu.vn/users/external-login', {
      key: 'khoa-bi-mat',
      email: '',
      username: 'nguyenvana',
      id_course: '13',
    });

    expect(submitSpy).toHaveBeenCalledTimes(1);
    expect(formKhiSubmit?.method).toBe('post');
    expect(formKhiSubmit?.action).toBe('https://vlebdhvs.hcmue.edu.vn/users/external-login');
    // không set target -> mặc định cùng tab (không mở tab mới).
    expect(formKhiSubmit?.target).toBe('');

    const inputs = Array.from(formKhiSubmit?.querySelectorAll('input') ?? []) as HTMLInputElement[];
    const values = Object.fromEntries(inputs.map((i) => [i.name, i.value]));
    expect(values).toEqual({ key: 'khoa-bi-mat', email: '', username: 'nguyenvana', id_course: '13' });
    expect(inputs.every((i) => i.type === 'hidden')).toBe(true);

    // Đã remove() khỏi DOM sau khi submit.
    expect(formKhiSubmit?.isConnected).toBe(false);
  });

  it('không có field nào -> vẫn submit được form rỗng (không input)', () => {
    const submitSpy = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});
    guiFormVle('https://vle.example.com/login', {});
    expect(submitSpy).toHaveBeenCalledTimes(1);
  });
});
