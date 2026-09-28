import { useEffect, useState } from 'react';
import { Text } from '@mantine/core';
import { conLaiDuoi24h, demNguoc } from '@/lib/ngay';

/** Đếm ngược khi còn dưới 24 giờ trước dong_luc (dac-ta § M3). */
export function CountdownTimer({ dongLuc }: { dongLuc: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!conLaiDuoi24h(dongLuc)) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [dongLuc]);

  if (!conLaiDuoi24h(dongLuc)) return null;
  const con = demNguoc(dongLuc, now);
  if (!con) return null;

  return (
    <Text fw={600} c="red.7">
      Còn lại: {con}
    </Text>
  );
}
