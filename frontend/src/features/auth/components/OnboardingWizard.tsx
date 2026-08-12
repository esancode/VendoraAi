import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { useAuth } from '../../../context/AuthContext';
import { Spinner } from '../../../components/feedback/Spinner';
import { api, baseURL } from '../../../services/api';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const onboardingSchema = z.object({
  companyName: z.string().min(2, 'O nome da empresa deve ter pelo menos 2 caracteres.'),
  industry: z.string().min(1, 'Selecione um setor.'),
  adminName: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  adminEmail: z.string().email('Insira um e-mail válido.'),
  adminPhone: z.string().min(10, 'Insira um telefone válido com DDD.'),
  password: z.string().min(6, 'A senha deve ter pelo menos 6 caracteres.'),
  confirmPassword: z.string().min(6, 'A confirmação de senha é obrigatória.')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword']
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export const OnboardingWizard = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, trigger, formState: { errors } } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onTouched'
  });

  const nextStep = async () => {
    const isStepValid = await trigger(['companyName', 'industry']);
    if (isStepValid) {
      setStep(2);
    }
  };

  const prevStep = () => {
    setStep(1);
  };

  const onSubmit = async (data: OnboardingFormData) => {
    setIsSubmitting(true);
    try {
      const res = await api.post('/auth/register', data);
      toast.success(res.data?.message || 'Verifique seu e-mail para validar a conta.');
      // Normally we would redirect to a "check your email" screen
      // But we will just log them out since we don't return tokens on register anymore.
      navigate('/login');
    } catch (error) {
      toast.error('Ocorreu um erro ao criar sua conta. E-mail pode estar em uso.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSSO = () => {
    window.location.href = `${baseURL}/auth/google`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090B] p-4 text-zinc-100 ">
      <div className="w-full max-w-md p-8 bg-[#000000] border border-zinc-800 rounded-sm shadow-2xl">
        <div className="mb-8 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Crie sua conta</h2>
          <div className="flex items-center gap-2 text-xs text-zinc-500 ">
            <span className={step === 1 ? 'text-white font-bold' : ''}>1. Empresa</span>
            <span className="text-zinc-700">/</span>
            <span className={step === 2 ? 'text-white font-bold' : ''}>2. Admin</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              
              <button
                type="button"
                onClick={handleGoogleSSO}
                className="w-full flex justify-center items-center py-2 bg-[#000000] border border-zinc-800 text-sm font-medium text-zinc-300 rounded-sm hover:bg-zinc-900 transition-colors"
              >
                <GoogleIcon /> Cadastrar com Google
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-800"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-[#000000] px-2 text-zinc-500 tracking-wider uppercase text-[11px]">
                    ou cadastre-se com e-mail
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Nome da Empresa</label>
                <input
                  {...register('companyName')}
                  className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="Sua Empresa Ltda"
                />
                {errors.companyName && <p className="text-rose-500 text-[10px] mt-1">{errors.companyName.message}</p>}
              </div>
              
              <div>
                <label className="block text-xs font-semibold mb-1">Setor de Vendas</label>
                <select 
                  {...register('industry')}
                  className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="">Selecione...</option>
                  <option value="varejo">Varejo</option>
                  <option value="servicos">Serviços</option>
                  <option value="moda">Moda</option>
                  <option value="outros">Outros</option>
                </select>
                {errors.industry && <p className="text-rose-500 text-[10px] mt-1">{errors.industry.message}</p>}
              </div>

              <button
                type="button"
                onClick={nextStep}
                className="w-full py-3 mt-4 bg-white hover:bg-zinc-200 text-black rounded-sm text-sm font-bold transition-colors"
              >
                Próximo Passo
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="block text-xs font-semibold mb-1">Nome Completo</label>
                <input
                  {...register('adminName')}
                  className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="João Silva"
                />
                {errors.adminName && <p className="text-rose-500 text-[10px] mt-1">{errors.adminName.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">E-mail</label>
                <input
                  type="email"
                  {...register('adminEmail')}
                  className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="joao@empresa.com"
                />
                {errors.adminEmail && <p className="text-rose-500 text-[10px] mt-1">{errors.adminEmail.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Telefone</label>
                <input
                  {...register('adminPhone')}
                  className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="(11) 99999-9999"
                />
                {errors.adminPhone && <p className="text-rose-500 text-[10px] mt-1">{errors.adminPhone.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Senha</label>
                  <input
                    type="password"
                    {...register('password')}
                    className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="••••••"
                  />
                  {errors.password && <p className="text-rose-500 text-[10px] mt-1">{errors.password.message}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Confirmar Senha</label>
                  <input
                    type="password"
                    {...register('confirmPassword')}
                    className="w-full px-4 py-2 bg-[#09090B] border border-zinc-800 rounded-sm text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="••••••"
                  />
                  {errors.confirmPassword && <p className="text-rose-500 text-[10px] mt-1">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  type="button"
                  onClick={prevStep}
                  className="flex-1 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white rounded-sm text-sm font-bold transition-colors"
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] py-3 flex justify-center items-center bg-emerald-600 hover:bg-emerald-500 text-white rounded-sm text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Spinner size="sm" /> : 'Finalizar Cadastro'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="text-center mt-6 text-xs text-zinc-500 font-sans">
          Já tem uma conta?{' '}
          <button 
            onClick={() => navigate('/login')}
            className="font-medium text-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Faça Login
          </button>
        </div>
      </div>
    </div>
  );
};
