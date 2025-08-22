import React from 'react';
import { Plus, MessageCircle, LogOut, User } from 'lucide-react';
import { Chat } from '../types';

interface ChatSidebarProps {
  chats: Chat[];
  currentChat: Chat | null;
  onChatSelect: (chat: Chat) => void;
  onNewChat: () => void;
  onSignOut: () => void;
  userEmail: string;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  currentChat,
  onChatSelect,
  onNewChat,
  onSignOut,
  userEmail,
  isOpen,
  onClose,
}) => {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed lg:relative inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200">
            <button
              onClick={onNewChat}
              className="w-full bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              New Chat
            </button>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-2">
              {chats.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No chats yet</p>
                  <p className="text-sm">Start a new conversation</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {chats.map((chat) => (
                    <button
                      key={chat.id}
                      onClick={() => {
                        onChatSelect(chat);
                        onClose();
                      }}
                      className={`w-full text-left p-3 rounded-lg transition-colors ${
                        currentChat?.id === chat.id
                          ? 'bg-indigo-50 border border-indigo-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {chat.title}
                          </p>
                          <p className="text-sm text-gray-500">
                            {new Date(chat.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* User Profile */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {userEmail}
                </p>
              </div>
            </div>
            <button
              onClick={onSignOut}
              className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};