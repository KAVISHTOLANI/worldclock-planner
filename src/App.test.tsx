import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('WorldClock Planner workflow', () => {
  it('starts empty and validates city input', async () => {
    window.location.hash = '/planner';
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByText('No cities yet')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Add a city'), 'Atlantis{Enter}');
    expect(screen.getByText(/No city called “Atlantis”/)).toBeInTheDocument();
  });

  it('adds cities, moves the meeting with the keyboard and saves', async () => {
    localStorage.setItem('worldclock:date', JSON.stringify('2026-01-14'));
    localStorage.setItem('worldclock:start', JSON.stringify(14 * 60));
    window.location.hash = '/planner';
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText('Add a city'), 'London{Enter}');
    await user.type(screen.getByLabelText('Add a city'), 'Tok');
    await user.click(screen.getByRole('button', { name: /Tokyo/ }));
    expect(screen.getByTestId('verdict')).toHaveTextContent(/Unreasonable.*Tokyo/);

    await user.type(screen.getByLabelText('Add a city'), 'London{Enter}');
    expect(screen.getByText('London is already on the timeline.')).toBeInTheDocument();

    const slider = screen.getByRole('slider');
    slider.focus();
    fireEvent.keyDown(slider, { key: 'Home' });
    // London 00:00 = Tokyo 09:00 -> London is overnight
    expect(screen.getByTestId('verdict')).toHaveTextContent(/London/);
    fireEvent.keyDown(slider, { key: 'ArrowRight', shiftKey: true }); // 01:00
    expect(slider).toHaveAttribute('aria-valuenow', '60');

    await user.click(screen.getByRole('button', { name: 'Save meeting' }));
    expect(screen.getByText('Give the meeting a name.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Meeting name'), 'Release review');
    await user.click(screen.getByRole('button', { name: 'Save meeting' }));
    expect(screen.getByText('Saved “Release review”.')).toBeInTheDocument();
  });

  it('applies a suggested time that works for the demo team', async () => {
    localStorage.setItem('worldclock:date', JSON.stringify('2026-01-14'));
    localStorage.setItem('worldclock:cities', JSON.stringify(['london', 'berlin']));
    window.location.hash = '/planner';
    const user = userEvent.setup();
    render(<App />);
    const firstSuggestion = screen.getByRole('heading', { name: 'Suggested start times' }).parentElement!.querySelector('button')!;
    await user.click(firstSuggestion);
    expect(screen.getByTestId('verdict')).toHaveTextContent('Works for everyone');
  });
});
