import { gioiThieu } from './gioiThieu';

/** Dev-only: in danh sách khối còn tam:true hoặc chứa "[CHỜ" — không chặn build (dac-ta § M0 "Nghiệm thu"). */
export function baoCacKhoiTam(): void {
  const conTam: string[] = [];
  for (const [khoa, giaTri] of Object.entries(gioiThieu)) {
    if (giaTri && typeof giaTri === 'object' && 'tam' in giaTri && (giaTri as { tam?: boolean }).tam) {
      conTam.push(khoa);
    }
  }
  const conCho = JSON.stringify(gioiThieu).includes('[CHỜ');
  // eslint-disable-next-line no-console
  console.info('[gioiThieu] Khối còn nội dung tạm (tam: true):', conTam.length ? conTam : '(không có)');
  if (conCho) {
    // eslint-disable-next-line no-console
    console.info('[gioiThieu] Còn ít nhất 1 chuỗi "[CHỜ" cần đơn vị tổ chức bổ sung trước khi công bố chính thức.');
  }
}
