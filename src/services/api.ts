import nhost from './nhost';
import { Chat, Message } from '../types';

const GRAPHQL_URL = 'https://rqornqrugkynxggxldkh.graphql.ap-south-1.nhost.run/v1';
const N8N_WEBHOOK = 'https://himasree.app.n8n.cloud/webhook/chatbot-message';

class ApiService {
  private async graphqlRequest(query: string, variables: any = {}) {
    const token = nhost.auth.getAccessToken();
    
    const response = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const result = await response.json();
    
    if (result.errors) {
      throw new Error(result.errors[0].message);
    }
    
    return result.data;
  }

  async getChats(): Promise<Chat[]> {
    const query = `
      query GetChats {
        chats(order_by: {updated_at: desc}) {
          id
          title
          user_id
          created_at
          updated_at
        }
      }
    `;
    
    const data = await this.graphqlRequest(query);
    return data.chats;
  }

  async createChat(title: string): Promise<Chat> {
    const query = `
      mutation CreateChat($title: String!) {
        insert_chats_one(object: {title: $title}) {
          id
          title
          user_id
          created_at
          updated_at
        }
      }
    `;
    
    const data = await this.graphqlRequest(query, { title });
    return data.insert_chats_one;
  }

  async getMessages(chatId: string): Promise<Message[]> {
    const query = `
      query GetMessages($chatId: uuid!) {
        messages(where: {chat_id: {_eq: $chatId}}, order_by: {created_at: asc}) {
          id
          chat_id
          content
          sender_type
          user_id
          created_at
        }
      }
    `;
    
    const data = await this.graphqlRequest(query, { chatId });
    return data.messages;
  }

  async sendMessage(chatId: string, content: string): Promise<Message> {
    const query = `
      mutation SendMessage($chatId: uuid!, $content: String!) {
        insert_messages_one(object: {
          chat_id: $chatId,
          content: $content,
          sender_type: "user"
        }) {
          id
          chat_id
          content
          sender_type
          user_id
          created_at
        }
      }
    `;
    
    const data = await this.graphqlRequest(query, { chatId, content });
    return data.insert_messages_one;
  }

  async sendToChatbot(chatId: string, message: string): Promise<void> {
    const user = nhost.auth.getUser();
    
    const payload = {
      action: { name: "sendMessage" },
      input: { chat_id: chatId, message },
      session_variables: {
        "x-hasura-role": "user",
        "x-hasura-user-id": user?.id || ""
      }
    };

    await fetch(N8N_WEBHOOK, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  }

  async updateChatTimestamp(chatId: string): Promise<void> {
    const query = `
      mutation UpdateChat($chatId: uuid!) {
        update_chats_by_pk(pk_columns: {id: $chatId}, _set: {updated_at: "now()"}) {
          id
        }
      }
    `;
    
    await this.graphqlRequest(query, { chatId });
  }
}

export const apiService = new ApiService();