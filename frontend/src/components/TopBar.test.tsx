import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderVoiRouter } from '@/test/testUtils';
import { datToken } from '@/auth/tokenStore';
import { TopBar } from './TopBar';

const routes = [{ path: '/toi', element: <TopBar /> }];

describe('TopBar', () => {
  it('có mục "Hướng dẫn" trên menu, trỏ /huong-dan', async () => {
    datToken('token-gia-lap');
    renderVoiRouter(routes, { initialEntries: ['/toi'] });

    expect(await screen.findByRole('link', { name: 'Hướng dẫn' })).toHaveAttribute('href', '/huong-dan');
  });
});
