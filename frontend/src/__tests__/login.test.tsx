import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import Login from '../pages/Login';

// Define proper types
interface MockLinkProps {
  children: React.ReactNode;
  to: string;
  [key: string]: unknown;
}

// Mock useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock useNavigate
vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: MockLinkProps) => <a href={to} {...props}>{children}</a>,
}));

describe('Login Component', () => {
  test('renders login form correctly', () => {
    render(<Login />);
    
    // Check that main elements are present
    expect(screen.getByPlaceholderText('Email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
    expect(screen.getByText('Secure Exam Platform')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
  });

  test('shows register link', () => {
    render(<Login />);
    
    const registerLink = screen.getByText(/register/i);
    expect(registerLink).toBeInTheDocument();
  });
});
