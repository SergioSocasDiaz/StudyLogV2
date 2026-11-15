import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LandingPage } from './LandingPage';

describe('LandingPage', () => {
  it('presents the product promise and the primary CTA', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /sabes cuánto estudias/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cómo funciona/i })).toHaveAttribute(
      'href',
      '#como-funciona',
    );
  });

  it('lists the three product pillars', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: /registra sin fricción/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /mira el esfuerzo/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sabe qué funciona/i })).toBeInTheDocument();
  });
});
