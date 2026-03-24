import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import AdminDashboard from '../pages/AdminDashboard';

// Define proper types
interface MockLinkProps {
  children: React.ReactNode;
  to: string;
  [key: string]: unknown;
}

// Mock useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Admin User', email: 'admin@test.com', role: 'admin' },
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// Mock Link component
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Link: ({ children, to, ...props }: MockLinkProps) => <a href={to} {...props}>{children}</a>,
  };
});

describe('AdminDashboard Component', () => {
  test('renders admin dashboard correctly', () => {
    render(<AdminDashboard />);
    
    // Check that main elements are present
    expect(screen.getByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText('Manage Exams')).toBeInTheDocument();
    expect(screen.getByText('View Results')).toBeInTheDocument();
  });

  test('shows navigation links', () => {
    render(<AdminDashboard />);
    
    // Check navigation links
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Exams')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });
});
