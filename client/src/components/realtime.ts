import { WebSocket } from 'ws';

// Store WebSocket connections for real-time updates
// Map: sessionId -> { socket: WebSocket, userId: string }
export const connectedUsers = new Map<string, { socket: WebSocket; userId: string }>();

// Helper function to send real-time updates to a user
export function sendRealtimeUpdate(userId: string, update: any) {
  let messagesSent = 0;
  
  // Find ALL sessions for this user and send to each one
  for (const [sessionId, connection] of connectedUsers.entries()) {
    if (connection.userId === userId && connection.socket.readyState === WebSocket.OPEN) {
      try {
        connection.socket.send(JSON.stringify(update));
        messagesSent++;
        console.log(`📤 Sent update to user ${userId}, session ${sessionId}`);
      } catch (error) {
        console.error(`❌ Failed to send update to user ${userId}, session ${sessionId}:`, error);
        // Remove dead connection
        connectedUsers.delete(sessionId);
      }
    }
  }
  
  console.log(`📊 Sent real-time update to ${messagesSent} sessions for user ${userId}`);
  return messagesSent > 0;
}
