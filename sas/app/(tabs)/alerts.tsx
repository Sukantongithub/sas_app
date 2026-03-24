import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList, TextInput, ScrollView, Modal } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/AuthContext';
import { messagingAPI } from '@/services/api';
import CommonHeader from '@/components/CommonHeader';

const STAFF_ROLES = new Set(['staff', 'hod', 'teacher', 'faculty', 'hr']);

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
  const [unreadCount, setUnreadCount] = useState(0);
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

  const userId = user?.id;

  useEffect(() => {
    if (userId && token) {
      fetchConversations();
    }
  }, [userId, token]);

  const fetchStaffMembers = async () => {
    if (!token) return;
    setLoadingStaff(true);
    try {
      // Extract unique staff from conversations and try to build a list
      const conversationStaff = conversations.map(conv => ({
        _id: conv.participantId || conv.otherParticipantId,
        name: conv.participantName,
        role: conv.participantRole
      })).filter(staff => staff._id && staff.name);

      // Remove duplicates
      const uniqueStaff = Array.from(
        new Map(conversationStaff.map(staff => [staff._id, staff])).values()
      );

      setAvailableStaff(uniqueStaff);
    } catch (error) {
      console.error('Error fetching staff members:', error);
    } finally {
      setLoadingStaff(false);
    }
  };

  const fetchConversations = async () => {
    if (!userId || !token) return;
    setLoading(true);
    try {
      const data = await messagingAPI.getConversations(userId, undefined, token);
      const allConversations = data?.conversations || [];
      const staffConversations = allConversations.filter((item: any) => isStaffRole(item?.participantRole));
      setConversations(staffConversations);
      const unread = staffConversations.reduce((sum: number, item: any) => sum + Number(item?.unreadCount || 0), 0);
      setUnreadCount(unread);
    } catch (error: any) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    if (!token) return;
    try {
      const data = await messagingAPI.getConversationMessages(conversationId, undefined, undefined, token);
      setMessages(data.messages || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSelectConversation = (conversation: any) => {
    if (!isStaffRole(conversation?.participantRole)) {
      return;
    }
    setSelectedConversation(conversation);
    setView('messages');
    fetchMessages(conversation._id);
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedConversation || !token) return;

    if (!isStaffRole(selectedConversation?.participantRole)) {
      return;
    }

    const recipientId =
      selectedConversation?.participantId ||
      selectedConversation?.otherParticipantId ||
      selectedConversation?.recipientId;

    if (!recipientId) {
      console.error('No recipient found for selected conversation');
      return;
    }

    setSendingMessage(true);
    try {
      await messagingAPI.sendMessage(recipientId, messageText, undefined, token);
      setMessageText('');
      await fetchMessages(selectedConversation._id);
    } catch (error: any) {
      console.error('Error sending message:', error);
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
      if (failureCount > 0) {
        console.warn(`Sent to ${successCount} staff, failed to send to ${failureCount}`);
      }
    } catch (error) {
      console.error('Error in bulk message send:', error);
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
          <View style={[styles.searchContainer, { marginHorizontal: 12, marginTop: 12 }]}>
            <IconSymbol name="magnifyingglass" size={16} color="#999" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search staff..."
              placeholderTextColor="#999"
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
              <View style={styles.composeInputContainer}>
                <TextInput
                  style={styles.composeInput}
                  placeholder="Type your message..."
                  placeholderTextColor="#999"
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
              </View>
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
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    padding: 0,
    color: '#000',
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
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    maxHeight: 100,
    fontSize: 14,
    color: '#000',
  },
});
