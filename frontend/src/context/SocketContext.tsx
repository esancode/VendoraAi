import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Use the VITE_API_URL if provided, otherwise default to '/' which works when frontend and backend are served together
const SOCKET_URL = import.meta.env.VITE_API_URL || '/';

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, accessToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    let newSocket: Socket | null = null;

    if (isAuthenticated && accessToken) {
      // Cria a instância do socket com autoConnect true (só conecta se tiver token)
      // O handshake envia o token pro backend
      newSocket = io(SOCKET_URL, {
        auth: { token: accessToken },
        autoConnect: true,
      });

      newSocket.on('connect', () => {
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        setIsConnected(false);
      });

      setSocket(newSocket);
    }

    return () => {
      // Limpa a conexão explicitamente no unmount ou quando as props mudarem (ex: logout)
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isAuthenticated, accessToken]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
