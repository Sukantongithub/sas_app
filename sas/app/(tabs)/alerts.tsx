import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, TextInput } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { studentInteractionsAPI } from '@/services/api';
import CommonHeader from '@/components/CommonHeader';

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
        <>
          <CommonHeader title="Messages" />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="envelope.open" size={48} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>No messages yet</ThemedText>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              renderItem={({ item: conversation }) => (
                <TouchableOpacity
                  onPress={() => handleSelectConversation(conversation)}
                  activeOpacity={0.7}>
                  <ThemedView style={[styles.conversationCard, { marginHorizontal: 16 }, conversation.unreadCount > 0 && styles.conversationUnread]}>
                    <View style={styles.conversationHeader}>
                      <View style={{ flex: 1 }}>
                        <ThemedText type="defaultSemiBold" style={styles.conversationTitle}>
                          {conversation.participantName}
                        </ThemedText>
                        <ThemedText style={styles.lastMessage} numberOfLines={1}>
                          {conversation.lastMessage}
                        </ThemedText>
                      </View>
                      {conversation.unreadCount > 0 && (
                        <View style={styles.unreadBadgeCircle}>
                          <ThemedText style={styles.badgeText}>
                            {conversation.unreadCount}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                    <ThemedText style={styles.timestamp}>
                      {new Date(conversation.lastMessageTime).toLocaleString()}
                    </ThemedText>
                  </ThemedView>
                </TouchableOpacity>
              )}
            />
          )}
        </>
      ) : (
        <View style={styles.messageView}>
          {/* Message Header */}
          <View style={styles.messageHeader}>
            <TouchableOpacity onPress={() => setView('conversations')} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={styles.messageHeaderTitle}>
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
            contentContainerStyle={styles.messagesList}
          />

          {/* Message Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              placeholder="Type a message..."
              placeholderTextColor="#999"
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
                size={18}
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
  badgeHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  badgeHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  badgeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeHeaderTitle: {
    marginBottom: 2,
  },
  badgeHeaderSubtitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  unreadBadge: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  listContent: {
    paddingTop: 8,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationCard: {
    marginBottom: 8,
    marginTop: 2,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 11,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  conversationUnread: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderLeftColor: '#007AFF',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  unreadBadgeCircle: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  lastMessage: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
    marginRight: 24,
  },
  timestamp: {
    fontSize: 10,
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    gap: 12,
  },
  emptyText: {
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  messageHeaderTitle: {
    fontSize: 16,
  },
  spacer: {
    flex: 1,
  },
  messagesList: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
  },
  messageContent: {
    color: '#000',
    fontSize: 14,
  },
  messageTime: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'flex-end',
  },
  messageInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    maxHeight: 80,
    fontSize: 14,
    color: '#000',
  },
  sendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
