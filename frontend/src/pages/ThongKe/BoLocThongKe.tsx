import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Group, Select, Skeleton, Text } from '@mantine/core';
import { useBoLocThongKe, type DoiTuongLoc, type LocThongKe } from '@/api/thongKe';
import { DOI_TUONG_OPTIONS } from '@/lib/tuyChonHoSo';

const KHOA_URL = ['khoa_id', 'don_vi_id', 'cum_id'] as const;

const DOI_TUONG_LOC = [...DOI_TUONG_OPTIONS, { value: 'chua_xac_dinh', label: 'Chưa xác định' }];

/** Bộ lọc giữ trên URL query (chia sẻ link được). */
export function useLocTuUrl(): [LocThongKe, (l: LocThongKe) => void] {
  const [params, setParams] = useSearchParams();
  const chuoi = params.toString();
  const loc = useMemo<LocThongKe>(() => {
    const p = new URLSearchParams(chuoi);
    const out: LocThongKe = {};
    for (const k of KHOA_URL) {
      const v = p.get(k);
      if (v) out[k] = v;
    }
    const dt = p.get('doi_tuong');
    if (dt && DOI_TUONG_LOC.some((o) => o.value === dt)) out.doi_tuong = dt as DoiTuongLoc;
    return out;
  }, [chuoi]);

  const setLoc = useCallback(
    (l: LocThongKe) => {
      setParams(
        (cu) => {
          const moi = new URLSearchParams(cu);
          for (const k of KHOA_URL) {
            const v = l[k];
            if (v) moi.set(k, v);
            else moi.delete(k);
          }
          if (l.doi_tuong) moi.set('doi_tuong', l.doi_tuong);
          else moi.delete('doi_tuong');
          return moi;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [loc, setLoc];
}

export function BoLocThongKe() {
  const [loc, setLoc] = useLocTuUrl();
  const boLoc = useBoLocThongKe();

  if (boLoc.isLoading) return <Skeleton height={56} />;
  if (boLoc.isError || !boLoc.data) {
    return (
      <Alert color="red" title="Không tải được bộ lọc">
        <Button size="xs" variant="light" color="red" onClick={() => void boLoc.refetch()}>
          Thử lại
        </Button>
      </Alert>
    );
  }

  const { khoa, don_vi, cum, don_vi_co_dinh } = boLoc.data;
  const cumTheoKhoa = (cum ?? []).filter((c) => !loc.khoa_id || c.khoa_id === loc.khoa_id);

  return (
    <Group align="flex-end" gap="md" role="search" aria-label="Bộ lọc thống kê">
      <Select
        label="Khóa"
        placeholder="Tất cả khóa"
        clearable
        data={khoa.map((k) => ({ value: k.id, label: k.ten_khoa }))}
        value={loc.khoa_id ?? null}
        onChange={(v) => setLoc({ ...loc, khoa_id: v ?? undefined, cum_id: undefined })}
      />
      {don_vi && (
        <Select
          label="Đơn vị"
          placeholder="Tất cả đơn vị"
          searchable
          clearable
          data={don_vi.map((d) => ({ value: d.id, label: d.ten_don_vi }))}
          value={loc.don_vi_id ?? null}
          onChange={(v) => setLoc({ ...loc, don_vi_id: v ?? undefined, cum_id: undefined })}
        />
      )}
      {cum && (
        <Select
          label="Cụm"
          placeholder={loc.khoa_id ? 'Tất cả cụm' : 'Chọn khóa trước'}
          clearable
          disabled={!loc.khoa_id}
          data={cumTheoKhoa.map((c) => ({ value: c.id, label: c.ten_cum }))}
          value={loc.cum_id ?? null}
          onChange={(v) => setLoc({ ...loc, cum_id: v ?? undefined, don_vi_id: undefined })}
        />
      )}
      <Select
        label="Đối tượng"
        placeholder="Tất cả đối tượng"
        clearable
        data={DOI_TUONG_LOC}
        clearButtonProps={{ 'aria-label': 'Xóa đối tượng' }}
        value={loc.doi_tuong ?? null}
        onChange={(v) => setLoc({ ...loc, doi_tuong: (v as DoiTuongLoc | null) ?? undefined })}
      />
      {don_vi_co_dinh && (
        <Text size="sm">
          Đơn vị: <b>{don_vi_co_dinh.ten_don_vi}</b>
        </Text>
      )}
    </Group>
  );
}
