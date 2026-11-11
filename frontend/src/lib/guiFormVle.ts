// Vào học VLE (external-login P.CNTT): VLE yêu cầu POST form-urlencoded từ CHÍNH trình duyệt học
// viên (phiên VLE là cookie host-only) — không điều hướng được bằng URL (field phải nằm trong BODY,
// không phải query string), nên phải tự dựng 1 <form> ẩn rồi submit (cùng tab, không mở tab mới).
export function guiFormVle(action: string, fields: Record<string, string>): void {
  const form = document.createElement('form');
  form.method = 'post';
  form.action = action;

  Object.entries(fields).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  form.remove();
}
