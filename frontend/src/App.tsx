import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeManager } from './components/common/ThemeManager';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { Toaster } from './components/ui/Toaster';
import { Spinner } from './components/ui/primitives';
import { useAuth } from './hooks/useAuth';

const PublicHome = lazy(() => import('./pages/PublicHome'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Translate = lazy(() => import('./pages/Translate'));
const Documents = lazy(() => import('./pages/Documents'));
const Memory = lazy(() => import('./pages/Memory'));
const Agents = lazy(() => import('./pages/Agents'));
const Classroom = lazy(() => import('./pages/Classroom'));
const Vision = lazy(() => import('./pages/Vision'));
const Voice = lazy(() => import('./pages/Voice'));
const Settings = lazy(() => import('./pages/Settings'));
const Admin = lazy(() => import('./pages/Admin'));
const TeacherDashboard = lazy(() => import('./pages/TeacherDashboard'));
const ParentDashboard = lazy(() => import('./pages/ParentDashboard'));
const StudyGroups = lazy(() => import('./pages/StudyGroups'));
const Projects = lazy(() => import('./pages/Projects'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Career = lazy(() => import('./pages/Career'));
const Coding = lazy(() => import('./pages/Coding'));
const Whiteboard = lazy(() => import('./pages/Whiteboard'));
const Forum = lazy(() => import('./pages/Forum'));
const Privacy = lazy(() => import('./pages/Privacy'));

function PageLoader() {
  return (
    <div className="flex h-[60vh] items-center justify-center">
      <Spinner size={28} className="text-brand-400" />
    </div>
  );
}

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  const { refresh, token } = useAuth();

  // Re-validate the session on first load if a token exists.
  useEffect(() => {
    if (token) refresh();
  }, []);

  // Prefetch likely next routes after hydration to make navigation instant.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
    const schedule = idle ?? ((cb: () => void) => setTimeout(cb, 0));
    schedule(() => {
      import('./pages/Dashboard');
      import('./pages/Chat');
      import('./pages/Translate');
    });
  }, []);

  return (
    <>
      <ThemeManager />
      <Toaster />
      <Routes>
        <Route
          path="/"
          element={
            <Lazy>
              <PublicHome />
            </Lazy>
          }
        />
        <Route
          path="/login"
          element={
            <Lazy>
              <Login />
            </Lazy>
          }
        />
        <Route
          path="/register"
          element={
            <Lazy>
              <Register />
            </Lazy>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route
            path="/dashboard"
            element={
              <Lazy>
                <Dashboard />
              </Lazy>
            }
          />
          <Route
            path="/chat"
            element={
              <Lazy>
                <Chat />
              </Lazy>
            }
          />
          <Route
            path="/translate"
            element={
              <Lazy>
                <Translate />
              </Lazy>
            }
          />
          <Route
            path="/documents"
            element={
              <Lazy>
                <Documents />
              </Lazy>
            }
          />
          <Route
            path="/memory"
            element={
              <Lazy>
                <Memory />
              </Lazy>
            }
          />
          <Route
            path="/classroom"
            element={
              <Lazy>
                <Classroom />
              </Lazy>
            }
          />
          <Route
            path="/agents"
            element={
              <Lazy>
                <Agents />
              </Lazy>
            }
          />
          <Route
            path="/vision"
            element={
              <Lazy>
                <Vision />
              </Lazy>
            }
          />
          <Route
            path="/voice"
            element={
              <Lazy>
                <Voice />
              </Lazy>
            }
          />
          <Route
            path="/settings"
            element={
              <Lazy>
                <Settings />
              </Lazy>
            }
          />
          <Route
            path="/admin"
            element={
              <Lazy>
                <Admin />
              </Lazy>
            }
          />
          <Route
            path="/teacher"
            element={
              <Lazy>
                <TeacherDashboard />
              </Lazy>
            }
          />
          <Route
            path="/parent"
            element={
              <Lazy>
                <ParentDashboard />
              </Lazy>
            }
          />
          <Route
            path="/study-groups"
            element={
              <Lazy>
                <StudyGroups />
              </Lazy>
            }
          />
          <Route
            path="/projects"
            element={
              <Lazy>
                <Projects />
              </Lazy>
            }
          />
          <Route
            path="/calendar"
            element={
              <Lazy>
                <Calendar />
              </Lazy>
            }
          />
          <Route
            path="/notifications"
            element={
              <Lazy>
                <Notifications />
              </Lazy>
            }
          />
          <Route
            path="/career"
            element={
              <Lazy>
                <Career />
              </Lazy>
            }
          />
          <Route
            path="/coding"
            element={
              <Lazy>
                <Coding />
              </Lazy>
            }
          />
          <Route
            path="/whiteboard"
            element={
              <Lazy>
                <Whiteboard />
              </Lazy>
            }
          />
          <Route
            path="/forum"
            element={
              <Lazy>
                <Forum />
              </Lazy>
            }
          />
          <Route
            path="/privacy"
            element={
              <Lazy>
                <Privacy />
              </Lazy>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </>
  );
}
