const KHOA = 'tuTaiLaiChunkLuc';
const KHOANG_CHAN_MS = 10_000;

let daTaiLaiTrongLanNay = false;

type CuaSoToiThieu = Pick<Window, 'addEventListener' | 'location' | 'sessionStorage'>;

// Sau deploy, chunk hash cu co the mat -> Vite phat 'vite:preloadError'; tai lai de lay index.html moi.
export function dangKyTuTaiLaiKhiLoiChunk(win: CuaSoToiThieu = window, now: () => number = Date.now): void {
  win.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    if (!nenTaiLai(win, now())) return;
    win.location.reload();
  });
}

function nenTaiLai(win: CuaSoToiThieu, hienTai: number): boolean {
  try {
    const lanTruoc = Number(win.sessionStorage.getItem(KHOA));
    if (lanTruoc && hienTai - lanTruoc < KHOANG_CHAN_MS) return false;
    win.sessionStorage.setItem(KHOA, String(hienTai));
    return true;
  } catch {
    // Storage khong dung duoc: chi cho tai lai 1 lan moi lan tai trang.
    if (daTaiLaiTrongLanNay) return false;
    daTaiLaiTrongLanNay = true;
    return true;
  }
}
