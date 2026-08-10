import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoginForm } from './LoginForm';
import * as AuthContextModule from '../../../context/AuthContext';
import { vi } from 'vitest';
import toast from 'react-hot-toast';
import '@testing-library/jest-dom';

vi.mock('../../../context/AuthContext', async () => {
  return {
    useAuth: vi.fn(),
  };
});

vi.mock('react-hot-toast', () => {
  return {
    default: {
      success: vi.fn(),
      error: vi.fn(),
    }
  };
});

describe('LoginForm', () => {
  const loginMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContextModule.useAuth).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      tenantId: null,
      accessToken: null,
      login: loginMock,
      logout: vi.fn(),
    });
  });

  it('deve renderizar o formulário', () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('deve exibir toast de erro com credenciais incorretas', async () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'errado@email.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'senhaerrada' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Credenciais inválidas. Verifique seu login.');
    }, { timeout: 2000 });
  });

  it('deve redirecionar com credenciais corretas e chamar login', async () => {
    render(
      <MemoryRouter>
        <LoginForm />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'admin@admin.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Bem-vindo de volta!');
    }, { timeout: 2000 });
  });
});
