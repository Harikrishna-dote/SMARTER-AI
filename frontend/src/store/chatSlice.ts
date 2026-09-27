import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Conversation } from '../lib/types';

interface ChatState {
  conversations: Conversation[];
  loading: boolean;
  activeConversationId: string | null;
}

const initialState: ChatState = {
  conversations: [],
  loading: false,
  activeConversationId: null,
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    setConversations: (state, action: PayloadAction<Conversation[]>) => {
      state.conversations = action.payload;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setActiveConversationId: (state, action: PayloadAction<string | null>) => {
      state.activeConversationId = action.payload;
    },
    removeConversation: (state, action: PayloadAction<string>) => {
      state.conversations = state.conversations.filter(c => c.id !== action.payload);
      if (state.activeConversationId === action.payload) {
        state.activeConversationId = null;
      }
    },
    addConversation: (state, action: PayloadAction<Conversation>) => {
        state.conversations.unshift(action.payload);
    }
  },
});

export const { setConversations, setLoading, setActiveConversationId, removeConversation, addConversation } = chatSlice.actions;
export default chatSlice.reducer;
