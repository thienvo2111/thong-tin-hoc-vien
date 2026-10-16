import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { db } from "@/test/mocks/db";
import { renderVoiRouter } from "@/test/testUtils";
import { datToken } from "@/auth/tokenStore";
import type {
  BuoiTomTat,
  DeNghiHocVien,
  LichTomTat,
  LuaChonBuoi,
  TongQuanDoiBuoi,
} from "@/api/doiBuoi";
import DeNghiDoiBuoi from "./DeNghiDoiBuoi";

const GIO = 3600_000;

function lich(id: string, ten: string, buoi = 1, gio = 48): LichTomTat {
  return {
    id,
    lop_id: `lop-${id}`,
    giai_doan_id: "gd-2",
    buoi_so: buoi,
    thoi_gian_bat_dau: new Date(Date.now() + gio * GIO).toISOString(),
    lop: {
      khoa_id: "khoa-1",
      loai_lop: "truc_tiep",
      muc_nang_luc: "co_ban",
      trang_thai: "active",
      si_so_toi_da: 30,
      ten_lop: ten,
    },
  };
}

function tomTat(l: LichTomTat, ketThucSauGio = 3): BuoiTomTat {
  return {
    id: l.id,
    buoi_so: l.buoi_so,
    thoi_gian_bat_dau: l.thoi_gian_bat_dau,
    thoi_gian_ket_thuc: new Date(
      Date.parse(l.thoi_gian_bat_dau) + ketThucSauGio * GIO,
    ).toISOString(),
    lop: { ten_lop: l.lop.ten_lop },
  };
}

function deNghiMau(over: Partial<DeNghiHocVien> = {}): DeNghiHocVien {
  return {
    id: "dn-1",
    trang_thai: "cho_duyet",
    lich_nguon_id: "ln-1",
    lich_de_nghi_id: "ld-1",
    lich_chot_id: null,
    ly_do: "Bận công tác đột xuất",
    tao_luc: new Date().toISOString(),
    ghi_chu_xu_ly: null,
    qua_han: false,
    thu_tu_hang: null,
    buoi_nguon: tomTat(lich("ln-1", "Lớp 01")),
    buoi_de_nghi: tomTat(lich("ld-1", "Lớp 02", 1, 50)),
    buoi_chot: null,
    ...over,
  };
}

function tongQuanMau(over: Partial<TongQuanDoiBuoi> = {}): TongQuanDoiBuoi {
  return {
    so_buoi_doi_toi_da: 2,
    so_luot_da_dung: 1,
    buoi_sap_toi: [{ lich_nguon: lich("ln-1", "Lớp 01"), de_nghi: null }],
    de_nghi: [],
    ...over,
  };
}

const LUA_CHON: LuaChonBuoi[] = [
  {
    lich: lich("ld-1", "Lớp 02", 1, 50),
    thoi_gian_ket_thuc: new Date(Date.now() + 53 * GIO).toISOString(),
    diem_hoc: { ten: "THPT Long Xuyên", dia_chi: "1 Trần Hưng Đạo" },
    phong: "P201",
    dia_diem_hoac_link: null,
    si_so: 28,
    si_so_toi_da: 30,
    so_cho_duyet: 2,
    da_du: false,
  },
  {
    lich: lich("ld-2", "Lớp 03", 1, 52),
    thoi_gian_ket_thuc: new Date(Date.now() + 55 * GIO).toISOString(),
    diem_hoc: null,
    phong: null,
    dia_diem_hoac_link: null,
    si_so: 30,
    si_so_toi_da: 30,
    so_cho_duyet: 0,
    da_du: true,
  },
];

function datApi(tq: TongQuanDoiBuoi | "403") {
  server.use(
    http.get("/hoc-vien/toi/doi-buoi", () =>
      tq === "403"
        ? HttpResponse.json(
            {
              error: {
                code: "FORBIDDEN",
                message: "Khóa học chưa mở đề nghị đổi buổi",
              },
            },
            { status: 403 },
          )
        : HttpResponse.json(tq),
    ),
    http.get("/hoc-vien/toi/doi-buoi/lua-chon/:id", () =>
      HttpResponse.json(LUA_CHON),
    ),
  );
}

function renderTrang(query = "?khoa=khoa-1&lich=ln-1") {
  datToken("token-gia-lap");
  return renderVoiRouter(
    [{ path: "/de-nghi-doi-buoi", element: <DeNghiDoiBuoi /> }],
    { initialEntries: [`/de-nghi-doi-buoi${query}`] },
  );
}

describe("Trang đề nghị đổi buổi (học viên)", () => {
  it("hiện lượt còn lại, sĩ số, +n đang chờ; buổi đã đủ bị vô hiệu và có chữ Đã đủ", async () => {
    datApi(tongQuanMau());
    renderTrang();
    expect(await screen.findByText("Còn 1/2 lượt đổi")).toBeInTheDocument();
    expect(await screen.findByText("28/30")).toBeInTheDocument();
    expect(screen.getByText("+2 đang chờ")).toBeInTheDocument();
    expect(screen.getByText("Đã đủ")).toBeInTheDocument();
    const dau = screen.getByRole("radio", { name: /Lớp 03/ });
    expect(dau).toBeDisabled();
    expect(dau).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("radio", { name: /Lớp 02/ })).toBeEnabled();
  });

  it("gửi đề nghị: nút khóa tới khi chọn buổi + lý do ≥ 5 ký tự, rồi POST đúng body", async () => {
    datApi(tongQuanMau());
    const bodies: unknown[] = [];
    server.use(
      http.post("/hoc-vien/toi/doi-buoi", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: "dn-moi" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    const gui = await screen.findByRole("button", { name: "Gửi đề nghị" });
    expect(gui).toBeDisabled();
    await user.click(await screen.findByRole("radio", { name: /Lớp 02/ }));
    await user.type(screen.getByLabelText(/Lý do/), "abc");
    expect(gui).toBeDisabled();
    await user.type(screen.getByLabelText(/Lý do/), "de");
    expect(screen.getByText(/5\/500/)).toBeInTheDocument();
    await user.click(gui);
    await waitFor(() =>
      expect(bodies).toEqual([
        { lich_nguon_id: "ln-1", lich_de_nghi_id: "ld-1", ly_do: "abcde" },
      ]),
    );
  });

  it("lỗi 409 từ máy chủ hiện đúng thông điệp", async () => {
    datApi(tongQuanMau());
    server.use(
      http.post("/hoc-vien/toi/doi-buoi", () =>
        HttpResponse.json(
          { error: { code: "CONFLICT", message: "Buổi này đã có đề nghị" } },
          { status: 409 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderTrang();
    await user.click(await screen.findByRole("radio", { name: /Lớp 02/ }));
    await user.type(screen.getByLabelText(/Lý do/), "Bận việc gia đình");
    await user.click(screen.getByRole("button", { name: "Gửi đề nghị" }));
    expect(
      await screen.findByText("Buổi này đã có đề nghị"),
    ).toBeInTheDocument();
  });

  it("đề nghị đang chờ: hiện thứ tự hàng; bấm Sửa hiện cảnh báo về cuối hàng chờ", async () => {
    datApi(
      tongQuanMau({
        buoi_sap_toi: [
          {
            lich_nguon: lich("ln-1", "Lớp 01"),
            de_nghi: deNghiMau({ thu_tu_hang: { k: 2, n: 3 } }),
          },
        ],
        de_nghi: [deNghiMau({ thu_tu_hang: { k: 2, n: 3 } })],
      }),
    );
    const user = userEvent.setup();
    renderTrang("?khoa=khoa-1");
    expect(await screen.findByText("Bạn đang xếp thứ 2")).toBeInTheDocument();
    expect(
      screen.queryByText("Sửa sẽ đưa bạn về cuối hàng chờ"),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sửa" }));
    expect(
      await screen.findByText("Sửa sẽ đưa bạn về cuối hàng chờ"),
    ).toBeInTheDocument();
  });

  it("lựa chọn hiện giờ kết thúc và địa điểm (điểm học + phòng)", async () => {
    datApi(tongQuanMau());
    renderTrang();
    expect(
      await screen.findByText("THPT Long Xuyên — 1 Trần Hưng Đạo · phòng P201"),
    ).toBeInTheDocument();
    const nhan = screen.getByRole("radio", { name: /Lớp 02/ });
    expect(nhan.closest(".mantine-Radio-root")?.textContent).toMatch(
      /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}–\d{2}:\d{2}/,
    );
  });

  it("đề nghị quá hạn: nhãn buổi thật (buổi đã bắt đầu), không có nút Sửa, vẫn Hủy", async () => {
    const qua = deNghiMau({
      qua_han: true,
      buoi_nguon: tomTat(lich("ln-1", "Lớp Cũ", 4, -5)),
    });
    datApi(tongQuanMau({ buoi_sap_toi: [], de_nghi: [qua] }));
    renderTrang("?khoa=khoa-1");
    expect(await screen.findByText("Quá hạn")).toBeInTheDocument();
    expect(screen.getByText(/Lớp Cũ · Buổi 4/)).toBeInTheDocument();
    expect(screen.queryByText("Buổi học")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sửa" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Hủy đề nghị" }),
    ).toBeInTheDocument();
  });

  it("lịch sử đã duyệt: nhãn buổi nguồn thật và buổi chốt", async () => {
    const xong = deNghiMau({
      id: "dn-2",
      trang_thai: "da_duyet",
      lich_chot_id: "ld-9",
      buoi_nguon: tomTat(lich("ln-1", "Lớp Gốc", 2, -30)),
      buoi_chot: tomTat(lich("ld-9", "Lớp Chốt", 2, -20)),
    });
    datApi(tongQuanMau({ buoi_sap_toi: [], de_nghi: [xong] }));
    renderTrang("?khoa=khoa-1");
    expect(
      await screen.findByText(/Lớp Gốc · Buổi 2 · .* → Lớp Chốt · Buổi 2/),
    ).toBeInTheDocument();
  });

  it("hủy đề nghị đang chờ gọi POST /huy", async () => {
    datApi(tongQuanMau({ de_nghi: [deNghiMau()] }));
    const goi: string[] = [];
    server.use(
      http.post("/hoc-vien/toi/doi-buoi/:id/huy", ({ params }) => {
        goi.push(String(params.id));
        return HttpResponse.json({ trang_thai: "da_huy" });
      }),
    );
    const user = userEvent.setup();
    renderTrang("?khoa=khoa-1");
    await user.click(
      await screen.findByRole("button", { name: "Hủy đề nghị" }),
    );
    await waitFor(() => expect(goi).toEqual(["dn-1"]));
  });

  it("khóa tắt (API 403) → thông báo nhẹ, không lỗi, không trắng trang", async () => {
    datApi("403");
    renderTrang();
    expect(
      await screen.findByText("Khóa học chưa mở đề nghị đổi buổi"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Đề nghị đổi buổi học" }),
    ).toBeInTheDocument();
  });

  it("không có khóa nào → thông báo rỗng", async () => {
    server.use(http.get("/hoc-vien/toi/khoa-hoc", () => HttpResponse.json([])));
    renderTrang("");
    expect(
      await screen.findByText(
        "Thầy/Cô chưa được ghi danh vào khóa bồi dưỡng nào.",
      ),
    ).toBeInTheDocument();
  });

  it("nhiều khóa, không rõ khóa nào → hiện Select chọn khóa", async () => {
    const [dk] = db.khoaHocToi;
    db.khoaHocToi = [
      dk,
      {
        ...dk,
        id: "dk-2",
        khoa_id: "khoa-2",
        khoa: { ...dk.khoa, id: "khoa-2", ten_khoa: "Khóa thứ hai" },
      },
    ];
    datApi(tongQuanMau());
    renderTrang("");
    expect(
      await screen.findByRole("textbox", { name: "Khóa học" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/lượt đổi/)).not.toBeInTheDocument();
  });
});
