import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../../../services/api';
import { Spinner } from '../../../components/feedback/Spinner';
import { useAuth } from '../../../context/AuthContext';

export const BusinessOnboardingQuiz = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); // just to re-trigger or we can use it to welcome
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    niche: '',
    businessHours: { start: '08:00', end: '18:00', days: 'Segunda a Sexta' },
    shippingRules: '',
    paymentMethods: '',
    faqs: [{ question: '', answer: '' }]
  });

  const handleNext = () => setStep(s => Math.min(s + 1, 5));
  const handlePrev = () => setStep(s => Math.max(s - 1, 1));

  const handleFaqChange = (index: number, field: 'question' | 'answer', value: string) => {
    const newFaqs = [...formData.faqs];
    newFaqs[index][field] = value;
    setFormData({ ...formData, faqs: newFaqs });
  };

  const addFaq = () => {
    setFormData({ ...formData, faqs: [...formData.faqs, { question: '', answer: '' }] });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await api.post('/onboarding/complete', formData);
      toast.success('Onboarding concluído! Conhecimento treinado com sucesso.');
      // Force reload auth state or just navigate, ProtectedRoute will catch it?
      // Just navigating is fine, but context user.tenant.onboardingCompleted is stale.
      // So let's dispatch a token_refreshed event or just reload window.
      window.location.href = '/dashboard';
    } catch (error) {
      toast.error('Erro ao salvar os dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#09090B] text-zinc-100 p-4">
      <div className="w-full max-w-2xl bg-[#000000] border border-zinc-800 rounded-sm p-8 shadow-2xl">
        
        <div className="mb-8 border-b border-zinc-800 pb-4">
          <h2 className="text-xl font-bold tracking-tight mb-2">Configuração do Agente (Passo {step}/5)</h2>
          <div className="w-full bg-zinc-900 h-1 rounded-sm mt-4">
            <div 
              className="bg-sifto-cobalt h-1 rounded-sm transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="min-h-[250px] mb-8 animate-in fade-in slide-in-from-right-4 duration-300">
          {step === 1 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold">1. Qual é o nicho da sua empresa?</label>
              <p className="text-xs text-zinc-500 mb-4">Ex: Ótica, Imobiliária, E-commerce de moda...</p>
              <input
                type="text"
                className="w-full px-4 py-3 bg-[#09090B] border border-zinc-800 rounded-sm focus:border-sifto-cobalt focus:outline-none transition-colors text-sm"
                placeholder="Digite o nicho principal"
                value={formData.niche}
                onChange={e => setFormData({ ...formData, niche: e.target.value })}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold">2. Horário Comercial</label>
              <p className="text-xs text-zinc-500 mb-4">Quais dias e janelas de horas os humanos atendem?</p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Abertura</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-[#09090B] border border-zinc-800 rounded-sm focus:border-sifto-cobalt focus:outline-none transition-colors text-sm"
                    value={formData.businessHours.start}
                    onChange={e => setFormData({ ...formData, businessHours: { ...formData.businessHours, start: e.target.value } })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">Fechamento</label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-[#09090B] border border-zinc-800 rounded-sm focus:border-sifto-cobalt focus:outline-none transition-colors text-sm"
                    value={formData.businessHours.end}
                    onChange={e => setFormData({ ...formData, businessHours: { ...formData.businessHours, end: e.target.value } })}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-xs text-zinc-500 mb-1">Dias úteis</label>
                <input
                  type="text"
                  className="w-full px-4 py-3 bg-[#09090B] border border-zinc-800 rounded-sm focus:border-sifto-cobalt focus:outline-none transition-colors text-sm"
                  placeholder="Ex: Segunda a Sexta"
                  value={formData.businessHours.days}
                  onChange={e => setFormData({ ...formData, businessHours: { ...formData.businessHours, days: e.target.value } })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold">3. Políticas de Envio & Frete</label>
              <p className="text-xs text-zinc-500 mb-4">Regras básicas de entrega para instruir o agente.</p>
              <textarea
                className="w-full h-32 px-4 py-3 bg-[#09090B] border border-zinc-800 rounded-sm focus:border-sifto-cobalt focus:outline-none transition-colors text-sm resize-none"
                placeholder="Ex: Entregamos em até 2 dias úteis para SP. Frete grátis acima de R$ 200."
                value={formData.shippingRules}
                onChange={e => setFormData({ ...formData, shippingRules: e.target.value })}
              />
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold">4. Formas de Pagamento</label>
              <p className="text-xs text-zinc-500 mb-4">Aceita PIX com desconto? Parcelamento em até quantas vezes?</p>
              <textarea
                className="w-full h-32 px-4 py-3 bg-[#09090B] border border-zinc-800 rounded-sm focus:border-sifto-cobalt focus:outline-none transition-colors text-sm resize-none"
                placeholder="Ex: Aceitamos PIX com 5% de desconto, e parcelamos em até 10x sem juros no cartão."
                value={formData.paymentMethods}
                onChange={e => setFormData({ ...formData, paymentMethods: e.target.value })}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <label className="block text-sm font-semibold flex justify-between items-center">
                <span>5. Principais FAQs</span>
                <button 
                  onClick={addFaq}
                  className="text-xs text-sifto-cobalt hover:text-sifto-cobalt-light font-bold"
                >
                  + Adicionar Pergunta
                </button>
              </label>
              <p className="text-xs text-zinc-500 mb-4">As perguntas mais frequentes que os clientes fazem e suas respostas oficiais.</p>
              
              <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {formData.faqs.map((faq, index) => (
                  <div key={index} className="space-y-2 p-4 bg-[#09090B] border border-zinc-800 rounded-sm">
                    <input
                      type="text"
                      className="w-full px-3 py-2 bg-transparent border-b border-zinc-800 focus:border-sifto-cobalt focus:outline-none transition-colors text-sm"
                      placeholder="Pergunta (ex: Vocês têm loja física?)"
                      value={faq.question}
                      onChange={e => handleFaqChange(index, 'question', e.target.value)}
                    />
                    <textarea
                      className="w-full px-3 py-2 bg-transparent focus:outline-none transition-colors text-sm resize-none h-20"
                      placeholder="Resposta oficial"
                      value={faq.answer}
                      onChange={e => handleFaqChange(index, 'answer', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4">
          {step > 1 && (
            <button
              onClick={handlePrev}
              className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-sm text-sm font-bold transition-colors"
            >
              Voltar
            </button>
          )}
          
          {step < 5 ? (
            <button
              onClick={handleNext}
              className="flex-1 px-6 py-3 bg-white text-black hover:bg-zinc-200 rounded-sm text-sm font-bold transition-colors ml-auto"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 flex justify-center items-center px-6 py-3 bg-sifto-cobalt-dark hover:bg-sifto-cobalt text-white rounded-sm text-sm font-bold transition-colors ml-auto disabled:opacity-50"
            >
              {isSubmitting ? <Spinner size="sm" /> : 'Finalizar e Treinar IA'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
