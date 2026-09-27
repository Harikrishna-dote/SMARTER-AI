import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { ClassroomConfig } from '../lib/types';

interface ClassroomState {
  autonomousSessionId: string | null;
  config: ClassroomConfig | null;
  activeClassroomId: string | null;
}

const initialState: ClassroomState = {
  autonomousSessionId: null,
  config: null,
  activeClassroomId: null,
};

const classroomSlice = createSlice({
  name: 'classroom',
  initialState,
  reducers: {
    setAutonomousSession: (state, action: PayloadAction<{ id: string; config: ClassroomConfig }>) => {
      state.autonomousSessionId = action.payload.id;
      state.config = action.payload.config;
      state.activeClassroomId = action.payload.id;
    },
    clearAutonomousSession: (state) => {
      state.autonomousSessionId = null;
      state.config = null;
      state.activeClassroomId = null;
    },
    setActiveClassroomId: (state, action: PayloadAction<string | null>) => {
      state.activeClassroomId = action.payload;
    },
  },
});

export const { setAutonomousSession, clearAutonomousSession, setActiveClassroomId } = classroomSlice.actions;
export default classroomSlice.reducer;
