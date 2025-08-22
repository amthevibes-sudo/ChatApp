import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ApolloClient, InMemoryCache, createHttpLink, gql, useQuery, useMutation } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { 
  MessageCircle, 
  Send, 
  Plus, 
  User, 
  Bot, 
  LogOut, 
  Menu, 
  X,
  Eye,
  EyeOff,
  Mail,
  Lock
} from 'lucide-react';

// Nhost Configuration
const NHOST_CONFIG = {
  graphqlUrl: 'https://rqornqrugkynxggxldkh.graphql.ap-south-1.nhost.run/v1',
  authUrl: 'https://rqornqrugkynxggxldkh.auth.ap-south-1.nhost.run/v1',
  n8nWebhook: 'https://himasree.app.n8n.cloud/webhook/chatbot-message'
};

// GraphQL Queries and Mutations
const GET_CHATS = gql`
  query GetChats {
    chats(order_by: { updated_at: desc }) {
      id
      title
      created_at
      updated_at
    }
  }
`;

const GET_MESSAGES = gql`
  query GetMessages($chatId: uuid!) {
    messages(where: { chat_id: { _eq: $chatId } }, order_by: { created_at: asc }) {
      id
      content
      sender_type
      created_at
      user_id
    }
  }
`;

const CREATE_CHAT = gql`
  mutation CreateChat($title: String!) {
    insert_chats_one(object: { title: $title }) {
      id
      title
      created_at
      updated_at
    }
  }
`;

const CREATE_MESSAGE = gql`
  mutation CreateMessage($chatId: uuid!, $content: String!, $senderType: String!) {
    insert_messages_one(object: { 
      chat_id: $chatId, 
      content: $content, 
      sender_type: $senderType 
    }) {
      id
      content
      sender_type
      created_at
      user_id
    }
  }
`;

// Types
interface User {
  id: string;
  email: string;
  displayName?: string;
}

interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  content: string;
  sender_type: 'user' | 'bot';
  created_at: string;
  user_id: string;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
  expiresAt: number;
}

// Apollo Client Setup
const createApolloClient = (accessToken: string | null) => {
  const httpLink = createHttpLink({
    uri: NHOST_CONFIG.graphqlUrl,
  });

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        authorization: accessToken ? `Bearer ${accessToken}` : "",
        'x-hasura-admin-secret': '', // Add if needed
      }
    };
  });

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });
};

// Auth Service
class AuthService {
  static async signUp(email: string, password: string): Promise<{ user: User; session: AuthSession } | { error: string }> {
    try {
      const response = await fetch(`${NHOST_CONFIG.authUrl}/signup/email-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || 'Sign up failed' };
      }

      if (data.session) {
        const session = {
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            displayName: data.session.user.displayName,
          },
          expiresAt: Date.now() + (data.session.accessTokenExpiresIn * 1000),
        };

        localStorage.setItem('nhost_session', JSON.stringify(session));
        return { user: session.user, session };
      }

      return { error: 'No session returned' };
    } catch (error) {
      return { error: 'Network error during sign up' };
    }
  }

  static async signIn(email: string, password: string): Promise<{ user: User; session: AuthSession } | { error: string }> {
    try {
      const response = await fetch(`${NHOST_CONFIG.authUrl}/signin/email-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return { error: data.message || 'Sign in failed' };
      }

      if (data.session) {
        const session = {
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            displayName: data.session.user.displayName,
          },
          expiresAt: Date.now() + (data.session.accessTokenExpiresIn * 1000),
        };

        localStorage.setItem('nhost_session', JSON.stringify(session));
        return { user: session.user, session };
      }

      return { error: 'No session returned' };
    } catch (error) {
      return { error: 'Network error during sign in' };
    }
  }

  static async refreshSession(refreshToken: string): Promise<AuthSession | null> {
    try {
      const response = await fetch(`${NHOST_CONFIG.authUrl}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.session) {
        const session = {
          accessToken: data.session.accessToken,
          refreshToken: data.session.refreshToken,
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            displayName: data.session.user.displayName,
          },
          expiresAt: Date.now() + (data.session.accessTokenExpiresIn * 1000),
        };

        localStorage.setItem('nhost_session', JSON.stringify(session));
        return session;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  static getStoredSession(): AuthSession | null {
    try {
      const stored = localStorage.getItem('nhost_session');
      if (!stored) return null;

      const session = JSON.parse(stored);
      
      // Check if token is expired
      if (session.expiresAt <= Date.now()) {
        return null;
      }

      return session;
    } catch {
      return null;
    }
  }

  static signOut(): void {
    localStorage.removeItem('nhost_session');
  }
}

// Components
const AuthForm: React.FC<{
  onAuth: (user: User, session: AuthSession) => void;
}> = ({ onAuth }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (isSignUp && password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const result = isSignUp 
        ? await AuthService.signUp(email, password)
        : await AuthService.signIn(email, password);

      if ('error' in result) {
        setError(result.error);
      } else {
        onAuth(result.user, result.session);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">ChatBot App</h1>
            <p className="text-gray-600 mt-2">
              {isSignUp ? 'Create your account' : 'Sign in to continue'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatSidebar: React.FC<{
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onCreateChat: () => void;
  user: User;
  onSignOut: () => void;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ chats, selectedChatId, onSelectChat, onCreateChat, user, onSignOut, isOpen, onToggle }) => {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:static inset-y-0 left-0 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-300 ease-in-out z-50 bg-white border-r border-gray-200 w-80 flex flex-col`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-blue-600" />
              </div>
              <span className="font-semibold text-gray-900">ChatBot</span>
            </div>
            <button
              onClick={onToggle}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <button
            onClick={onCreateChat}
            className="w-full bg-blue-600 text-white rounded-lg py-2.5 px-4 hover:bg-blue-700 transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => {
                onSelectChat(chat.id);
                if (window.innerWidth < 1024) onToggle();
              }}
              className={`w-full p-4 text-left hover:bg-gray-50 transition-colors duration-200 border-b border-gray-100 ${
                selectedChatId === chat.id ? 'bg-blue-50 border-r-2 border-r-blue-600' : ''
              }`}
            >
              <div className="font-medium text-gray-900 truncate">{chat.title}</div>
              <div className="text-sm text-gray-500 mt-1">
                {new Date(chat.updated_at).toLocaleDateString()}
              </div>
            </button>
          ))}

          {chats.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No chats yet. Create your first chat to get started!</p>
            </div>
          )}
        </div>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-medium text-gray-900">{user.displayName || 'User'}</div>
                <div className="text-sm text-gray-500 truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const isUser = message.sender_type === 'user';
  
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2 max-w-xs lg:max-w-md`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? 'bg-blue-100 ml-2' : 'bg-gray-100 mr-2'
        }`}>
          {isUser ? (
            <User className="w-4 h-4 text-blue-600" />
          ) : (
            <Bot className="w-4 h-4 text-gray-600" />
          )}
        </div>
        <div
          className={`px-4 py-2 rounded-2xl shadow-sm ${
            isUser 
              ? 'bg-blue-600 text-white rounded-br-sm' 
              : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
          }`}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
          <p className={`text-xs mt-1 ${
            isUser ? 'text-blue-100' : 'text-gray-500'
          }`}>
            {new Date(message.created_at).toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>
      </div>
    </div>
  );
};

const ChatArea: React.FC<{
  selectedChat: Chat | null;
  messages: Message[];
  onSendMessage: (content: string) => void;
  loading: boolean;
  onToggleSidebar: () => void;
}> = ({ selectedChat, messages, onSendMessage, loading, onToggleSidebar }) => {
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (messageInput.trim() && !loading) {
      onSendMessage(messageInput.trim());
      setMessageInput('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!selectedChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Welcome to ChatBot</h2>
          <p className="text-gray-500">Select a chat or create a new one to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={onToggleSidebar}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h2 className="font-semibold text-gray-900">{selectedChat.title}</h2>
            <p className="text-sm text-gray-500">AI Assistant</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="flex items-end space-x-2">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={handleSubmit} className="flex space-x-3">
          <div className="flex-1 relative">
            <textarea
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all duration-200 disabled:opacity-50"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!messageInput.trim() || loading}
            className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [apolloClient, setApolloClient] = useState<ReturnType<typeof createApolloClient> | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [initializing, setInitializing] = useState(true);

  // Initialize auth on app load
  useEffect(() => {
    const initializeAuth = async () => {
      const storedSession = AuthService.getStoredSession();
      
      if (storedSession) {
        // Check if token needs refresh
        const timeUntilExpiry = storedSession.expiresAt - Date.now();
        const needsRefresh = timeUntilExpiry < 300000; // Less than 5 minutes

        if (needsRefresh) {
          const refreshedSession = await AuthService.refreshSession(storedSession.refreshToken);
          if (refreshedSession) {
            setSession(refreshedSession);
            setUser(refreshedSession.user);
          } else {
            AuthService.signOut();
          }
        } else {
          setSession(storedSession);
          setUser(storedSession.user);
        }
      }
      
      setInitializing(false);
    };

    initializeAuth();
  }, []);

  // Setup Apollo Client when session changes
  useEffect(() => {
    if (session) {
      const client = createApolloClient(session.accessToken);
      setApolloClient(client);
    } else {
      setApolloClient(null);
    }
  }, [session]);

  // Load chats when Apollo client is ready
  useEffect(() => {
    if (apolloClient) {
      loadChats();
    }
  }, [apolloClient]);

  // Load messages when chat is selected
  useEffect(() => {
    if (selectedChatId && apolloClient) {
      loadMessages(selectedChatId);
    } else {
      setMessages([]);
    }
  }, [selectedChatId, apolloClient]);

  // Polling for real-time updates
  useEffect(() => {
    if (!selectedChatId || !apolloClient) return;

    const interval = setInterval(() => {
      loadMessages(selectedChatId);
    }, 2000);

    return () => clearInterval(interval);
  }, [selectedChatId, apolloClient]);

  const loadChats = async () => {
    if (!apolloClient) return;

    try {
      const { data } = await apolloClient.query({
        query: GET_CHATS,
        fetchPolicy: 'network-only',
      });

      if (data?.chats) {
        setChats(data.chats);
      }
    } catch (error) {
      console.error('Error loading chats:', error);
    }
  };

  const loadMessages = async (chatId: string) => {
    if (!apolloClient) return;

    try {
      const { data } = await apolloClient.query({
        query: GET_MESSAGES,
        variables: { chatId },
        fetchPolicy: 'network-only',
      });

      if (data?.messages) {
        setMessages(data.messages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const handleAuth = (newUser: User, newSession: AuthSession) => {
    setUser(newUser);
    setSession(newSession);
  };

  const handleSignOut = () => {
    AuthService.signOut();
    setUser(null);
    setSession(null);
    setChats([]);
    setMessages([]);
    setSelectedChatId(null);
  };

  const handleCreateChat = async () => {
    if (!apolloClient) return;

    try {
      const title = `New Chat - ${new Date().toLocaleString()}`;
      console.log('Creating new chat with title:', title);
      
      const { data } = await apolloClient.mutate({
        mutation: CREATE_CHAT,
        variables: { title },
      });

      console.log('Chat creation response:', data);

      if (data?.insert_chats_one) {
        const newChat = data.insert_chats_one;
        setChats(prevChats => [newChat, ...prevChats]);
        setSelectedChatId(newChat.id);
        console.log('New chat created successfully:', newChat);
      } else {
        console.error('No chat data returned from mutation');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      // Show user-friendly error
      alert('Failed to create new chat. Please try again.');
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!selectedChatId || !apolloClient || !session || !user) return;

    setLoading(true);

    try {
      console.log('Sending message:', content, 'to chat:', selectedChatId);
      
      // Save user message
      const { data: userMessageData } = await apolloClient.mutate({
        mutation: CREATE_MESSAGE,
        variables: {
          chatId: selectedChatId,
          content,
          senderType: 'user',
        },
      });

      console.log('User message saved:', userMessageData);

      if (userMessageData?.insert_messages_one) {
        setMessages(prevMessages => [...prevMessages, userMessageData.insert_messages_one]);
      }

      // Call N8N webhook for bot response
      const webhookPayload = {
        action: { name: 'sendMessage' },
        input: {
          chat_id: selectedChatId,
          message: content,
        },
        session_variables: {
          'x-hasura-role': 'user',
          'x-hasura-user-id': user.id,
        },
      };

      console.log('Calling N8N webhook with payload:', webhookPayload);

      const webhookResponse = await fetch(NHOST_CONFIG.n8nWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(webhookPayload),
      });

      console.log('N8N webhook response status:', webhookResponse.status);

      if (webhookResponse.ok) {
        const botResponseData = await webhookResponse.json();
        console.log('Bot response data:', botResponseData);
        const botMessage = botResponseData.response || 'Sorry, I could not process your message.';

        // Save bot message
        const { data: botMessageData } = await apolloClient.mutate({
          mutation: CREATE_MESSAGE,
          variables: {
            chatId: selectedChatId,
            content: botMessage,
            senderType: 'bot',
          },
        });

        console.log('Bot message saved:', botMessageData);

        if (botMessageData?.insert_messages_one) {
          setMessages(prevMessages => [...prevMessages, botMessageData.insert_messages_one]);
        }
      } else {
        console.error('N8N webhook failed with status:', webhookResponse.status);
        const errorText = await webhookResponse.text();
        console.error('N8N webhook error response:', errorText);
        
        // Add fallback bot message
        const { data: errorMessageData } = await apolloClient.mutate({
          mutation: CREATE_MESSAGE,
          variables: {
            chatId: selectedChatId,
            content: 'Sorry, the chatbot service is currently unavailable. Please try again later.',
            senderType: 'bot',
          },
        });

        if (errorMessageData?.insert_messages_one) {
          setMessages(prevMessages => [...prevMessages, errorMessageData.insert_messages_one]);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Add error message
      try {
        const { data: errorMessageData } = await apolloClient.mutate({
          mutation: CREATE_MESSAGE,
          variables: {
            chatId: selectedChatId,
            content: 'Sorry, I encountered an error. Please try again.',
            senderType: 'bot',
          },
        });

        if (errorMessageData?.insert_messages_one) {
          setMessages(prevMessages => [...prevMessages, errorMessageData.insert_messages_one]);
        }
      } catch (saveError) {
        console.error('Error saving error message:', saveError);
      }
    } finally {
      setLoading(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <MessageCircle className="w-8 h-8 text-blue-600" />
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || !session) {
    return <AuthForm onAuth={handleAuth} />;
  }

  const selectedChat = chats.find(chat => chat.id === selectedChatId) || null;

  return (
    <div className="flex h-screen bg-gray-50">
      <ChatSidebar
        chats={chats}
        selectedChatId={selectedChatId}
        onSelectChat={setSelectedChatId}
        onCreateChat={handleCreateChat}
        user={user}
        onSignOut={handleSignOut}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <ChatArea
        selectedChat={selectedChat}
        messages={messages}
        onSendMessage={handleSendMessage}
        loading={loading}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />
    </div>
  );
};

export default App;