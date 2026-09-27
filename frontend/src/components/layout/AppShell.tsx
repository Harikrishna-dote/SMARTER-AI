import { Outlet, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { ResumableTutorNotification } from '../common/ResumableTutorNotification';
import { useAppDispatch } from '../../store';
import { setSidebar } from '../../store/uiSlice';

export function AppShell() {
  const dispatch = useAppDispatch();
  const location = useLocation();

  // Close mobile sidebar on route change for a clean, app-like feel.
  useEffect(() => {
    dispatch(setSidebar(false));
  }, [location.pathname, dispatch]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="no-scrollbar flex-1 overflow-y-auto">
        <div className="h-full w-full">
          <Outlet />
        </div>
        <ResumableTutorNotification />
      </main>
    </div>
  );
}
