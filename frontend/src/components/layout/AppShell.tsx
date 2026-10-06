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
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <Sidebar />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
        <ResumableTutorNotification />
      </main>
      <CommandPalette />
    </div>
  );
}
