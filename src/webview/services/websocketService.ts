import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export enum MessageType {
  PRIVATE = 'PRIVATE',
  CLASS_GROUP = 'CLASS_GROUP'
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  receiverId?: number;
  receiverName?: string;
  classroomId?: number;
  content: string;
  type?: MessageType;
  messageType?: MessageType;
  isRead: boolean;
  createdAt?: string;
  sentAt?: string;
}

export interface SendMessageRequest {
  receiverId?: number;
  classroomId?: number;
  content: string;
  type: MessageType;
}

export class WebSocketService {
  private client: Client | null = null;
  private subscriptions: Map<string, StompSubscription> = new Map();
  private connected: boolean = false;
  private reconnectDelay: number = 5000;
  private baseUrl: string;
  private globalMessageListeners: Set<(message: ChatMessage) => void> = new Set();
  
  constructor(baseUrl: string = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Add global message listener (for ChatWindow to receive messages)
   */
  addGlobalMessageListener(listener: (message: ChatMessage) => void): () => void {
    console.log('[WebSocketService] Adding global message listener');
    this.globalMessageListeners.add(listener);
    // Return cleanup function
    return () => {
      console.log('[WebSocketService] Removing global message listener');
      this.globalMessageListeners.delete(listener);
    };
  }
  
  /**
   * Broadcast message to all global listeners
   */
  private broadcastToGlobalListeners(message: ChatMessage): void {
    console.log('[WebSocketService] Broadcasting message to', this.globalMessageListeners.size, 'listeners');
    this.globalMessageListeners.forEach(listener => {
      try {
        listener(message);
      } catch (error) {
        console.error('[WebSocketService] Error in listener:', error);
      }
    });
  }
  
  /**
   * Connect to WebSocket server
   */
  connect(userId: number, token: string, onConnect?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`[WebSocket] 🔗 Attempting to connect to ${this.baseUrl}/ws with userId: ${userId}`);
        console.log(`[WebSocket] 🔗 Token length: ${token?.length}, userId type: ${typeof userId}`);
        
        // Create SockJS socket with JWT token for authentication
        const socket = new SockJS(`${this.baseUrl}/ws?token=${token}`);
        
        socket.onopen = () => {
          console.log('[WebSocket] SockJS connection opened');
        };
        
        socket.onerror = (error: any) => {
          console.error('[WebSocket] SockJS error:', error);
        };
        
        socket.onclose = (event: any) => {
          console.log('[WebSocket] SockJS connection closed:', event);
        };
        
        // Create STOMP client
        this.client = new Client({
          webSocketFactory: () => socket as any,
          connectHeaders: {
            Authorization: `Bearer ${token}`,
            userId: userId.toString()
          },
          debug: (str: string) => {
            console.log('[STOMP]', str);
          },
          reconnectDelay: this.reconnectDelay,
          heartbeatIncoming: 4000,
          heartbeatOutgoing: 4000,
          onConnect: (frame: any) => {
            console.log('[WebSocket] 🎉 STOMP connected successfully!');
            console.log('[WebSocket] 🎉 Frame headers:', frame.headers);
            console.log('[WebSocket] 🎉 Frame object:', frame);
            console.log('[WebSocket] 🎉 Connected userId:', userId);
            console.log('[WebSocket] 🎉 Will subscribe to: /user/' + userId + '/queue/private');
            
            this.connected = true;
            if (onConnect) {
              onConnect();
            }
            resolve();
          },
          onDisconnect: () => {
            console.log('[WebSocket] STOMP disconnected');
            this.connected = false;
            this.subscriptions.clear();
          },
          onStompError: (frame: any) => {
            console.error('[WebSocket] STOMP error:', frame);
            reject(new Error(frame.headers['message'] || 'WebSocket error'));
          }
        });
        
        console.log('[WebSocket] Activating STOMP client...');
        // Activate the client
        this.client.activate();
        
      } catch (error) {
        console.error('[WebSocket] Connection error:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.client) {
      this.subscriptions.forEach((sub) => sub.unsubscribe());
      this.subscriptions.clear();
      this.client.deactivate();
      this.connected = false;
    }
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected && this.client !== null && this.client.connected;
  }
  
  /**
   * Subscribe to private messages
   */
  subscribeToPrivateMessages(userId: number, callback: (message: ChatMessage) => void): (() => void) | undefined {
    if (!this.client || !this.connected) {
      console.error('[WebSocketService] ❌ Cannot subscribe - WebSocket not connected');
      return undefined;
    }
    
    const destination = `/user/${userId}/queue/private`;
    console.log('[WebSocketService] 📥 SUBSCRIBING to:', destination);
    console.log('[WebSocketService] 📥 userId:', userId, '(type:', typeof userId, ')');
    console.log('[WebSocketService] 📥 Expected backend to send to: /user/' + userId + '/queue/private');
    
    // Unsubscribe if already subscribed
    if (this.subscriptions.has(destination)) {
      console.log('[WebSocketService] ⚠️ Already subscribed to', destination, ', unsubscribing first');
      this.subscriptions.get(destination)?.unsubscribe();
    }
    
    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      console.log('[WebSocketService] 📨📨📨 RECEIVED MESSAGE on', destination);
      console.log('[WebSocketService] 📨 Raw message body:', message.body);
      console.log('[WebSocketService] 📨 Message headers:', message.headers);
      try {
        const chatMessage: ChatMessage = JSON.parse(message.body);
        console.log('[WebSocketService] ✅ Parsed message:', chatMessage);
        console.log('[WebSocketService] ✅ Message ID:', chatMessage.id, 'from:', chatMessage.senderId, 'to:', chatMessage.receiverId);
        
        // Call the original callback
        callback(chatMessage);
        
        // ALSO broadcast to all global listeners (e.g., ChatWindow)
        this.broadcastToGlobalListeners(chatMessage);
      } catch (error) {
        console.error('[WebSocketService] ❌ Error parsing private message:', error, message.body);
      }
    });
    
    this.subscriptions.set(destination, subscription);
    console.log('[WebSocketService] ✅✅✅ Subscription CREATED successfully for:', destination);
    console.log('[WebSocketService] ✅ Total subscriptions:', this.subscriptions.size);
    
    // Return unsubscribe function
    return () => {
      console.log('[WebSocketService] Unsubscribing from:', destination);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(destination);
      }
    };
  }
  
  /**
   * Subscribe to class group messages
   */
  subscribeToClassMessages(classroomId: number, callback: (message: ChatMessage) => void): (() => void) | undefined {
    if (!this.client || !this.connected) {
      console.error('[WebSocketService] Cannot subscribe - WebSocket not connected');
      return undefined;
    }
    
    const destination = `/topic/class/${classroomId}`;
    console.log('[WebSocketService] Subscribing to:', destination);
    
    // Unsubscribe if already subscribed
    if (this.subscriptions.has(destination)) {
      console.log('[WebSocketService] Already subscribed to', destination, ', unsubscribing first');
      this.subscriptions.get(destination)?.unsubscribe();
    }
    
    const subscription = this.client.subscribe(destination, (message: IMessage) => {
      console.log('[WebSocketService] 📨 Received class message on', destination);
      try {
        const chatMessage: ChatMessage = JSON.parse(message.body);
        console.log('[WebSocketService] ✅ Parsed class message:', chatMessage);
        callback(chatMessage);
      } catch (error) {
        console.error('[WebSocketService] ❌ Error parsing class message:', error);
      }
    });
    
    this.subscriptions.set(destination, subscription);
    console.log('[WebSocketService] ✅ Class subscription created for:', destination);
    
    // Return unsubscribe function
    return () => {
      console.log('[WebSocketService] Unsubscribing from:', destination);
      if (subscription) {
        subscription.unsubscribe();
        this.subscriptions.delete(destination);
      }
    };
  }
  
  /**
   * Unsubscribe from a destination
   */
  unsubscribe(destination: string): void {
    const subscription = this.subscriptions.get(destination);
    if (subscription) {
      subscription.unsubscribe();
      this.subscriptions.delete(destination);
    }
  }
  
  /**
   * Send private message
   */
  sendPrivateMessage(receiverId: number, content: string): void {
    if (!this.client || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }
    
    const request: SendMessageRequest = {
      receiverId,
      content,
      type: MessageType.PRIVATE
    };
    
    this.client.publish({
      destination: '/app/chat.private',
      body: JSON.stringify(request)
    });
  }
  
  /**
   * Send class group message
   */
  sendClassMessage(classroomId: number, content: string): void {
    if (!this.client || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }
    
    const request: SendMessageRequest = {
      classroomId,
      content,
      type: MessageType.CLASS_GROUP
    };
    
    this.client.publish({
      destination: '/app/chat.class',
      body: JSON.stringify(request)
    });
  }
  
  /**
   * Join a class chat room
   */
  joinClassRoom(classroomId: number): void {
    if (!this.client || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }
    
    this.client.publish({
      destination: '/app/chat.join',
      body: JSON.stringify(classroomId)
    });
  }
}

// Singleton instance
let webSocketServiceInstance: WebSocketService | null = null;

export function getWebSocketService(baseUrl?: string): WebSocketService {
  if (!webSocketServiceInstance) {
    webSocketServiceInstance = new WebSocketService(baseUrl);
  }
  return webSocketServiceInstance;
}
