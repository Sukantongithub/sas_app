import { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, TextInput, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { messagingAPI } from '@/services/api';
import CommonHeader from '@/components/CommonHeader';

const STAFF_ROLES: Set<string> = new Set(['staff', 'hod', 'teacher', 'faculty', 'hr']);

function isStaffRole(role?: string) {
  return role ? STAFF_ROLES.has(String(role).toLowerCase()) : false;
}

interface StaffMember {
  _id: string;
  name: string;
  email?: string;
  role?: string;
}

export default function MessagesScreen() {
  const colorScheme = useColorScheme();
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<'conversations' | 'messages' | 'compose'>('conversations');
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  
  // Compose view states
  const [searchQuery, setSearchQuery] = useState('');
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<Set<string>>(new Set());
  const [composingMessage, setComposingMessage] = useState('');
  const [sendingBulk, setSendingBulk] = useState(false);
  const [loadingStaff, setLoadingStaff] = useState(false);

  const userId = user?.id || user?._id || user?.userId;
  const messagesRef = useRef<FlatList>(null);
  const loggedMessagesRef = useRef<Set<string>>(new Set());

  // Debug: Log user object structure on mount
  useEffect(() => {
    if (user) {
      console.log('[MESSAGES] USER OBJECT:', user);
      console.log('[MESSAGES] USER KEYS:', Object.keys(user));
      console.log('[MESSAGES] userId from user.id:', user?.id);
      console.log('[MESSAGES] Alternative user._id:', user?._id);
      console.log('[MESSAGES] Alternative user.userId:', user?.userId);
    }
  }, [user]);

  const fetchConversations = useCallback(async () => {
    console.log('[MESSAGES] fetchConversations called with userId:', userId, 'token exists:', !!token);
    if (!userId || !token) {
      console.log('[MESSAGES] fetchConversations skipped - missing userId or token');
      return;
    }
    setLoading(true);
    try {
      console.log('[MESSAGES] Calling messagingAPI.getConversations...');
      const raw = await messagingAPI.getConversations(userId, undefined, token);
      console.log('[MESSAGES] API response received:', raw);
      // sendSuccess wraps: { success, data: { conversations: [...] }, message }
      const allConversations = raw?.data?.conversations ?? raw?.conversations ?? [];
      console.log('[MESSAGES] Setting conversations:', allConversations.length, 'conversations');
      setConversations(allConversations);
    } catch (error: any) {
      console.error('[MESSAGES] Error fetching conversations:', error);
      Alert.alert('Error', `Failed to load conversations: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [userId, token]);

  useEffect(() => {
    console.log('[MESSAGES] useEffect hook - userId:', userId, 'token exists:', !!token);
    if (userId && token) {
      console.log('[MESSAGES] useEffect calling fetchConversations');
      fetchConversations();
    }
  }, [userId, token]);

  const fetchStaffMembers = useCallback(async () => {
    console.log('[MESSAGES] fetchStaffMembers called, token exists:', !!token);
    if (!token) return;
    setLoadingStaff(true);
    try {
      // Call the real API to get all messageable users (not just from existing conversations)
      console.log('[MESSAGES] Calling messagingAPI.getMessageableUsers...');
      const raw = await messagingAPI.getMessageableUsers(undefined, token);
      console.log('[MESSAGES] Staff members response:', raw);
      const users: StaffMember[] = raw?.data ?? raw ?? [];
      console.log('[MESSAGES] Found', Array.isArray(users) ? users.length : 0, 'staff members');
      setAvailableStaff(Array.isArray(users) ? users : []);
    } catch (error) {
      console.error('[MESSAGES] Error fetching staff members:', error);
      setAvailableStaff([]);
    } finally {
      setLoadingStaff(false);
    }
  }, [token]);

  const fetchMessages = useCallback(async (conversationId: string) => {
    console.log('[MESSAGES] fetchMessages called for conversation:', conversationId, 'token exists:', !!token);
    if (!token) return;
    setLoading(true);
    try {
      console.log('[MESSAGES] Calling messagingAPI.getConversationMessages...');
      const raw = await messagingAPI.getConversationMessages(conversationId, undefined, undefined, token);
      console.log('[MESSAGES] Messages response:', raw);
      const msgs = raw?.data?.messages ?? raw?.messages ?? [];
      console.log('[MESSAGES] Setting', msgs.length, 'messages');
      if (msgs.length > 0) {
        console.log('[MESSAGES] First message structure:', msgs[0]);
        console.log('[MESSAGES] Message keys:', Object.keys(msgs[0]));
      }
      setMessages(msgs);
      loggedMessagesRef.current.clear();
      // Scroll to bottom after messages load
      setTimeout(() => {
        messagesRef.current?.scrollToEnd({ animated: false });
      }, 100);
    } catch (error: any) {
      console.error('[MESSAGES] Error fetching messages:', error);
      Alert.alert('Error', `Failed to load messages: ${error?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const handleSelectConversation = (conversation: any) => {
    // Ensure conversation has participantId for message detection
    const enrichedConversation = {
      ...conversation,
      participantId: conversation.participantId || conversation.otherParticipantId || conversation.recipientUserId || conversation.userId,
    };
    console.log('[MESSAGES] ===== OPENED CONVERSATION =====');
    console.log('[MESSAGES] Current userId:', userId);
    console.log('[MESSAGES] Selected conversation:', { name: conversation.participantName, keys: Object.keys(conversation), enrichedParticipantId: enrichedConversation.participantId });
    setSelectedConversation(enrichedConversation);
    setView('messages');
    fetchMessages(conversation._id);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || !token) return;

    const recipientId =
      selectedConversation?.participantId ||
      selectedConversation?.otherParticipantId ||
      selectedConversation?.recipientId;

    if (!recipientId) {
      Alert.alert('Error', 'Unable to identify recipient. Please try again.');
      return;
    }

    setSendingMessage(true);
    try {
      await messagingAPI.sendMessage(recipientId, messageText, undefined, token);
      setMessageText('');
      // Refresh messages after short delay to ensure message is persisted
      setTimeout(async () => {
        try {
          await fetchMessages(selectedConversation._id);
          // Scroll to bottom to show new message
          setTimeout(() => {
            messagesRef.current?.scrollToEnd({ animated: true });
          }, 100);
        } catch {
          console.warn('Could not refresh messages after send');
        }
      }, 300);
    } catch (error: any) {
      console.error('Error sending message:', error?.message || error);
      const errorMsg = error?.response?.data?.message || error?.message || 'Failed to send message. Please try again.';
      Alert.alert('Send Error', errorMsg);
      // Still try to refresh to show sent message even if notification fails
      try {
        await fetchMessages(selectedConversation._id);
      } catch (e) {
        console.warn('Could not refresh messages:', e);
      }
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendBulkMessage = async () => {
    if (!composingMessage.trim() || selectedStaff.size === 0 || !token) return;

    setSendingBulk(true);
    const staffIds = Array.from(selectedStaff);
    let successCount = 0;
    let failureCount = 0;

    try {
      // Send message to each selected staff member
      for (const staffId of staffIds) {
        try {
          await messagingAPI.sendMessage(staffId, composingMessage, undefined, token);
          successCount++;
        } catch (error) {
          console.error(`Error sending message to staff ${staffId}:`, error);
          failureCount++;
        }
      }

      // Show result and refresh
      if (successCount > 0) {
        setComposingMessage('');
        setSelectedStaff(new Set());
        setView('conversations');
        await fetchConversations();
      }

      // Show status message
      if (successCount > 0 && failureCount === 0) {
        Alert.alert('Success', `Message sent to ${successCount} staff member${successCount > 1 ? 's' : ''}`);
      } else if (successCount > 0 && failureCount > 0) {
        Alert.alert('Partial Success', `Sent to ${successCount} staff, failed for ${failureCount}. Please try again for failed recipients.`);
      } else if (failureCount > 0) {
        Alert.alert('Error', 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Error in bulk message send:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSendingBulk(false);
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    const newSelected = new Set(selectedStaff);
    if (newSelected.has(staffId)) {
      newSelected.delete(staffId);
    } else {
      newSelected.add(staffId);
    }
    setSelectedStaff(newSelected);
  };

  const handleOpenCompose = async () => {
    setView('compose');
    await fetchStaffMembers();
  };

  const filteredStaff = availableStaff.filter(staff =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    staff.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  };

  if (!user || !token) {
    console.log('[MESSAGES] Render - Not authenticated. user:', user?.email, 'token:', !!token);
    return (
      <ThemedView style={styles.container}>
        <CommonHeader title="Messages" />
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyText}>Please log in to access messages</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!userId) {
    console.log('[MESSAGES] Render - No userId available');
    return (
      <ThemedView style={styles.container}>
        <CommonHeader title="Messages" />
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyText}>Unable to load user information</ThemedText>
        </View>
      </ThemedView>
    );
  }

  console.log('[MESSAGES] Render - Main view with view state:', view, 'userId:', userId);

  return (
    <ThemedView style={styles.container}>
      {view === 'conversations' ? (
        <>
          <CommonHeader title="Messages" />
          
          {/* New Message Button */}
          <TouchableOpacity
            onPress={handleOpenCompose}
            style={[styles.newMessageButton, { marginHorizontal: 16, marginTop: 12 }]}>
            <IconSymbol name="square.and.pencil" size={16} color="#fff" />
            <ThemedText style={styles.newMessageButtonText}>New Message</ThemedText>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="envelope.open" size={48} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>No staff messages yet</ThemedText>
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
      ) : view === 'messages' ? (
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

          {/* Messages List
            LOGIC EXPLANATION:
            - Backend sends messages with senderId as an OBJECT: { _id: string, name, email, role }
            - We extract senderId._id and compare with current user's userId
            - If they match → It's MY message (display right side, blue)
            - If they DON'T match → It's RECEIVED (display left side, gray)
          */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : (
            <FlatList
              ref={messagesRef}
              data={messages}
              keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              // senderId comes as populated object: { _id, name, email, role }
              // We need to extract _id and compare with current userId
              const senderId = String(item.senderId?._id || item.senderId || '').trim();
              const currentUserId = String(userId || '').trim();
              
              // It's my message if senderId matches current userId
              const isMyMessage = senderId && currentUserId && senderId === currentUserId;
              
              // Debug logging (using ref instead of window object for React Native compatibility)
              if (!loggedMessagesRef.current.has(item._id)) {
                console.log('[MESSAGES] ===== MESSAGE DEBUG =====');
                console.log('[MESSAGES] Message ID:', item._id);
                console.log('[MESSAGES] Full senderId object:', item.senderId);
                console.log('[MESSAGES] Extracted senderId:', senderId);
                console.log('[MESSAGES] Current userId:', currentUserId);
                console.log('[MESSAGES] Match?:', senderId === currentUserId);
                console.log('[MESSAGES] Result:', isMyMessage ? 'MY MESSAGE (RIGHT)' : 'RECEIVED (LEFT)');
                console.log('[MESSAGES] Content:', item.content?.substring(0, 40));
                loggedMessagesRef.current.add(item._id);
              }
              
              return (
                <View style={[
                  styles.messageRow,
                  isMyMessage ? styles.messageRowRight : styles.messageRowLeft
                ]}>
                  <View style={[
                    styles.messageBubble,
                    isMyMessage ? styles.myMessage : styles.theirMessage
                  ]}>
                    <ThemedText 
                      style={styles.messageContent}
                      lightColor={isMyMessage ? '#fff' : '#000'}
                      darkColor={isMyMessage ? '#fff' : '#e0e0e0'}
                    >
                      {item.content}
                    </ThemedText>
                    <ThemedText 
                      style={styles.messageTime}
                      lightColor={isMyMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'}
                      darkColor={isMyMessage ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.5)'}
                    >
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </ThemedText>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={styles.messagesList}
            scrollEnabled={true}
          />
          )}

          {/* Message Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.inputContainer}>
            <TextInput
              style={[
                styles.messageInput,
                {
                  color: Colors[colorScheme ?? 'light'].text,
                  backgroundColor: Colors[colorScheme ?? 'light'].cardBackground
                }
              ]}
              placeholder="Type a message..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
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
          </KeyboardAvoidingView>
        </View>
      ) : (
        <View style={styles.messageView}>
          {/* Compose Header */}
          <View style={styles.messageHeader}>
            <TouchableOpacity onPress={() => setView('conversations')} style={styles.backButton}>
              <IconSymbol name="chevron.left" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            </TouchableOpacity>
            <ThemedText type="defaultSemiBold" style={styles.messageHeaderTitle}>
              New Message
            </ThemedText>
            <View style={styles.spacer} />
          </View>

          {/* Search Bar */}
          <View style={[
            styles.searchContainer,
            {
              backgroundColor: Colors[colorScheme ?? 'light'].cardBackground,
              marginHorizontal: 12,
              marginTop: 12
            }
          ]}>
            <IconSymbol name="magnifyingglass" size={16} color={Colors[colorScheme ?? 'light'].tabIconDefault} />
            <TextInput
              style={[
                styles.searchInput,
                { color: Colors[colorScheme ?? 'light'].text }
              ]}
              placeholder="Search staff..."
              placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Staff List */}
          {loadingStaff ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors[colorScheme ?? 'light'].tint} />
            </View>
          ) : availableStaff.length === 0 ? (
            <View style={styles.emptyState}>
              <IconSymbol name="person.crop.circle.badge.xmark" size={48} color={Colors[colorScheme ?? 'light'].text} />
              <ThemedText style={styles.emptyText}>No staff members found</ThemedText>
            </View>
          ) : (
            <FlatList
              data={filteredStaff}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item: staff }) => (
                <TouchableOpacity
                  onPress={() => toggleStaffSelection(staff._id)}
                  style={[styles.staffSelectItem, { marginHorizontal: 12 }]}
                  activeOpacity={0.7}>
                  <View style={[
                    styles.checkbox,
                    selectedStaff.has(staff._id) && styles.checkboxSelected
                  ]}>
                    {selectedStaff.has(staff._id) && (
                      <IconSymbol name="checkmark" size={14} color="#fff" />
                    )}
                  </View>
                  <View style={styles.staffInfo}>
                    <ThemedText type="defaultSemiBold">{staff.name}</ThemedText>
                    {staff.email && <ThemedText style={styles.staffEmail}>{staff.email}</ThemedText>}
                    {staff.role && <ThemedText style={styles.staffRole}>{staff.role}</ThemedText>}
                  </View>
                </TouchableOpacity>
              )}
            />
          )}

          {/* Compose Message Area */}
          {selectedStaff.size > 0 && (
            <>
              {/* Selected Staff Count */}
              <View style={[styles.selectedCountBadge, { marginHorizontal: 16, marginTop: 12 }]}>
                <ThemedText style={styles.selectedCountText}>
                  {selectedStaff.size} staff selected
                </ThemedText>
              </View>

              {/* Message Input */}
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.composeInputContainer}>
                <TextInput
                  style={[
                    styles.composeInput,
                    {
                      color: Colors[colorScheme ?? 'light'].text,
                      backgroundColor: Colors[colorScheme ?? 'light'].cardBackground
                    }
                  ]}
                  placeholder="Type your message..."
                  placeholderTextColor={Colors[colorScheme ?? 'light'].tabIconDefault}
                  value={composingMessage}
                  onChangeText={setComposingMessage}
                  multiline
                  editable={!sendingBulk}
                />
                <TouchableOpacity
                  onPress={handleSendBulkMessage}
                  disabled={!composingMessage.trim() || sendingBulk}
                  style={styles.sendButton}>
                  {sendingBulk ? (
                    <ActivityIndicator size="small" color={Colors[colorScheme ?? 'light'].tint} />
                  ) : (
                    <IconSymbol
                      name="paperplane.fill"
                      size={18}
                      color={composingMessage.trim() ? Colors[colorScheme ?? 'light'].tint : '#ccc'}
                    />
                  )}
                </TouchableOpacity>
              </KeyboardAvoidingView>
            </>
          )}
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
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  messageRow: {
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  messageRowLeft: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
  },
  messageRowRight: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  myMessage: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  theirMessage: {
    backgroundColor: 'rgba(128, 128, 128, 0.15)',
    borderBottomLeftRadius: 4,
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 6,
    opacity: 0.8,
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
    maxHeight: 80,
    fontSize: 14,
  },
  sendButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newMessageButton: {
    flexDirection: 'row',
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  newMessageButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  staffSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(128, 128, 128, 0.08)',
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  staffInfo: {
    flex: 1,
  },
  staffEmail: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  staffRole: {
    fontSize: 11,
    opacity: 0.5,
    marginTop: 2,
  },
  selectedCountBadge: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  composeInputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    alignItems: 'flex-end',
  },
  composeInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 14,
  },
});
