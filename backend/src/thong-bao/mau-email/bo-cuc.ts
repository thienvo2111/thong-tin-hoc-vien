// Khung HTML dùng chung cho MỌI email hệ thống gửi đi. Viết theo chuẩn email
// (bảng lồng nhau + style inline, rộng 600px, không CSS ngoài/không web font
// bắt buộc) vì Gmail/Outlook bỏ <style> và flexbox. Màu theo nhận diện HCMUE
// (design/redesign-spec.md): navy #124874, đỏ #CF373D.
//
// MỌI dữ liệu động đưa vào email PHẢI qua e() — họ tên/tên lớp/địa điểm đến từ
// import Excel hoặc học viên tự nhập, không escape thì 1 dấu "<" là vỡ layout.

export const MAU = {
  navy: '#124874',
  navyDam: '#0F2942',
  do: '#CF373D',
  xanhLa: '#12805C',
  nenXanhLa: '#E7F5EF',
  cam: '#B54708',
  nenCam: '#FEF3E6',
  nenDo: '#FDEEEC',
  nen: '#F5F7FA',
  vien: '#E4E7EC',
  chu: '#1D2939',
  chuPhu: '#667085',
} as const;

const FONT =
  "'Be Vietnam Pro', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export const LIEN_HE = {
  website: 'https://boiduongnls.hcmue.edu.vn',
  websiteHienThi: 'boiduongnls.hcmue.edu.vn',
  email: 'boiduongnls@hcmue.edu.vn',
} as const;

export function e(giaTri: unknown): string {
  return String(giaTri ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Chỉ cho http(s) vào href — chặn javascript:/data: lọt từ dữ liệu import
// (dia_diem_hoac_link là chuỗi tự do).
export function laLienKet(giaTri: string | null | undefined): boolean {
  return !!giaTri && /^https?:\/\//i.test(giaTri.trim());
}

export function doanVan(html: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${MAU.chu};">${html}</p>`;
}

export function chuNho(html: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:20px;color:${MAU.chuPhu};">${html}</p>`;
}

export function tieuDeMuc(text: string): string {
  return `<h2 style="margin:24px 0 12px;font-size:16px;line-height:24px;font-weight:700;color:${MAU.navy};">${e(text)}</h2>`;
}

// Nút "bulletproof": <a> nằm trong ô bảng có bgcolor — Outlook không hiểu
// padding trên <a> nhưng vẫn tô màu ô.
export function nutBam(nhan: string, url: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
  <tr>
    <td bgcolor="${MAU.do}" style="border-radius:8px;">
      <a href="${e(url)}" target="_blank" style="display:inline-block;padding:12px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${e(nhan)}</a>
    </td>
  </tr>
</table>`;
}

// Bảng 2 cột nhãn/giá trị. giaTri là HTML ĐÃ escape (cho phép <b>, badge).
export function bangThongTin(dong: Array<[string, string]>): string {
  const rows = dong
    .map(
      ([nhan, giaTri], i) => `
  <tr>
    <td style="padding:10px 12px;width:38%;font-size:14px;line-height:20px;color:${MAU.chuPhu};vertical-align:top;${i ? `border-top:1px solid ${MAU.vien};` : ''}">${e(nhan)}</td>
    <td style="padding:10px 12px;font-size:14px;line-height:20px;color:${MAU.chu};font-weight:600;vertical-align:top;${i ? `border-top:1px solid ${MAU.vien};` : ''}">${giaTri}</td>
  </tr>`,
    )
    .join('');
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border:1px solid ${MAU.vien};border-radius:8px;border-collapse:separate;">${rows}
</table>`;
}

export type KieuKhoi = 'thong_tin' | 'canh_bao' | 'thanh_cong' | 'loi';

const KIEU_KHOI: Record<KieuKhoi, { vien: string; nen: string }> = {
  thong_tin: { vien: MAU.navy, nen: '#EEF4FA' },
  canh_bao: { vien: MAU.cam, nen: MAU.nenCam },
  thanh_cong: { vien: MAU.xanhLa, nen: MAU.nenXanhLa },
  loi: { vien: MAU.do, nen: MAU.nenDo },
};

export function khoiNoiBat(kieu: KieuKhoi, html: string): string {
  const k = KIEU_KHOI[kieu];
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
  <tr>
    <td bgcolor="${k.nen}" style="padding:14px 16px;border-left:4px solid ${k.vien};border-radius:6px;font-size:14px;line-height:22px;color:${MAU.chu};">${html}</td>
  </tr>
</table>`;
}

export function huyHieu(text: string, kieu: KieuKhoi): string {
  const mau: Record<KieuKhoi, [string, string]> = {
    thong_tin: [MAU.navy, '#EEF4FA'],
    canh_bao: [MAU.cam, MAU.nenCam],
    thanh_cong: [MAU.xanhLa, MAU.nenXanhLa],
    loi: [MAU.do, MAU.nenDo],
  };
  const [chu, nen] = mau[kieu];
  return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;background:${nen};color:${chu};font-size:13px;font-weight:700;">${e(text)}</span>`;
}

export function boCucEmail(params: {
  // Dòng xem trước ẩn — Gmail/Outlook hiện ngay sau tiêu đề trong hộp thư.
  xemTruoc: string;
  // Dòng nhãn nhỏ trên tiêu đề, vd. "BẢO MẬT TÀI KHOẢN".
  nhan: string;
  tieuDe: string;
  noiDung: string;
}): string {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${e(params.tieuDe)}</title>
</head>
<body style="margin:0;padding:0;background:${MAU.nen};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(params.xemTruoc)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${MAU.nen}">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;font-family:${FONT};">
        <tr>
          <td bgcolor="${MAU.navy}" style="padding:20px 32px;border-radius:12px 12px 0 0;border-bottom:4px solid ${MAU.do};">
            <div style="font-size:12px;line-height:18px;letter-spacing:1px;font-weight:600;color:#C9D8E8;">TRƯỜNG ĐẠI HỌC SƯ PHẠM THÀNH PHỐ HỒ CHÍ MINH</div>
            <div style="margin-top:2px;font-size:18px;line-height:26px;font-weight:800;color:#ffffff;">Bồi dưỡng Năng lực số</div>
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="padding:32px 32px 16px;border-left:1px solid ${MAU.vien};border-right:1px solid ${MAU.vien};">
            <div style="margin:0 0 6px;font-size:12px;line-height:18px;letter-spacing:1px;font-weight:700;color:${MAU.do};">${e(params.nhan)}</div>
            <h1 style="margin:0 0 20px;font-size:22px;line-height:30px;font-weight:800;color:${MAU.navyDam};">${e(params.tieuDe)}</h1>
            ${params.noiDung}
          </td>
        </tr>
        <tr>
          <td bgcolor="#ffffff" style="padding:0 32px 28px;border-left:1px solid ${MAU.vien};border-right:1px solid ${MAU.vien};border-bottom:1px solid ${MAU.vien};border-radius:0 0 12px 12px;">
            <p style="margin:0;padding-top:16px;border-top:1px solid ${MAU.vien};font-size:14px;line-height:22px;color:${MAU.chu};">Trân trọng,<br><b>Ban Tổ chức chương trình Bồi dưỡng Năng lực số</b><br>Trường Đại học Sư phạm Thành phố Hồ Chí Minh</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 16px 8px;font-size:12px;line-height:20px;color:${MAU.chuPhu};">
            Cần hỗ trợ? Liên hệ <a href="mailto:${LIEN_HE.email}" style="color:${MAU.navy};font-weight:600;text-decoration:none;">${LIEN_HE.email}</a><br>
            Cổng thông tin: <a href="${LIEN_HE.website}" style="color:${MAU.navy};font-weight:600;text-decoration:none;">${LIEN_HE.websiteHienThi}</a><br>
            Đây là email tự động từ hệ thống, vui lòng không trả lời trực tiếp email này.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}
