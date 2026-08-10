import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { TrialStatusBar } from './TrialStatusBar';

export const MainLayout = () => {
  return (
    <div className="flex h-screen bg-black text-white overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-full overflow-y-auto pb-16 md:pb-0">
        <TrialStatusBar />
        <main className="flex-1 w-full relative">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
};
