import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { Loader2, CheckCircle2, QrCode } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useSocket } from '../../../context/SocketContext';

export const DashboardWhatsAppSetup: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [channelId, setChannelId] = useState<string | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;
    socket.on('channel.qr_generated', (data: any) => {
      if (data.channelId === channelId) {
        setQrCodeData(data.qrCodeBase64);
        setConnectionError(null);
      }
    });
    socket.on('channel.connected', (data: any) => {
      if (data.channelId === channelId) {
        setIsSuccess(true);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['dashboard-status'] });
        }, 1500);
      }
    });
    socket.on('channel.connection_error', (data: any) => {
      if (data.channelId === channelId) {
        setConnectionError(data.message || 'Erro ao conectar. Tente novamente.');
      }
    });
    return () => {
      socket.off('channel.qr_generated');
      socket.off('channel.connected');
      socket.off('channel.connection_error');
    };
  }, [socket, channelId, queryClient]);

  const connectChannelMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/whatsapp-channels/${id}/connect`),
    onSuccess: (_, id) => {
      setChannelId(id);
      setQrCodeData(null);
      setIsSuccess(false);
      setConnectionError(null);
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Erro ao inicializar conexão.'),
  });

  const createChannelMutation = useMutation({
    mutationFn: async () => api.post('/whatsapp-channels', { name: 'WhatsApp Principal', phoneNumber }),
    onSuccess: (res) => {
      const createdId = res.data?.id;
      if (createdId) {
        connectChannelMutation.mutate(createdId);
      }
    },
    onError: (error: any) => toast.error(error?.response?.data?.message || 'Erro ao criar canal.'),
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber) return toast.error('Digite o número de telefone.');
    createChannelMutation.mutate();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="max-w-md w-full bg-[#09090B] border border-zinc-800 rounded-sm p-8 flex flex-col gap-6">
        <div className="text-center">
          <QrCode className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-zinc-100">Conecte seu WhatsApp</h2>
          <p className="text-sm text-zinc-500 mt-2">
            Para iniciar a auditoria passiva, precisamos ler seu histórico de conversas diretamente do seu WhatsApp.
          </p>
        </div>

        {!channelId ? (
          <form onSubmit={handleStart} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1 block">Número do WhatsApp (com DDD)</label>
              <input
                type="text"
                placeholder="Ex: 5511999999999"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full bg-black border border-zinc-800 rounded-sm px-4 py-3 text-sm text-zinc-300 focus:outline-none focus:border-emerald-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={createChannelMutation.isPending}
              className="w-full bg-zinc-100 hover:bg-white text-black font-bold text-xs uppercase tracking-wider py-3 rounded-sm transition-colors flex items-center justify-center"
            >
              {createChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '[ GERAR QR CODE ]'}
            </button>
          </form>
        ) : (
          <div className="flex flex-col items-center justify-center py-4">
            {connectionError ? (
              <div className="flex flex-col gap-4 w-full">
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 p-3 text-xs text-center rounded-sm">
                  {connectionError}
                </div>
                <button
                  onClick={() => connectChannelMutation.mutate(channelId)}
                  disabled={connectChannelMutation.isPending}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 text-xs uppercase tracking-wider font-bold rounded-sm"
                >
                  {connectChannelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'TENTAR NOVAMENTE'}
                </button>
              </div>
            ) : isSuccess ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <p className="text-emerald-500 text-sm font-medium">Autenticado com sucesso!</p>
              </div>
            ) : qrCodeData ? (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-2 rounded-sm">
                  <img src={qrCodeData} alt="QR Code WhatsApp" className="w-48 h-48" />
                </div>
                <p className="text-xs text-zinc-500 text-center">
                  Abra o WhatsApp, vá em "Dispositivos Conectados" e escaneie o código acima.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-8">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
                <p className="text-xs text-zinc-500 uppercase tracking-wider">Aguardando Baileys...</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
