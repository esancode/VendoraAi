import { AppRoutes } from './routes/AppRoutes';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <>
      <Toaster 
        position="top-right" 
        toastOptions={{
          style: {
            background: '#000000', // absolute black
            color: '#f4f4f5', // zinc-100
            border: '1px solid #27272a', // zinc-800
            borderRadius: '4px', // rounded-sm
            fontSize: '14px'
          }
        }}
      />
      <AppRoutes />
    </>
  );
}

export default App;
