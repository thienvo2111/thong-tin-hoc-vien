import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
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
  LichTrung,
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
    ly_do_huy: null,
    qua_han: false,
    thu_tu_hang: null,
    buoi_nguon: tomTat(lich("ln-1", "Lớp 01")),
    buoi_de_nghi: tomTat(lich("ld-1", "Lớp 02", 1, 50)),
    buoi_chot: null,
    doi_lai_tu: null,
    trung_lich: [],
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
    trung_lich: [],
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
    trung_lich: [],
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

const TRUNG: LichTrung = {
  id: "lx-9",
  buoi_so: 2,
  thoi_gian_bat_dau: new Date(Date.now() + 50 * GIO).toISOString(),
  thoi_gian_ket_thuc: new Date(Date.now() + 52 * GIO).toISOString(),
  lop: { ten_lop: "Lớp 09" },
};

describe("Trang đề nghị đổi buổi (học viên)", () => {
  it("đề nghị đang chờ có trùng giờ: thẻ hiện 1 dòng cảnh báo; không trùng thì không có", async () => {
    const trung = deNghiMau({ trung_lich: [TRUNG] });
    datApi(
      tongQuanMau({
        buoi_sap_toi: [{ lich_nguon: lich("ln-1", "Lớp 01"), de_nghi: trung }],
        de_nghi: [trung, deNghiMau({ id: "dn-2", lich_nguon_id: "ln-2" })],
      }),
    );
    renderTrang("?khoa=khoa-1");
    const the = await screen.findAllByTestId("de-nghi-cho-duyet");
    expect(the).toHaveLength(2);
    expect(within(the[0]).getByTestId("canh-bao-trung-lich")).toHaveTextContent(
      "Trùng giờ với Buổi 2 · Lớp 09",
    );
    expect(within(the[1]).queryByTestId("canh-bao-trung-lich")).toBeNull();
  });

  it("lựa chọn trùng giờ hiện cảnh báo; gửi buổi trùng phải xác nhận: Chọn buổi khác không gửi, Vẫn gửi gọi POST", async () => {
    datApi(tongQuanMau());
    const bodies: unknown[] = [];
    server.use(
      http.get("/hoc-vien/toi/doi-buoi/lua-chon/:id", () =>
        HttpResponse.json([{ ...LUA_CHON[0], trung_lich: [TRUNG] }, LUA_CHON[1]]),
      ),
      http.post("/hoc-vien/toi/doi-buoi", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: "dn-moi" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTrang();
    const canhBao = await screen.findByTestId("canh-bao-trung-lich");
    expect(canhBao).toHaveTextContent(/Trùng giờ với Buổi 2 · Lớp 09 · .+, \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}–\d{2}:\d{2}/);
    expect(screen.getAllByTestId("canh-bao-trung-lich")).toHaveLength(1);

    const radio = screen.getByRole("radio", { name: /Lớp 02/ });
    await user.click(radio);
    await user.type(screen.getByLabelText(/Lý do/), "Bận việc gia đình");
    await user.click(screen.getByRole("button", { name: "Gửi đề nghị" }));
    const hoi = await screen.findByRole("dialog", { name: "Buổi chọn bị trùng giờ" });
    expect(hoi).toHaveTextContent("Buổi này trùng giờ với Buổi 2 · Lớp 09");
    expect(hoi).toHaveTextContent("Thầy/Cô vẫn muốn gửi?");
    await user.click(within(hoi).getByRole("button", { name: "Chọn buổi khác" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(bodies).toEqual([]);
    expect(radio).not.toBeChecked();

    await user.click(radio);
    await user.click(screen.getByRole("button", { name: "Gửi đề nghị" }));
    const hoiLai = await screen.findByRole("dialog", { name: "Buổi chọn bị trùng giờ" });
    await user.click(within(hoiLai).getByRole("button", { name: "Vẫn gửi" }));
    await waitFor(() =>
      expect(bodies).toEqual([
        { lich_nguon_id: "ln-1", lich_de_nghi_id: "ld-1", ly_do: "Bận việc gia đình" },
      ]),
    );
  });

  it("hiện lượt còn lại, sĩ số, +n đang chờ; buổi đã đủ bị vô hiệu và có chữ Đã đủ", async () => {
    datApi(tongQuanMau());
    renderTrang();
    expect(await screen.findByText("Còn 1/2 lượt đổi")).toBeInTheDocument();
    expect(await screen.findByLabelText("Sĩ số 28/30, 2 đang chờ")).toBeInTheDocument();
    expect(screen.getByText("28/30")).toHaveTextContent("28/30 · +2 chờ");
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
      ly_do_qua_han: "buoi_goc_bat_dau",
      buoi_nguon: tomTat(lich("ln-1", "Lớp Cũ", 4, -5)),
    });
    datApi(tongQuanMau({ buoi_sap_toi: [], de_nghi: [qua] }));
    renderTrang("?khoa=khoa-1");
    expect(await screen.findByText("Quá hạn")).toBeInTheDocument();
    expect(screen.getByTestId("ly-do-qua-han")).toHaveTextContent("Quá hạn: Buổi cần đổi đã bắt đầu");
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
    // Phải xác nhận; bấm "Không" thì không gọi API.
    await user.click(await screen.findByRole("button", { name: "Không" }));
    expect(goi).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Hủy đề nghị" }));
    await user.click(
      await screen.findByRole("button", { name: "Xác nhận hủy" }),
    );
    await waitFor(() => expect(goi).toEqual(["dn-1"]));
  });

  it("đếm ký tự lý do theo chuỗi đã bỏ khoảng trắng đầu/cuối", async () => {
    datApi(tongQuanMau());
    const user = userEvent.setup();
    renderTrang();
    const oLyDo = await screen.findByLabelText(/Lý do/);
    await user.type(oLyDo, "   abc   ");
    expect(screen.getByText("3/500 ký tự (tối thiểu 5)")).toBeInTheDocument();
  });

  it("?lich= trỏ tới buổi đã có đề nghị đang chờ → hiện đề nghị đó, không hiện form gửi", async () => {
    datApi(
      tongQuanMau({
        buoi_sap_toi: [
          { lich_nguon: lich("ln-1", "Lớp 01"), de_nghi: deNghiMau() },
        ],
        de_nghi: [deNghiMau({ thu_tu_hang: { k: 1, n: 2 } })],
      }),
    );
    const user = userEvent.setup();
    renderTrang("?khoa=khoa-1&lich=ln-1");
    expect(
      await screen.findByText(/Buổi này Thầy\/Cô đã có đề nghị đổi buổi/),
    ).toBeInTheDocument();
    expect(screen.getByText("Bạn đang xếp thứ 1")).toBeInTheDocument();
    expect(screen.queryByText("Gửi đề nghị mới")).not.toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Xem tất cả đề nghị" }),
    );
    expect(await screen.findByText("Gửi đề nghị mới")).toBeInTheDocument();
  });

  it("?lich= trỏ tới buổi đã được duyệt đổi → hiện đề nghị đã duyệt, không hiện form", async () => {
    const xong = deNghiMau({
      trang_thai: "da_duyet",
      lich_chot_id: "ld-1",
      buoi_chot: tomTat(lich("ld-1", "Lớp 02", 1, 50)),
    });
    datApi(tongQuanMau({ de_nghi: [xong] }));
    renderTrang("?khoa=khoa-1&lich=ln-1");
    expect(await screen.findByText("Đã duyệt")).toBeInTheDocument();
    expect(screen.queryByText("Gửi đề nghị mới")).not.toBeInTheDocument();
  });

  it("đã duyệt (chưa bắt đầu, chưa có đổi lại chờ) → nút Đổi lại mở form khóa buổi nguồn, kể cả hết lượt", async () => {
    const daDuyet = deNghiMau({
      id: "dn-duyet",
      trang_thai: "da_duyet",
      lich_chot_id: "ld-9",
      buoi_chot: tomTat(lich("ld-9", "Lớp 09", 1, 60)),
    });
    datApi(
      tongQuanMau({
        so_buoi_doi_toi_da: 1,
        so_luot_da_dung: 1,
        buoi_sap_toi: [
          { lich_nguon: lich("ln-1", "Lớp 01"), de_nghi: daDuyet, de_nghi_doi_lai: null },
        ],
        de_nghi: [daDuyet],
      }),
    );
    const bodies: unknown[] = [];
    server.use(
      http.post("/hoc-vien/toi/doi-buoi", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: "dn-moi" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTrang("?khoa=khoa-1");
    expect(
      await screen.findByText("Thầy/Cô đã dùng hết lượt đổi buổi của khóa này."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Đổi lại" }));
    expect(await screen.findByText("Đổi lại buổi đã duyệt")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Buổi đã duyệt vẫn giữ cho tới khi đề nghị đổi lại được duyệt. Không tốn thêm lượt.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Buổi không tham gia được" }),
    ).toBeDisabled();
    await user.click(await screen.findByRole("radio", { name: /Lớp 02/ }));
    await user.type(screen.getByLabelText(/Lý do/), "Đổi ý vì lịch mới");
    await user.click(screen.getByRole("button", { name: "Gửi đề nghị" }));
    await waitFor(() =>
      expect(bodies).toEqual([
        {
          lich_nguon_id: "ln-1",
          lich_de_nghi_id: "ld-1",
          ly_do: "Đổi ý vì lịch mới",
        },
      ]),
    );
  });

  it("không hiện Đổi lại khi buổi đang học đã bắt đầu hoặc đã có đổi lại đang chờ", async () => {
    const daBatDau = deNghiMau({
      id: "dn-a",
      trang_thai: "da_duyet",
      lich_chot_id: "ld-9",
      buoi_chot: tomTat(lich("ld-9", "Lớp 09", 1, -1)),
    });
    const daDuyet = deNghiMau({
      id: "dn-b",
      trang_thai: "da_duyet",
      lich_nguon_id: "ln-2",
      lich_chot_id: "ld-8",
      buoi_nguon: tomTat(lich("ln-2", "Lớp 01", 2)),
      buoi_chot: tomTat(lich("ld-8", "Lớp 08", 2, 60)),
    });
    const choDoiLai = deNghiMau({
      id: "dn-c",
      lich_nguon_id: "ln-2",
      buoi_nguon: tomTat(lich("ln-2", "Lớp 01", 2)),
      doi_lai_tu: tomTat(lich("ld-8", "Lớp 08", 2, 60)),
    });
    datApi(tongQuanMau({ de_nghi: [choDoiLai, daBatDau, daDuyet] }));
    renderTrang("?khoa=khoa-1");
    expect(await screen.findByText(/Đổi lại — đang học: Lớp 08 · Buổi 2/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sửa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy đề nghị" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đổi lại" })).not.toBeInTheDocument();
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

// ADR 0012: cùng trang, ?loai=hoc_bu — nguồn là buổi đã vắng, lượt học bù riêng.
describe("Trang đăng ký học bù (học viên, ?loai=hoc_bu)", () => {
  const VANG = lich("lv-1", "Lớp 01", 2, -48);

  function tongQuanHocBu(over: Partial<TongQuanDoiBuoi> = {}): TongQuanDoiBuoi {
    return tongQuanMau({
      so_buoi_hoc_bu_toi_da: 2,
      so_luot_hoc_bu_da_dung: 1,
      buoi_co_the_hoc_bu: [
        { lich_nguon: VANG, trang_thai_diem_danh: "vang", de_nghi: null },
      ],
      ...over,
    });
  }

  it("tiêu đề, lượt học bù, mục Buổi đã vắng; lựa chọn gọi ?loai=hoc_bu; POST gửi loai", async () => {
    datApi(tongQuanHocBu());
    const urls: string[] = [];
    const bodies: unknown[] = [];
    server.use(
      http.get("/hoc-vien/toi/doi-buoi/lua-chon/:id", ({ request }) => {
        urls.push(new URL(request.url).pathname + new URL(request.url).search);
        return HttpResponse.json(LUA_CHON);
      }),
      http.post("/hoc-vien/toi/doi-buoi", async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id: "dn-hb" }, { status: 201 });
      }),
    );
    const user = userEvent.setup();
    renderTrang("?khoa=khoa-1&lich=lv-1&loai=hoc_bu");
    expect(
      await screen.findByRole("heading", { name: "Đăng ký học bù" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Còn 1/2 lượt học bù")).toBeInTheDocument();
    expect(
      (screen.getByRole("textbox", { name: "Buổi đã vắng" }) as HTMLInputElement).value,
    ).toMatch(/^Lớp 01 · Buổi 2 · /);
    await user.click(await screen.findByRole("radio", { name: /Lớp 02/ }));
    expect(screen.getByText("Buổi muốn học bù")).toBeInTheDocument();
    expect(urls).toEqual(["/hoc-vien/toi/doi-buoi/lua-chon/lv-1?loai=hoc_bu"]);
    await user.type(screen.getByLabelText(/Lý do/), "Hôm đó bị ốm");
    await user.click(screen.getByRole("button", { name: "Gửi đề nghị" }));
    await waitFor(() =>
      expect(bodies).toEqual([
        {
          lich_nguon_id: "lv-1",
          lich_de_nghi_id: "ld-1",
          ly_do: "Hôm đó bị ốm",
          loai: "hoc_bu",
        },
      ]),
    );
  });

  it("khóa chưa bật học bù (0) → thông báo nhẹ; trang đổi buổi vẫn chạy", async () => {
    datApi(tongQuanMau({ so_buoi_hoc_bu_toi_da: 0 }));
    renderTrang("?khoa=khoa-1&loai=hoc_bu");
    expect(
      await screen.findByText("Khóa học chưa mở đăng ký học bù"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/lượt/)).not.toBeInTheDocument();
  });

  it("khóa chỉ bật học bù → trang đổi buổi báo chưa mở đổi buổi", async () => {
    datApi(tongQuanHocBu({ so_buoi_doi_toi_da: 0, buoi_sap_toi: [] }));
    renderTrang("?khoa=khoa-1");
    expect(
      await screen.findByText("Khóa học chưa mở đề nghị đổi buổi"),
    ).toBeInTheDocument();
  });

  it("đề nghị học bù có badge Học bù, chỉ hiện ở trang học bù; trang đổi buổi không lẫn", async () => {
    const hb = deNghiMau({
      id: "dn-hb",
      loai: "hoc_bu",
      lich_nguon_id: "lv-1",
      buoi_nguon: tomTat(VANG),
    });
    datApi(tongQuanHocBu({ de_nghi: [hb] }));
    const { unmount } = renderTrang("?khoa=khoa-1&loai=hoc_bu");
    const the = await screen.findByTestId("de-nghi-cho-duyet");
    expect(within(the).getByText("Học bù")).toBeInTheDocument();
    expect(within(the).getByText(/^Buổi đã vắng: Lớp 01 · Buổi 2/)).toBeInTheDocument();
    expect(within(the).getByText(/^Học bù tại: Lớp 02/)).toBeInTheDocument();
    unmount();
    renderTrang("?khoa=khoa-1");
    expect(await screen.findByText("Còn 1/2 lượt đổi")).toBeInTheDocument();
    expect(screen.queryByTestId("de-nghi-cho-duyet")).not.toBeInTheDocument();
  });

  it("học bù đã duyệt, buổi học bù chưa bắt đầu → có Đổi lại dù buổi gốc đã qua", async () => {
    const daDuyet = deNghiMau({
      id: "dn-hb-duyet",
      loai: "hoc_bu",
      trang_thai: "da_duyet",
      lich_nguon_id: "lv-1",
      buoi_nguon: tomTat(VANG),
      lich_chot_id: "ld-9",
      buoi_chot: tomTat(lich("ld-9", "Lớp 09", 2, 60)),
    });
    datApi(
      tongQuanHocBu({
        so_luot_hoc_bu_da_dung: 2,
        buoi_co_the_hoc_bu: [
          { lich_nguon: VANG, trang_thai_diem_danh: "vang", de_nghi: daDuyet },
        ],
        de_nghi: [daDuyet],
      }),
    );
    renderTrang("?khoa=khoa-1&loai=hoc_bu");
    expect(
      await screen.findByText("Thầy/Cô đã dùng hết lượt học bù của khóa này."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đổi lại" })).toBeInTheDocument();
  });
});
