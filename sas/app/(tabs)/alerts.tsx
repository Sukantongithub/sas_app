import { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { studentInteractionsAPI } from '@/services/api';

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'conversations' | 'messages'>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  const userId = user?.id;

  useEffect(() => {
    if (userId && token) {
      fetchConversations();
    }
  }, [userId, token]);

  const fetchConversations = async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const data = await studentInteractionsAPI.getConversations(userId, token);
      setConversations(data.conversations || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!token) return;
    try {
      const data = await studentInteractionsAPI.getConversationMessages(conversationId, token);
      setMessages(data.messages || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSelectConversation = (conversation: any) => {
    setSelectedConversation(conversation);
    setView('messages');
    fetchMessages(conversation._id);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || !token) return;

    setSendingMessage(true);
    try {
      await studentInteractionsAPI.sendMessage(selectedConversation._id, messageText, token);
      setMessageText('');
      await fetchMessages(selectedConversation._id);
    } catch (error: any) {
      console.error('Error sending message:', error);
    } finally {
      setSendingMessage(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  if (!user) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {view === 'conversations' ? (
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <ThemedView style={styles.header}>
            <View>
              <ThemedText type="title">Messages</ThemedText>
              {unreadCount > 0 && (
                <ThemedText style={styles.unreadBadge}>
                  {unreadCount} unread
                </ThemedText>
              )}
            </View>
          </ThemedView>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="envelope.open" size={48} color="#999" />
              <ThemedText style={styles.emptyText}>
                No messages yet
              </ThemedText>
            </View>
          ) : (
            <View style={styles.conversationsList}>
              {conversations.map((conversation) => (
                <TouchableOpacity
                  key={conversation._id}
                  onPress={() => handleSelectConversation(conversation)}
                  activeOpacity={0.7}>
                  <ThemedView
                    style={[
                      styles.conversationCard,
                      conversation.unreadCount > 0 && styles.conversationUnread,
                    ]}>
                    <View style={styles.conversationHeader}>
                      <ThemedText type="defaultSemiBold" style={styles.conversationTitle}>
                        {conversation.participantName}
                      </ThemedText>
                      {conversation.unreadCount > 0 && (
                        <View style={styles.unreadBadgeCircle}>
                          <ThemedText style={styles.badgeText}>
                            {conversation.unreadCount}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={styles.lastMessage} numberOfLines={1}>
                      {conversation.lastMessage}
                    </ThemedText>
                    <ThemedText style={styles.timestamp}>
                      {new Date(conversation.lastMessageTime).toLocaleString()}
                    </ThemedText>
                  </ThemedView>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.messageView}>
          {/* Back & Header */}
          <View style={styles.messageHeader}>
            <TouchableOpacity onPress={() => setView('conversations')}>
              <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold">
              {selectedConversation?.participantName}
            </ThemedText>
            <View style={styles.spacer} />
          </View>

          {/* Messages List */}
          <FlatList
            data={messages}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => (
              <View style={[
                styles.messageBubble,
                item.senderId === userId ? styles.myMessage : styles.theirMessage
              ]}>
                <ThemedText style={styles.messageContent}>
                  {item.content}
                </ThemedText>
                <ThemedText style={styles.messageTime}>
                  {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </ThemedText>
              </View>
            )}
            inverted
            style={styles.messagesList}
          />

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              value={messageText}
              onChangeText={setMessageText}
              multiline
              editable={!sendingMessage}
            />
            <TouchableOpacity
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendingMessage}
              style={styles.sendButton}>
              <IconSymbol
                name="paperplane.fill"
                size={20}
                color={messageText.trim() ? Colors[colorScheme ?? 'light'].tint : '#ccc'}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
  },
  unreadBadge: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  conversationsList: {
    padding: 16,
    gap: 8,
  },
  conversationCard: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  conversationUnread: {
    backgroundColor: 'rgba(37, 99, 235, 0.05)',
    borderLeftColor: '#007AFF',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  conversationTitle: {
    fontSize: 15,
  },
  unreadBadgeCircle: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lastMessage: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 4,
  },
  timestamp: {
    fontSize: 11,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 100,
  },
  emptyText: {
    marginTop: 12,
    opacity: 0.6,
    fontSize: 14,
  },
  messageView: {
    flex: 1,
    flexDirection: 'column',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  spacer: {
    flex: 1,
  },
  messagesList: {
    flex: 1,
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  messageContent: {
    color: '#000',
  },
  messageTime: {
    fontSize: 11,
    opacity: 0.6,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    alignItems: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  messageInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.05)',
    maxHeight: 100,
  },
  sendButton: {
    padding: 8,
  },
});
