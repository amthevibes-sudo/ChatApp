import React, { useState, useEffect } from 'react';
import { NhostProvider } from '@nhost/react';
import nhost from './services/nhost';
import { apiService } from './services/api';
import { AuthForm } from './components/AuthForm';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatArea } from './components/ChatArea';
import { Chat, Message, User } from './types';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Check authentication status on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = nhost.auth.getSession();
        if (session) {
          const nhostUser = nhost.auth.getUser();
          if (nhostUser) {
            setUser({
              id: nhostUser.id,
              email: nhostUser.email || '',
              displayName: nhostUser.displayName || undefined,
              avatarUrl: nhostUser.avatarUrl || undefined,
            });
            setIsAuthenticated(true);
            await loadChats();
          }
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Poll for new messages every 2 seconds
  useEffect(() => {
    if (!currentChat || !isAuthenticated) return;

    const interval = setInterval(async () => {
      try {
        const latestMessages = await apiService.getMessages(currentChat.id);
        setMessages(latestMessages);
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [currentChat, isAuthenticated]);

  const loadChats = async () => {
    try {
      const userChats = await apiService.getChats();
      setChats(userChats);
    } catch (error) {
      console.error('Failed to load chats:', error);
    }
  };

  const handleAuthSuccess = async () => {
    const nhostUser = nhost.auth.getUser();
    if (nhostUser) {
      setUser({
        id: nhostUser.id,
        email: nhostUser.email || '',
        displayName: nhostUser.displayName || undefined,
        avatarUrl: nhostUser.avatarUrl || undefined,
      });
      setIsAuthenticated(true);
      await loadChats();
    }
  };

  const handleSignOut = async () => {
    await nhost.auth.signOut();
    setUser(null);
    setIsAuthenticated(false);
    setChats([]);
    setCurrentChat(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const handleNewChat = async () => {
    try {
      const title = `Chat ${new Date().toLocaleDateString()}`;
      const newChat = await apiService.createChat(title);
      setChats([newChat, ...chats]);
      setCurrentChat(newChat);
      setMessages([]);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
  };

  const handleChatSelect = async (chat: Chat) => {
    setCurrentChat(chat);
    try {
      const chatMessages = await apiService.getMessages(chat.id);
      setMessages(chatMessages);
    } catch (error) {
      console.error('Failed to load messages:', error);
      setMessages([]);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!currentChat || isSendingMessage) return;

    setIsSendingMessage(true);
    try {
      // Send user message
      const userMessage = await apiService.sendMessage(currentChat.id, content);
      setMessages(prev => [...prev, userMessage]);

      // Update chat timestamp
      await apiService.updateChatTimestamp(currentChat.id);

      // Send to chatbot
      await apiService.sendToChatbot(currentChat.id, content);

      // Refresh chats to update order
      await loadChats();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <NhostProvider nhost={nhost}>
        <AuthForm onAuthSuccess={handleAuthSuccess} />
      </NhostProvider>
    );
  }

  return (
    <NhostProvider nhost={nhost}>
      <div className="h-screen bg-gray-100 flex">
        <ChatSidebar
          chats={chats}
          currentChat={currentChat}
          onChatSelect={handleChatSelect}
          onNewChat={handleNewChat}
          onSignOut={handleSignOut}
          userEmail={user?.email || ''}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />
        
        <ChatArea
          currentChat={currentChat}
          messages={messages}
          onSendMessage={handleSendMessage}
          isLoading={isSendingMessage}
          onToggleSidebar={() => setIsSidebarOpen(true)}
        />
      </div>
    </NhostProvider>
  );
}

export default App;