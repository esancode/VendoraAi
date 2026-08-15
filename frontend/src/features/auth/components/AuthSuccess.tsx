import { useEffect } from 'react';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Spinner } from '../../../components/feedback/Spinner';

export const AuthSuccess = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) return;

    const processLogin = async () => {
      try {
        await login({
          accessToken: token,
          user: {} as any,
          tenantId: '',
        });
        navigate('/dashboard');
      } catch (e) {
        navigate('/login?error=oauth_failed');
      }
    };
    
    processLogin();
  }, [token, login, navigate]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090B]">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" className="text-sifto-cobalt" />
        <p className="text-zinc-400 text-sm tracking-widest uppercase">Autenticando...</p>
      </div>
    </div>
  );
};
