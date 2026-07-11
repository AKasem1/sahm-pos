import { provideZonelessChangeDetection } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ChannelFilterComponent } from './channel-filter.component';

describe('ChannelFilterComponent (a11y + behavior)', () => {
  it('exposes each chip as a pressable button and marks the active one', async () => {
    await render(ChannelFilterComponent, {
      inputs: { active: 'delivery' },
      providers: [provideZonelessChangeDetection()],
    });

    const group = screen.getByRole('group', { name: /filter orders by channel/i });
    expect(group).toBeTruthy();

    const delivery = screen.getByRole('button', { name: 'Delivery' });
    expect(delivery.getAttribute('aria-pressed')).toBe('true');

    const all = screen.getByRole('button', { name: 'All' });
    expect(all.getAttribute('aria-pressed')).toBe('false');
  });

  it('emits the selected channel on click', async () => {
    const select = vi.fn();
    await render(ChannelFilterComponent, {
      inputs: { active: 'all' },
      on: { select },
      providers: [provideZonelessChangeDetection()],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Online' }));
    expect(select).toHaveBeenCalledWith('online');
  });
});
