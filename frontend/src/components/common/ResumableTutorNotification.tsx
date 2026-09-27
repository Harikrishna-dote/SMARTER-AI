import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import { Sparkles } from 'lucide-react';

export function ResumableTutorNotification() {
  const { autonomousSessionId, config, activeClassroomId } = useSelector((state: RootState) => state.classroom);
  const navigate = useNavigate();

  // If there's an autonomous session that isn't the active one (if we're in classroom already), show it
  if (!autonomousSessionId || activeClassroomId === autonomousSessionId) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => navigate(`/classroom`)}
        className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-white p-3 shadow-lg hover:bg-emerald-50 dark:bg-[#202123] dark:hover:bg-[#2f3036]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-600 text-white">
          <Sparkles size={20} />
        </span>
        <div className="text-left">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Continue Class</p>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{config?.topic || 'Running lesson'}</p>
        </div>
      </button>
    </div>
  );
}
