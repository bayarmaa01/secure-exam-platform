import { render, screen } from '@testing-library/react';
import { describe, test, expect, vi } from 'vitest';
import TeacherDashboard from '../pages/TeacherDashboard';

// Mock useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'Teacher User', email: 'teacher@test.com', role: 'teacher' },
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
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
  };
});

describe('TeacherDashboard Component', () => {
  test('renders teacher dashboard correctly', () => {
    render(<TeacherDashboard />);
    
    // Check that main elements are present
    expect(screen.getByText('Teacher Panel')).toBeInTheDocument();
    expect(screen.getByText('Teacher Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create New Exam')).toBeInTheDocument();
    expect(screen.getAllByText('Manage Exams')).toHaveLength(2); // One in nav, one in card
    expect(screen.getAllByText('View Results')).toHaveLength(2); // One in nav, one in card
  });

  test('shows navigation links', () => {
    render(<TeacherDashboard />);
    
    // Check navigation links (using more specific selectors)
    expect(screen.getByText('Create Exam')).toBeInTheDocument();
    expect(screen.getAllByText('Manage Exams')).toHaveLength(2); // One in nav, one in card
    expect(screen.getAllByText('View Results')).toHaveLength(2); // One in nav, one in card
    expect(screen.getByText('Logout')).toBeInTheDocument();
  });

  test('shows quick stats section', () => {
    render(<TeacherDashboard />);
    
    // Check stats section
    expect(screen.getByText('Quick Stats')).toBeInTheDocument();
    expect(screen.getByText('Total Exams')).toBeInTheDocument();
    expect(screen.getByText('Published')).toBeInTheDocument();
    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    expect(screen.getByText('Active Students')).toBeInTheDocument();
  });
});
