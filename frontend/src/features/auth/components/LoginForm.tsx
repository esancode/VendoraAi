import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { Spinner } from '../../../components/feedback/Spinner';
import toast from 'react-hot-toast';
import { api } from '../../../services/api';

type AuthView = 'SIGN_IN' | 'FORGOT_PASSWORD' | 'ENTER_CODE' | 'RESET_PASSWORD';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

export const LoginForm = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [currentView, setCurrentView] = useState<AuthView>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGoogleSSO = () => {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
    window.location.href = `${baseUrl}/auth/google`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login({ accessToken: data.accessToken, tenantId: data.tenantId, user: data.user });
      toast.success('Bem-vindo de volta!');
      navigate('/dashboard');
    } catch (error: any) {
      if (error.code === 'ERR_NETWORK' || !error.response) {
        toast.error('Servidor offline.');
      } else if (error.response?.status === 401) {
        toast.error('Credenciais inválidas.');
      } else if (error.response?.status === 429) {
        toast.error('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        toast.error(error.response?.data?.message || 'Erro ao tentar fazer login.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/auth/forgot-password', { email });
      toast.success('Se o e-mail existir, um código foi enviado.');
      setCurrentView('ENTER_CODE');
    } catch (error) {
      toast.error('Ocorreu um erro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data } = await api.post('/auth/verify-recovery-code', { email, code: verificationCode });
      setResetToken(data.resetToken);
      toast.success('Código verificado!');
      setCurrentView('RESET_PASSWORD');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Código inválido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', { token: resetToken, password_raw: newPassword });
      toast.success('Senha atualizada com sucesso!');
      setPassword('');
      setCurrentView('SIGN_IN');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Ocorreu um erro.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090B] p-4 text-zinc-100 font-sans">
      <div className="w-full max-w-sm p-8 bg-[#000000] rounded-sm border border-zinc-800 shadow-2xl">
        
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-white tracking-tight ">VendoraAI</h2>
          <p className="mt-2 text-xs text-zinc-500 ">
            {currentView === 'SIGN_IN' && 'Acesse seu workspace'}
            {currentView === 'FORGOT_PASSWORD' && 'Recuperação de conta'}
            {currentView === 'ENTER_CODE' && 'Verificação de segurança'}
            {currentView === 'RESET_PASSWORD' && 'Crie sua nova senha'}
          </p>
        </div>

        {currentView === 'SIGN_IN' && (
          <div className="animate-in fade-in duration-300">
            <button
              onClick={handleGoogleSSO}
              className="w-full flex justify-center items-center py-2 bg-[#000000] border border-zinc-800 text-sm font-medium text-zinc-300 rounded-sm hover:bg-zinc-900 transition-colors mb-6"
            >
              <GoogleIcon /> Continuar com Google
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#000000] px-2 text-zinc-500 tracking-wider uppercase text-[11px]">
                  ou continue com e-mail profissional
                </span>
              </div>
            </div>

            <form className="space-y-6" onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1" htmlFor="email">E-mail</label>
                  <input
                    id="email" type="email" required
                    className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors "
                    placeholder="seu@email.com"
                    value={email} onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-zinc-400" htmlFor="password">Senha</label>
                    <button type="button" onClick={() => setCurrentView('FORGOT_PASSWORD')} className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors ">Esqueceu a senha?</button>
                  </div>
                  <input
                    id="password" type="password" required
                    className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors "
                    placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-2 text-sm font-bold text-black bg-white rounded-sm hover:bg-zinc-200 transition-colors disabled:opacity-50">
                {isSubmitting ? <Spinner size="sm" className="text-black" /> : 'Entrar'}
              </button>
            </form>

            <div className="text-center mt-6 text-xs text-zinc-500 ">
              Não possui uma conta?{' '}
              <button onClick={() => navigate('/register')} className="font-medium text-emerald-500 hover:text-emerald-400 transition-colors">
                Cadastre-se
              </button>
            </div>
          </div>
        )}

        {currentView === 'FORGOT_PASSWORD' && (
          <form className="space-y-6 animate-in fade-in duration-300" onSubmit={handleForgotPassword}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">E-mail cadastrado</label>
              <input
                type="email" required
                className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors "
                placeholder="seu@email.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-2 text-sm font-bold text-black bg-white rounded-sm hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {isSubmitting ? <Spinner size="sm" className="text-black" /> : 'Enviar código de recuperação'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => setCurrentView('SIGN_IN')} className="text-xs text-zinc-500 hover:text-white transition-colors ">
                Voltar para o login
              </button>
            </div>
          </form>
        )}

        {currentView === 'ENTER_CODE' && (
          <form className="space-y-6 animate-in fade-in duration-300" onSubmit={handleVerifyCode}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Código de 6 dígitos</label>
              <input
                type="text" required maxLength={6}
                className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-center tracking-[0.5em] text-lg text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors "
                placeholder="000000"
                value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-2 text-sm font-bold text-black bg-white rounded-sm hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {isSubmitting ? <Spinner size="sm" className="text-black" /> : 'Verificar Código'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => setCurrentView('SIGN_IN')} className="text-xs text-zinc-500 hover:text-white transition-colors ">
                Voltar para o login
              </button>
            </div>
          </form>
        )}

        {currentView === 'RESET_PASSWORD' && (
          <form className="space-y-6 animate-in fade-in duration-300" onSubmit={handleResetPassword}>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Nova Senha</label>
              <input
                type="password" required minLength={6}
                className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors "
                placeholder="••••••••"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full flex justify-center items-center py-2 text-sm font-bold text-black bg-white rounded-sm hover:bg-zinc-200 transition-colors disabled:opacity-50">
              {isSubmitting ? <Spinner size="sm" className="text-black" /> : 'Confirmar nova senha'}
            </button>
            <div className="text-center">
              <button type="button" onClick={() => setCurrentView('SIGN_IN')} className="text-xs text-zinc-500 hover:text-white transition-colors ">
                Voltar para o login
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
