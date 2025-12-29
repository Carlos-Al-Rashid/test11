import React from 'react';
import { render, screen } from '@testing-library/react';
import HelloWorld from '../HelloWorld';

describe('HelloWorld Component', () => {
  it('should render with default props', () => {
    render(<HelloWorld />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hello, World!');
    
    const paragraph = screen.getByText('Welcome to Miyabi Framework');
    expect(paragraph).toBeInTheDocument();
  });

  it('should render with custom name prop', () => {
    render(<HelloWorld name="Miyabi" />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hello, Miyabi!');
  });

  it('should handle empty string name', () => {
    render(<HelloWorld name="" />);
    
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Hello, !');
  });

  it('should render the welcome message', () => {
    render(<HelloWorld />);
    
    expect(screen.getByText('Welcome to Miyabi Framework')).toBeInTheDocument();
  });
});