import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('recharts', () => {
  const React = require('react');
  const passthrough = ({ children }) => <div>{children}</div>;

  return {
    LineChart: passthrough,
    Line: () => null,
    ScatterChart: passthrough,
    Scatter: () => null,
    XAxis: ({ label, ticks, tickFormatter }) => (
      <div>
        {label?.value}
        {ticks?.[0] !== undefined && tickFormatter ? tickFormatter(ticks[0]) : null}
      </div>
    ),
    YAxis: ({ label }) => <div>{label?.value}</div>,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ResponsiveContainer: passthrough,
    ReferenceArea: () => null,
  };
});

test('renders the FP8 analyzer with power-of-two histogram labels', () => {
  render(<App />);
  expect(screen.getByText(/FP8 Values Analyzer/i)).toBeInTheDocument();
  expect(screen.getByText(/Value Range \(2\^n\)/i)).toBeInTheDocument();
  expect(screen.getByText(/2\^-/i)).toBeInTheDocument();
});
