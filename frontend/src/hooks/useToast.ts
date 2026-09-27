import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { pushToast, type Toast } from '../store/uiSlice';

export function useToast() {
  const dispatch = useAppDispatch();
  const reducedMotion = useAppSelector((s) => s.ui.reducedMotion);

  const toast = useCallback(
    (payload: Omit<Toast, 'id'>) => {
      dispatch(pushToast(payload));
    },
    [dispatch],
  );

  return { toast, reducedMotion };
}
