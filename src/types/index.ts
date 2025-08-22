export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export interface Chat {
  id: string;
  title: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  content: string;
  sender_type: 'user' | 'bot';
  user_id: string;
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ChatState {
  chats: Chat[];
  currentChat: Chat | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}