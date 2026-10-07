import { beforeEach, describe, expect, it, vi } from 'vitest';

type Mod = typeof import('./tuTaiLaiKhiLoiChunk');

function taoCuaSo(storage?: Partial<Storage>) {
  const target = new EventTarget();
  const store = new Map<string, string>();
  const reload = vi.fn();
  const win = {
    addEventListener: target.addEventListener.bind(target),
    location: { reload },
    sessionStorage: storage ?? {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  } as unknown as Window;
  const phat = () => {
    const ev = new Event('vite:preloadError', { cancelable: true });
    target.dispatchEvent(ev);
    return ev;
  };
  return { win, reload, phat };
}

describe('dangKyTuTaiLaiKhiLoiChunk', () => {
  let mod: Mod;
  beforeEach(async () => {
    vi.resetModules();
    mod = await import('./tuTaiLaiKhiLoiChunk');
  });

  it('tai lai 1 lan va preventDefault khi loi chunk', () => {
    const { win, reload, phat } = taoCuaSo();
    mod.dangKyTuTaiLaiKhiLoiChunk(win, () => 1_000_000);
    const ev = phat();
    expect(ev.defaultPrevented).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('khong tai lai lan 2 trong 10 giay', () => {
    const { win, reload, phat } = taoCuaSo();
    let t = 1_000_000;
    mod.dangKyTuTaiLaiKhiLoiChunk(win, () => t);
    phat();
    t += 5_000;
    phat();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('tai lai lai sau hon 10 giay', () => {
    const { win, reload, phat } = taoCuaSo();
    let t = 1_000_000;
    mod.dangKyTuTaiLaiKhiLoiChunk(win, () => t);
    phat();
    t += 10_001;
    phat();
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('sessionStorage nem loi van tai lai dung 1 lan', () => {
    const hong = {
      getItem: () => { throw new Error('chan'); },
      setItem: () => { throw new Error('chan'); },
    };
    const { win, reload, phat } = taoCuaSo(hong);
    mod.dangKyTuTaiLaiKhiLoiChunk(win, () => 1);
    phat();
    phat();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
