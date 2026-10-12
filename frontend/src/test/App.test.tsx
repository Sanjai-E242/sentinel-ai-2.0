import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../App';

describe('Sentinel 2.0 Frontend Foundation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders application shell and defaults to Simple Mode', () => {
    render(<App />);

    // Brand check
    expect(screen.getAllByText('SENTINEL').length).toBeGreaterThan(0);

    // Simple Mode default checks
    expect(screen.getByText('System Status Overview')).toBeInTheDocument();
    expect(screen.getByText('Safe Agents')).toBeInTheDocument();
    expect(screen.getByText('Active AI Agents')).toBeInTheDocument();
  });

  it('switches seamlessly to Expert Mode and back without crashing', () => {
    render(<App />);

    // Switch to Expert Mode
    const expertButton = screen.getAllByRole('radio', { name: /Expert Mode/i })[0];
    fireEvent.click(expertButton);

    // Expert Mode assertions
    expect(screen.getByText(/Intervention Window Assessment/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Intervention Intelligence Engine/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Trajectory Deviation/i).length).toBeGreaterThan(0);

    // Switch back to Simple Mode
    const simpleButton = screen.getAllByRole('radio', { name: /Simple Mode/i })[0];
    fireEvent.click(simpleButton);

    expect(screen.getByText('System Status Overview')).toBeInTheDocument();
  });
});
