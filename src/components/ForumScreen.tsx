import React, { useState, useEffect, useRef } from 'react';
import { ForumMessage, UserProfile } from '../types';
import { db } from '../firebase';
import ConfirmModal from './ConfirmModal';
import { 
  collection, 
  addDoc, 
  setDoc, 
  doc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  deleteDoc, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore';
import { 
  Send, 
  MessageSquare, 
  User, 
  Calendar, 
  Shield, 
  HardHat, 
  Activity, 
  Users, 
  Plus, 
  Trash2, 
  X, 
  Settings, 
  UserPlus, 
  UserMinus, 
  Lock, 
  Globe,
  Image as ImageIcon,
  File as FileIcon,
  CheckSquare as VoteIcon,
  CalendarDays as CalendarDaysIcon,
  Check,
  MapPin,
  UserCheck,
  Download,
  Paperclip
} from 'lucide-react';

interface ForumScreenProps {
  currentUser: UserProfile;
}

interface ForumGroup {
  id: string;
  name: string;
  description: string;
  userIds: string[]; // List of user names/usernames who can access
  createdBy: string;
  createdAt: string;
  companyId?: string;
}

export default function ForumScreen({ currentUser }: ForumScreenProps) {
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [typedMessage, setTypedMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // States for Editing, Deleting, and Mention Tagging
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageText, setEditingMessageText] = useState('');

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    alertOnly?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Mentions / tagging autocomplete state
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionMatchStart, setMentionMatchStart] = useState(-1);

  const companyId = currentUser.companyId || 'default';

  // State variables for new attachments, polling, and event features
  const [composerMode, setComposerMode] = useState<'none' | 'file' | 'poll' | 'event'>('none');
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: 'image' | 'document' } | null>(null);
  const [pollQuestionState, setPollQuestionState] = useState('');
  const [pollOptionsState, setPollOptionsState] = useState<string[]>(['', '']);
  const [eventTitleState, setEventTitleState] = useState('');
  const [eventDateState, setEventDateState] = useState('');
  const [eventLocationState, setEventLocationState] = useState('');

  // Groups and active group state
  const [groups, setGroups] = useState<ForumGroup[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string>('umum-' + companyId);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  
  // Real-time users state (for Admin user management)
  const [usersList, setUsersList] = useState<UserProfile[]>([]);

  // Admin Modal state
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  const [showManageMembers, setShowManageMembers] = useState(false);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState('');

  const isAdmin = currentUser.role === 'admin';

  // 1. Subscribe to users collection (for member assignment)
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: UserProfile[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          username: doc.id,
          name: data.name || doc.id,
          role: data.role || 'departemen',
          division: data.division || 'DEPT',
          status: data.status || 'aktif',
          pin: data.pin || '',
          subRole: data.subRole || '',
          active: data.active ?? true,
          companyId: data.companyId || 'default'
        } as UserProfile);
      });
      // Filter users by company
      const filteredUsers = list.filter(u => (u.companyId || 'default') === companyId);
      setUsersList(filteredUsers);
    });
    return () => unsubscribe();
  }, [companyId]);

  // 2. Subscribe to forum groups
  useEffect(() => {
    const q = query(collection(db, 'forum_groups'), orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const list: ForumGroup[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          name: data.name || 'Grup',
          description: data.description || '',
          userIds: data.userIds || [],
          createdBy: data.createdBy || 'System',
          createdAt: data.createdAt || '',
          companyId: data.companyId || 'default'
        });
      });

      const filteredGroups = list.filter(g => (g.companyId || 'default') === companyId);
      const defaultGroupId = 'umum-' + companyId;

      // If 'umum-companyId' doesn't exist, create it as the default fallback
      if (filteredGroups.length === 0 || !filteredGroups.find(g => g.id === defaultGroupId)) {
        const defaultUmum: ForumGroup = {
          id: defaultGroupId,
          name: 'Umum (General)',
          description: 'Forum koordinasi utama seluruh divisi dan manajemen.',
          userIds: [], // Empty means public
          createdBy: 'System',
          createdAt: new Date().toISOString(),
          companyId: companyId
        };
        await setDoc(doc(db, 'forum_groups', defaultGroupId), defaultUmum);
      } else {
        setGroups(filteredGroups);
        if (!activeGroupId || !filteredGroups.some(g => g.id === activeGroupId)) {
          setActiveGroupId(defaultGroupId);
        }
      }
    }, (error) => {
      console.error('Error fetching groups:', error);
    });

    return () => unsubscribe();
  }, [companyId, activeGroupId]);

  // 3. Subscribe to messages belonging to the active group
  useEffect(() => {
    const chatCol = collection(db, 'forum_messages');
    const q = query(chatCol, orderBy('createdAt', 'asc'), limit(150));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ForumMessage[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Match message group ID, fallback default is umum-companyId if empty
        const msgGroupId = data.groupId || ('umum-' + companyId);
        if (msgGroupId === activeGroupId && (data.companyId || 'default') === companyId) {
          msgs.push({
            id: doc.id,
            senderName: data.senderName || 'Anonim',
            senderRole: data.senderRole || 'departemen',
            senderDivision: data.senderDivision || 'MTC',
            message: data.message || '',
            createdAt: data.createdAt,
            companyId: data.companyId || 'default',
            attachmentUrl: data.attachmentUrl,
            attachmentName: data.attachmentName,
            attachmentType: data.attachmentType,
            isPoll: data.isPoll,
            pollQuestion: data.pollQuestion,
            pollOptions: data.pollOptions,
            isEvent: data.isEvent,
            eventTitle: data.eventTitle,
            eventDate: data.eventDate,
            eventLocation: data.eventLocation,
            eventAttendees: data.eventAttendees
          } as any);
        }
      });
      setMessages(msgs);
    }, (error) => {
      console.error('Error fetching chat messages:', error);
    });

    return () => unsubscribe();
  }, [activeGroupId]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Parses message content and replaces valid member mentions with styled high-contrast badges
  const renderMessageContent = (text: string) => {
    if (!text) return '';
    
    // Sort users by name length descending so that longer names are matched first
    const sortedUsers = [...usersList].sort((a, b) => b.name.length - a.name.length);
    
    let parts: (string | React.ReactNode)[] = [text];
    
    sortedUsers.forEach((user) => {
      const mentionStr = `@${user.name}`;
      const newParts: (string | React.ReactNode)[] = [];
      
      parts.forEach((part) => {
        if (typeof part !== 'string') {
          newParts.push(part);
          return;
        }
        
        const splitParts = part.split(mentionStr);
        if (splitParts.length === 1) {
          newParts.push(part);
        } else {
          splitParts.forEach((sp, idx) => {
            newParts.push(sp);
            if (idx < splitParts.length - 1) {
              newParts.push(
                <span 
                  key={`${user.username}-${idx}`} 
                  className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-extrabold px-1.5 py-0.5 rounded-md text-[11px] mx-0.5 border border-indigo-200/40 inline-block font-sans"
                  title={`${user.name} (${user.division} - ${user.role})`}
                >
                  @{user.name}
                </span>
              );
            }
          });
        }
      });
      parts = newParts;
    });

    // Also style general non-spaced username tags like @mtc_john
    let finalParts: (string | React.ReactNode)[] = [];
    parts.forEach((part) => {
      if (typeof part !== 'string') {
        finalParts.push(part);
        return;
      }
      
      const regex = /(@[^\s@]+)/g;
      const subParts = part.split(regex);
      subParts.forEach((sp, idx) => {
        if (sp.startsWith('@')) {
          finalParts.push(
            <span 
              key={`gen-${idx}`} 
              className="bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-extrabold px-1.5 py-0.5 rounded-md text-[11px] mx-0.5 border border-indigo-200/40 inline-block font-sans"
            >
              {sp}
            </span>
          );
        } else {
          finalParts.push(sp);
        }
      });
    });

    return finalParts;
  };

  const handleSaveEdit = async (messageId: string) => {
    if (!editingMessageText.trim()) return;
    try {
      await updateDoc(doc(db, 'forum_messages', messageId), {
        message: editingMessageText.trim(),
        isEdited: true,
        editedAt: new Date().toISOString()
      });
      setEditingMessageId(null);
    } catch (err) {
      console.error('Failed to edit message:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Mengedit',
        message: 'Gagal menyimpan perubahan pesan Anda. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Pesan',
      message: 'Apakah Anda yakin ingin menghapus pesan ini dari diskusi secara permanen?',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'forum_messages', messageId));
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Error deleting message:', err);
          setDialogConfig({
            isOpen: true,
            title: 'Gagal Menghapus',
            message: 'Terjadi kesalahan saat menghapus pesan dari database.',
            confirmLabel: 'Tutup',
            alertOnly: true,
            variant: 'danger',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleSelectMention = (user: UserProfile) => {
    if (mentionMatchStart === -1) return;
    
    const before = typedMessage.slice(0, mentionMatchStart);
    const after = typedMessage.slice(mentionMatchStart + mentionSearch.length + 1); // +1 is for '@'
    const updatedText = before + `@${user.name} ` + after;
    
    setTypedMessage(updatedText);
    setShowMentions(false);
    setMentionSearch('');
    setMentionMatchStart(-1);
    
    // Auto-focus back to text area
    const textareaEl = document.getElementById('input-chat-message');
    if (textareaEl) {
      textareaEl.focus();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setTypedMessage(val);

    // Mentions detection
    const selectionStart = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, selectionStart);
    
    // Look for last '@' that is either at start or after a space, with optional word characters
    const mentionRegex = /(?:^|\s)@([a-zA-Z0-9_\s]*)$/;
    const match = textBeforeCursor.match(mentionRegex);

    if (match) {
      const searchWord = match[1];
      setMentionSearch(searchWord);
      setShowMentions(true);
      setMentionIndex(0);
      setMentionMatchStart(textBeforeCursor.lastIndexOf('@'));
    } else {
      setShowMentions(false);
    }
  };

  // Filter matching users for mention suggestion
  const filteredMentionUsers = usersList.filter(u => 
    u.name.toLowerCase().includes(mentionSearch.toLowerCase()) || 
    u.username.toLowerCase().includes(mentionSearch.toLowerCase())
  ).slice(0, 5); // Limit to top 5 matches

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((prev) => (prev + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((prev) => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectMention(filteredMentionUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    // Default chat submit on Enter without shift
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const formEl = document.getElementById('chat-input-form') as HTMLFormElement;
      if (formEl) {
        formEl.requestSubmit();
      }
    }
  };

  // Handle selecting files and converting them to base64
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000000) { // Limit to 2MB for base64 storage
      setDialogConfig({
        isOpen: true,
        title: 'File Terlalu Besar',
        message: 'Ukuran file terlalu besar. Maksimal adalah 2 MB.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const isImg = file.type.startsWith('image/');
      setAttachedFile({
        url: base64,
        name: file.name,
        type: isImg ? 'image' : 'document'
      });
    };
    reader.readAsDataURL(file);
  };

  // Handle voting on poll options (real-time database update)
  const handleVote = async (messageId: string, optionIndex: number) => {
    const msgToUpdate = messages.find(m => m.id === messageId);
    if (!msgToUpdate || !msgToUpdate.pollOptions) return;

    const newOptions = msgToUpdate.pollOptions.map((opt, idx) => {
      if (idx === optionIndex) {
        const votes = opt.votes || [];
        const alreadyVoted = votes.includes(currentUser.name);
        return {
          ...opt,
          votes: alreadyVoted 
            ? votes.filter(v => v !== currentUser.name)
            : [...votes, currentUser.name]
        };
      }
      return opt;
    });

    try {
      await updateDoc(doc(db, 'forum_messages', messageId), {
        pollOptions: newOptions
      });
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  // Handle RSVPing to scheduled events (real-time database update)
  const handleRSVP = async (messageId: string, status: 'going' | 'declined') => {
    const msgToUpdate = messages.find(m => m.id === messageId);
    if (!msgToUpdate) return;

    const attendees = msgToUpdate.eventAttendees || [];
    const filtered = attendees.filter(a => a.name !== currentUser.name);
    const newAttendees = [...filtered, {
      username: currentUser.username,
      name: currentUser.name,
      status: status
    }];

    try {
      await updateDoc(doc(db, 'forum_messages', messageId), {
        eventAttendees: newAttendees
      });
    } catch (err) {
      console.error('Failed to RSVP:', err);
    }
  };

  // Handle send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    let messageText = typedMessage.trim();
    let payload: any = {
      senderName: currentUser.name || currentUser.username || 'Anonim',
      senderRole: currentUser.role || 'departemen',
      senderDivision: currentUser.division || 'MTC',
      createdAt: new Date().toISOString(),
      groupId: activeGroupId,
      companyId: companyId
    };

    if (composerMode === 'poll') {
      if (!pollQuestionState.trim()) {
        setDialogConfig({
          isOpen: true,
          title: 'Gagal Membuat Poling',
          message: 'Tuliskan pertanyaan poling terlebih dahulu.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      const filteredOptions = pollOptionsState.filter(opt => opt.trim() !== '');
      if (filteredOptions.length < 2) {
        setDialogConfig({
          isOpen: true,
          title: 'Opsi Tidak Cukup',
          message: 'Sediakan minimal 2 opsi jawaban poling.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      messageText = pollQuestionState.trim();
      payload = {
        ...payload,
        message: messageText,
        isPoll: true,
        pollQuestion: messageText,
        pollOptions: filteredOptions.map(text => ({ text: text.trim(), votes: [] }))
      };
    } else if (composerMode === 'event') {
      if (!eventTitleState.trim()) {
        setDialogConfig({
          isOpen: true,
          title: 'Nama Kegiatan Kosong',
          message: 'Tuliskan nama event terlebih dahulu.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      if (!eventDateState) {
        setDialogConfig({
          isOpen: true,
          title: 'Waktu Belum Dipilih',
          message: 'Pilih tanggal dan waktu event.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      messageText = `Jadwal Event: ${eventTitleState.trim()}`;
      payload = {
        ...payload,
        message: messageText,
        isEvent: true,
        eventTitle: eventTitleState.trim(),
        eventDate: eventDateState,
        eventLocation: eventLocationState.trim(),
        eventAttendees: []
      };
    } else {
      // Normal chat message
      if (!messageText && !attachedFile) return;
      payload = {
        ...payload,
        message: messageText,
        ...(attachedFile ? {
          attachmentUrl: attachedFile.url,
          attachmentName: attachedFile.name,
          attachmentType: attachedFile.type
        } : {})
      };
    }

    setSending(true);
    try {
      await addDoc(collection(db, 'forum_messages'), payload);
      
      // Reset inputs
      setTypedMessage('');
      setAttachedFile(null);
      setPollQuestionState('');
      setPollOptionsState(['', '']);
      setEventTitleState('');
      setEventDateState('');
      setEventLocationState('');
      setComposerMode('none');
    } catch (err) {
      console.error('Failed to send message:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Mengirim',
        message: 'Gagal mengirim pesan chat: ' + (err instanceof Error ? err.message : String(err)),
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSending(false);
    }
  };

  // Admin handles: Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!newGroupName.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Nama Grup Kosong',
        message: 'Nama grup tidak boleh kosong.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      const groupId = 'group-' + Date.now();
      const newGroup: ForumGroup = {
        id: groupId,
        name: newGroupName.trim(),
        description: newGroupDesc.trim(),
        userIds: [currentUser.name], // Creator added automatically
        createdBy: currentUser.name,
        createdAt: new Date().toISOString(),
        companyId: companyId
      };

      await setDoc(doc(db, 'forum_groups', groupId), newGroup);
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateGroup(false);
      setActiveGroupId(groupId);
    } catch (err) {
      console.error('Failed to create group:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Membuat Grup',
        message: 'Gagal membuat grup baru. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  // Admin handles: Add Member
  const handleAddMember = async () => {
    if (!isAdmin || !selectedUserToAdd) return;
    try {
      await updateDoc(doc(db, 'forum_groups', activeGroupId), {
        userIds: arrayUnion(selectedUserToAdd)
      });
      setSelectedUserToAdd('');
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  // Admin handles: Remove Member
  const handleRemoveMember = async (userName: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'forum_groups', activeGroupId), {
        userIds: arrayRemove(userName)
      });
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  // Admin handles: Delete Group
  const handleDeleteGroup = (groupId: string) => {
    if (!isAdmin || groupId === 'umum' || groupId === 'umum-' + companyId) return;
    
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Grup Diskusi',
      message: 'Apakah Anda yakin ingin menghapus grup ini beserta seluruh pesan di dalamnya secara permanen?',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'forum_groups', groupId));
          setActiveGroupId('umum-' + companyId);
          setShowManageMembers(false);
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Failed to delete group:', err);
          setDialogConfig({
            isOpen: true,
            title: 'Gagal Menghapus',
            message: 'Terjadi kesalahan saat menghapus grup dari database.',
            confirmLabel: 'Tutup',
            alertOnly: true,
            variant: 'danger',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-3.5 h-3.5 text-rose-600" />;
      case 'management':
        return <Activity className="w-3.5 h-3.5 text-emerald-600" />;
      case 'teknisi':
        return <HardHat className="w-3.5 h-3.5 text-amber-600" />;
      default:
        return <User className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'management': return 'MTC Mgmt';
      case 'teknisi': return 'MTC Tech';
      default: return 'Div User';
    }
  };

  // Filter groups: non-admin only sees public ('umum') or groups where they are in userIds
  const visibleGroups = groups.filter(g => {
    if (isAdmin) return true; // Admin sees all groups
    if (g.id === 'umum') return true; // General is public
    return g.userIds.includes(currentUser.name);
  });

  const activeGroup = groups.find(g => g.id === activeGroupId) || {
    id: 'umum',
    name: 'Umum (General)',
    description: 'Forum koordinasi utama seluruh divisi dan manajemen.',
    userIds: [],
    createdBy: 'System'
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col md:flex-row h-[650px] shadow-sm overflow-hidden" id="forum-screen-container">
      
      {/* LEFT SIDEBAR: Groups list */}
      <div 
        className={`${showSidebar ? 'flex' : 'hidden'} w-full md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col h-full shrink-0`} 
        id="forum-sidebar"
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">Grup Diskusi ({visibleGroups.length})</span>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreateGroup(true)}
              className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-500 transition cursor-pointer"
              title="Buat Grup Baru (Admin Only)"
              id="btn-show-create-group"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Groups scroll area */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1" id="forum-groups-list">
          {visibleGroups.map((g) => {
            const isGroupActive = g.id === activeGroupId;
            const isPrivate = g.id !== 'umum';
            return (
              <button
                key={g.id}
                onClick={() => {
                  setActiveGroupId(g.id);
                  setShowManageMembers(false);
                  setShowSidebar(false); // Close group list sidebar to maximize chat space
                }}
                className={`w-full text-left p-3 rounded-xl transition flex flex-col gap-1 cursor-pointer ${
                  isGroupActive 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'hover:bg-slate-100 text-slate-700 bg-white/50 border border-slate-100'
                }`}
                id={`btn-select-group-${g.id}`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold truncate pr-2">{g.name}</span>
                  {isPrivate ? (
                    <Lock className={`w-3 h-3 ${isGroupActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                  ) : (
                    <Globe className={`w-3 h-3 ${isGroupActive ? 'text-indigo-200' : 'text-slate-400'}`} />
                  )}
                </div>
                {g.description && (
                  <p className={`text-[10px] line-clamp-1 ${isGroupActive ? 'text-indigo-100' : 'text-slate-400'}`}>
                    {g.description}
                  </p>
                )}
                <div className="flex items-center justify-between w-full mt-1 border-t border-slate-200/10 pt-1 text-[9px]">
                  <span className={isGroupActive ? 'text-indigo-200' : 'text-slate-400'}>
                    Oleh: {g.createdBy}
                  </span>
                  <span className={`font-mono px-1.5 py-0.2 rounded font-semibold ${isGroupActive ? 'bg-indigo-700/50 text-indigo-200' : 'bg-slate-100 text-slate-500'}`}>
                    {g.id === 'umum' ? 'Semua' : `${g.userIds.length} Anggota`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Current user footer badge */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-[10px] text-slate-500 font-mono flex items-center justify-between">
          <span>User: {currentUser.name}</span>
          <span className="text-indigo-600 font-bold uppercase">{currentUser.role}</span>
        </div>
      </div>

      {/* RIGHT MAIN PANEL: Chat Viewport & Management Overlay */}
      <div 
        className={`${showSidebar ? 'hidden md:flex' : 'flex'} flex-1 flex-col h-full relative`} 
        id="forum-chat-panel"
      >
        
        {/* 1. Modal: Create Group (Admin Only) */}
        {showCreateGroup && isAdmin && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-20 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-4 h-4 text-indigo-600" />
                  Buat Grup Diskusi Baru
                </h4>
                <button 
                  onClick={() => setShowCreateGroup(false)} 
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateGroup} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Nama Grup</label>
                  <input
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Contoh: Tim Kelistrikan, Dept Produksi"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-indigo-500 transition"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Deskripsi Singkat</label>
                  <textarea
                    rows={2}
                    value={newGroupDesc}
                    onChange={(e) => setNewGroupDesc(e.target.value)}
                    placeholder="Tuliskan tujuan koordinasi grup ini..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 outline-none focus:border-indigo-500 transition resize-none"
                  />
                </div>
                <div className="pt-2 flex justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowCreateGroup(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-sm"
                  >
                    Simpan Grup
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 2. Modal: Manage Members (Admin Only) */}
        {showManageMembers && isAdmin && activeGroupId !== 'umum' && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs z-15 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4 shadow-xl flex flex-col max-h-[90%]">
              <div className="flex justify-between items-center border-b border-slate-150 pb-2">
                <div>
                  <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Settings className="w-4 h-4 text-indigo-600" />
                    Kelola Anggota Grup: {activeGroup.name}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Tambah atau hapus hak akses pengguna ke grup ini.</p>
                </div>
                <button 
                  onClick={() => setShowManageMembers(false)} 
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 2a. Add Member form */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2 text-xs">
                <span className="font-bold text-slate-700 block text-[10px] uppercase">Masukkan User Baru ke Grup</span>
                <div className="flex gap-1.5">
                  <select
                    value={selectedUserToAdd}
                    onChange={(e) => setSelectedUserToAdd(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none"
                  >
                    <option value="">-- Pilih User --</option>
                    {usersList
                      .filter(u => !activeGroup.userIds.includes(u.name))
                      .map(u => (
                        <option key={u.username} value={u.name}>
                          {u.name} ({u.division} • {u.role})
                        </option>
                      ))
                    }
                  </select>
                  <button
                    onClick={handleAddMember}
                    disabled={!selectedUserToAdd}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-300 text-white font-bold rounded-lg transition text-xs flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> Masukkan
                  </button>
                </div>
              </div>

              {/* 2b. Current Member List */}
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                <span className="font-bold text-slate-500 block text-[10px] uppercase mb-1.5">Daftar Anggota Saat Ini ({activeGroup.userIds.length})</span>
                {activeGroup.userIds.length === 0 ? (
                  <p className="text-slate-400 italic text-xs text-center py-4">Belum ada anggota di grup privat ini.</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {activeGroup.userIds.map((name) => {
                      const userDetails = usersList.find(u => u.name === name);
                      return (
                        <div key={name} className="py-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-bold flex items-center justify-center text-[10px]">
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{name}</p>
                              {userDetails && (
                                <p className="text-[9px] text-slate-400 uppercase font-mono">
                                  {userDetails.division} • {userDetails.role}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Administrators can remove users ("Hapus User") */}
                          <button
                            onClick={() => handleRemoveMember(name)}
                            className="p-1 hover:bg-rose-50 text-rose-500 rounded-md transition cursor-pointer"
                            title="Keluarkan Anggota"
                          >
                            <UserMinus className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer: Delete group option */}
              <div className="pt-3 border-t border-slate-150 flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(activeGroupId)}
                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus Grup
                </button>
                <button
                  onClick={() => setShowManageMembers(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg text-xs cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Header */}
        <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between" id="forum-chat-header">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Toggle Sidebar Option Button */}
            <button
              type="button"
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-xl border font-bold flex items-center gap-1.5 transition cursor-pointer text-[11px] shrink-0 ${
                showSidebar
                  ? 'bg-slate-100 border-slate-250 text-slate-700 hover:bg-slate-200'
                  : 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500 shadow-xs'
              }`}
              title={showSidebar ? "Sembunyikan Daftar Grup" : "Tampilkan Daftar Grup"}
              id="btn-toggle-sidebar"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">{showSidebar ? 'Sembunyikan' : 'Pilih Grup'}</span>
            </button>

            <div className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-600 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 font-sans tracking-tight">
                {activeGroup.name}
              </h3>
              <p className="text-[11px] text-slate-500 line-clamp-1">
                {activeGroup.description || 'Forum koordinasi.'}
              </p>
            </div>
          </div>

          {/* Admin Tools triggers */}
          {isAdmin && activeGroupId !== 'umum' && (
            <button
              onClick={() => setShowManageMembers(true)}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer"
              id="btn-admin-manage-group"
            >
              <Settings className="w-3.5 h-3.5" />
              Kelola Grup
            </button>
          )}
        </div>

        {/* Messages viewport */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50 scrollbar-thin" id="forum-messages-viewport">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-500 text-xs space-y-2 py-12" id="forum-empty">
              <MessageSquare className="w-8 h-8 text-slate-300 animate-bounce" />
              <p>Belum ada diskusi di grup ini. Mulai kirim pesan koordinasi pertama Anda!</p>
            </div>
          ) : (
            <div className="space-y-4" id="messages-list">
              {messages.map((msg) => {
                const isSelf = msg.senderName === currentUser.name;
                
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col max-w-[80%] ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    id={`chat-msg-${msg.id}`}
                  >
                    {/* Sender Name line */}
                    <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500" id="sender-info-line">
                      <span className="font-bold">{msg.senderName}</span>
                      <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-600 px-1 rounded flex items-center gap-0.5">
                        {getRoleIcon(msg.senderRole)}
                        {getRoleLabel(msg.senderRole)} ({msg.senderDivision})
                      </span>
                    </div>

                    {/* Message bubble */}
                    <div 
                      className={`p-4 rounded-2xl text-xs leading-relaxed break-words font-medium shadow-xs w-full max-w-md ${
                        isSelf 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }`}
                      id="message-bubble"
                    >
                      {/* Standard text message if not a poll or event */}
                      {!msg.isPoll && !msg.isEvent && (
                        editingMessageId === msg.id ? (
                          <div className="space-y-2">
                            <textarea
                              rows={2}
                              value={editingMessageText}
                              onChange={(e) => setEditingMessageText(e.target.value)}
                              className="w-full p-2.5 text-xs bg-white text-slate-800 border border-slate-300 rounded-xl outline-none focus:border-indigo-500 font-medium whitespace-pre-wrap resize-none"
                            />
                            <div className="flex justify-end gap-1.5 text-[10px]">
                              <button
                                type="button"
                                onClick={() => setEditingMessageId(null)}
                                className={`px-2 py-1 rounded font-bold ${isSelf ? 'bg-indigo-700 hover:bg-indigo-800 text-white' : 'bg-slate-100 hover:bg-slate-250 text-slate-600'}`}
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(msg.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded"
                              >
                                Simpan
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap break-words">
                            {renderMessageContent(msg.message)}
                            {msg.isEdited && (
                              <span className="text-[9px] opacity-65 font-medium italic ml-1.5">
                                (diedit)
                              </span>
                            )}
                          </p>
                        )
                      )}

                      {/* 📊 Poll Rendering */}
                      {msg.isPoll && (
                        <div className="space-y-3" id={`poll-${msg.id}`}>
                          <div className="flex items-start gap-2 border-b border-indigo-100/20 pb-2">
                            <VoteIcon className="w-4.5 h-4.5 shrink-0 text-indigo-200" />
                            <div>
                              <span className="font-extrabold uppercase tracking-wider text-[10px] block opacity-85">Poling Grup</span>
                              <p className="text-sm font-bold mt-0.5">{msg.pollQuestion || msg.message}</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {(() => {
                              const totalVotes = msg.pollOptions?.reduce((sum: number, opt: any) => sum + (opt.votes?.length || 0), 0) || 0;
                              return msg.pollOptions?.map((opt: any, idx: number) => {
                                const votesCount = opt.votes?.length || 0;
                                const pct = totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                                const hasVotedThis = opt.votes?.includes(currentUser.name);

                                return (
                                  <button
                                    key={idx}
                                    onClick={() => handleVote(msg.id, idx)}
                                    className={`w-full text-left p-2.5 rounded-xl border transition relative overflow-hidden flex items-center justify-between group cursor-pointer ${
                                      hasVotedThis 
                                        ? 'bg-indigo-500/20 border-indigo-400 text-white' 
                                        : isSelf 
                                          ? 'bg-indigo-700/30 border-indigo-500/30 text-indigo-100 hover:bg-indigo-700/50' 
                                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    {/* Progress Background bar */}
                                    <div 
                                      className={`absolute top-0 bottom-0 left-0 transition-all duration-300 -z-10 ${
                                        hasVotedThis 
                                          ? 'bg-indigo-500/30' 
                                          : isSelf 
                                            ? 'bg-indigo-400/10' 
                                            : 'bg-indigo-50'
                                      }`}
                                      style={{ width: `${pct}%` }}
                                    />

                                    <div className="flex items-center gap-2 z-10">
                                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                        hasVotedThis 
                                          ? 'border-indigo-400 bg-indigo-500 text-white' 
                                          : isSelf ? 'border-indigo-400/50' : 'border-slate-300 bg-white'
                                      }`}>
                                        {hasVotedThis && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                      </div>
                                      <span className="font-bold truncate text-xs">{opt.text}</span>
                                    </div>

                                    <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold z-10 shrink-0">
                                      <span>{votesCount} Suara</span>
                                      <span className="opacity-75">({pct}%)</span>
                                    </div>
                                  </button>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 📅 Event Rendering */}
                      {msg.isEvent && (
                        <div className="space-y-3" id={`event-${msg.id}`}>
                          <div className="flex items-start gap-2 border-b border-indigo-100/20 pb-2">
                            <CalendarDaysIcon className="w-4.5 h-4.5 shrink-0 text-indigo-200" />
                            <div>
                              <span className="font-extrabold uppercase tracking-wider text-[10px] block opacity-85">Jadwal Event / Rapat</span>
                              <p className="text-sm font-bold mt-0.5">{msg.eventTitle || msg.message}</p>
                            </div>
                          </div>

                          <div className="space-y-1.5 py-1 text-[11px] opacity-90">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3.5 h-3.5 shrink-0 opacity-75" />
                              <span className="font-medium">
                                {msg.eventDate ? new Date(msg.eventDate).toLocaleDateString('id-ID', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : 'Belum ditentukan'}
                              </span>
                            </div>
                            {msg.eventLocation && (
                              <div className="flex items-center gap-2">
                                <MapPin className="w-3.5 h-3.5 shrink-0 opacity-75" />
                                <span className="font-medium truncate">{msg.eventLocation}</span>
                              </div>
                            )}
                          </div>

                          {/* RSVP Buttons */}
                          <div className="flex gap-1.5 pt-1">
                            {(() => {
                              const attendees = msg.eventAttendees || [];
                              const myRsvp = attendees.find((a: any) => a.name === currentUser.name)?.status;

                              return (
                                <>
                                  <button
                                    onClick={() => handleRSVP(msg.id, 'going')}
                                    className={`flex-1 py-1.5 rounded-lg font-bold border text-center transition flex items-center justify-center gap-1 cursor-pointer text-[11px] ${
                                      myRsvp === 'going'
                                        ? 'bg-emerald-600 border-emerald-500 text-white'
                                        : isSelf
                                          ? 'bg-indigo-700/50 border-indigo-500/30 text-indigo-100 hover:bg-indigo-700/80'
                                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                    }`}
                                  >
                                    <UserCheck className="w-3.5 h-3.5" /> Hadir
                                  </button>
                                  <button
                                    onClick={() => handleRSVP(msg.id, 'declined')}
                                    className={`flex-1 py-1.5 rounded-lg font-bold border text-center transition flex items-center justify-center gap-1 cursor-pointer text-[11px] ${
                                      myRsvp === 'declined'
                                        ? 'bg-rose-600 border-rose-500 text-white'
                                        : isSelf
                                          ? 'bg-indigo-700/50 border-indigo-500/30 text-indigo-100 hover:bg-indigo-700/80'
                                          : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                                    }`}
                                  >
                                    <X className="w-3.5 h-3.5" /> Absen
                                  </button>
                                </>
                              );
                            })()}
                          </div>

                          {/* RSVP Stats & Attendees lists */}
                          {(() => {
                            const attendees = msg.eventAttendees || [];
                            const going = attendees.filter((a: any) => a.status === 'going');
                            const declined = attendees.filter((a: any) => a.status === 'declined');

                            if (attendees.length === 0) return null;

                            return (
                              <div className={`mt-2 p-2 rounded-xl text-[10px] space-y-1.5 border ${
                                isSelf ? 'bg-indigo-900/30 border-indigo-500/20' : 'bg-slate-50 border-slate-150'
                              }`}>
                                {going.length > 0 && (
                                  <div>
                                    <span className="font-bold text-emerald-600 block">✓ Hadir ({going.length}):</span>
                                    <span className={isSelf ? 'text-indigo-200' : 'text-slate-600'}>
                                      {going.map((a: any) => a.name).join(', ')}
                                    </span>
                                  </div>
                                )}
                                {declined.length > 0 && (
                                  <div>
                                    <span className="font-bold text-rose-600 block">✗ Absen ({declined.length}):</span>
                                    <span className={isSelf ? 'text-indigo-200' : 'text-slate-600'}>
                                      {declined.map((a: any) => a.name).join(', ')}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* 📎 Attached Image or Document */}
                      {msg.attachmentUrl && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100/10" id="attached-media-preview">
                          {msg.attachmentType === 'image' ? (
                            <div className="rounded-xl overflow-hidden border border-slate-200 bg-black/5 dark:bg-black/20">
                              <img 
                                src={msg.attachmentUrl} 
                                alt={msg.attachmentName || 'Foto Lampiran'} 
                                className="w-full h-auto object-cover max-h-56 cursor-zoom-in hover:opacity-95 transition" 
                                onClick={() => {
                                  const w = window.open();
                                  if (w) {
                                    w.document.write(`<img src="${msg.attachmentUrl}" style="max-width:100%; max-height:100vh; display:block; margin:auto;"/>`);
                                  }
                                }} 
                              />
                              {msg.attachmentName && (
                                <div className={`p-2 text-[10px] flex justify-between items-center ${
                                  isSelf ? 'bg-indigo-900/30 border-t border-indigo-500/20 text-indigo-150' : 'bg-slate-50 border-t border-slate-100 text-slate-500'
                                }`}>
                                  <span className="truncate max-w-[70%]">{msg.attachmentName}</span>
                                  <a href={msg.attachmentUrl} download={msg.attachmentName} className="font-bold hover:underline shrink-0 text-indigo-400">Unduh</a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-[11px] ${
                              isSelf 
                                ? 'bg-indigo-900/30 border-indigo-500/20 text-indigo-100' 
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              <FileIcon className="w-7 h-7 text-indigo-500 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="font-bold truncate">{msg.attachmentName || 'Berkas Lampiran'}</p>
                                <p className="text-[9px] opacity-70">Dokumen Lampiran</p>
                              </div>
                              <a 
                                href={msg.attachmentUrl} 
                                download={msg.attachmentName} 
                                className={`p-1.5 rounded-lg shrink-0 transition ${
                                  isSelf 
                                    ? 'bg-indigo-700/50 hover:bg-indigo-700 border border-indigo-500/30 text-white' 
                                    : 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600'
                                }`}
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Timestamp & Actions */}
                    <div className="flex items-center gap-2 mt-1">
                      {msg.createdAt && (
                        <span className="text-[9px] text-slate-400 font-mono">
                          {(() => {
                            try {
                              const date = typeof msg.createdAt === 'string' 
                                ? new Date(msg.createdAt) 
                                : msg.createdAt && typeof msg.createdAt.toDate === 'function'
                                  ? msg.createdAt.toDate()
                                  : msg.createdAt && msg.createdAt.seconds 
                                    ? new Date(msg.createdAt.seconds * 1000)
                                    : new Date(msg.createdAt);
                              return isNaN(date.getTime()) ? '' : date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                            } catch (e) {
                              return '';
                            }
                          })()}
                        </span>
                      )}

                      {/* Edit/Delete Actions */}
                      {editingMessageId !== msg.id && (
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
                          {isSelf && !msg.isPoll && !msg.isEvent && (
                            <>
                              <span className="text-[8px] opacity-40">•</span>
                              <button
                                onClick={() => {
                                  setEditingMessageId(msg.id);
                                  setEditingMessageText(msg.message);
                                }}
                                className="hover:text-indigo-600 transition cursor-pointer font-bold"
                              >
                                Edit
                              </button>
                            </>
                          )}
                          {(isSelf || isAdmin) && (
                            <>
                              <span className="text-[8px] opacity-40">•</span>
                              <button
                                onClick={() => handleDeleteMessage(msg.id)}
                                className="hover:text-rose-600 transition cursor-pointer font-bold"
                              >
                                Hapus
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Message Sender Form Input bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col gap-3 shrink-0" id="forum-message-input-bar">
          
          {/* Quick Selection Bar */}
          <div className="flex items-center gap-2 text-xs" id="composer-actions-bar">
            <button
              type="button"
              onClick={() => {
                setComposerMode(composerMode === 'file' ? 'none' : 'file');
                setAttachedFile(null);
              }}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                composerMode === 'file' 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
              id="btn-composer-file"
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Foto / File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setComposerMode(composerMode === 'poll' ? 'none' : 'poll');
              }}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                composerMode === 'poll' 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
              id="btn-composer-poll"
            >
              <VoteIcon className="w-3.5 h-3.5" />
              <span>Poling</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setComposerMode(composerMode === 'event' ? 'none' : 'event');
              }}
              className={`px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition cursor-pointer ${
                composerMode === 'event' 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
              id="btn-composer-event"
            >
              <CalendarDaysIcon className="w-3.5 h-3.5" />
              <span>Event / Rapat</span>
            </button>

            {composerMode !== 'none' && (
              <button
                type="button"
                onClick={() => {
                  setComposerMode('none');
                  setAttachedFile(null);
                }}
                className="ml-auto text-slate-400 hover:text-rose-500 font-bold transition flex items-center gap-0.5 cursor-pointer text-[11px]"
              >
                <X className="w-3.5 h-3.5" /> Batal
              </button>
            )}
          </div>

          {/* Form for File attachment */}
          {composerMode === 'file' && (
            <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 animate-fadeIn" id="panel-composer-file">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unggah Berkas/Foto (Maks. 2MB)</span>
              
              {!attachedFile ? (
                <div 
                  className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center hover:border-indigo-400 transition cursor-pointer relative"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      const eventMock = { target: { files: [file] } } as any;
                      handleFileSelect(eventMock);
                    }
                  }}
                >
                  <input
                    type="file"
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    onChange={handleFileSelect}
                  />
                  <ImageIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-bold">Tarik & lepas file di sini, atau klik untuk memilih</p>
                  <p className="text-[10px] text-slate-400 mt-1">Format: JPG, PNG, PDF, DOC, XLS, dll.</p>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-150 rounded-lg">
                  {attachedFile.type === 'image' ? (
                    <img src={attachedFile.url} alt="Preview" className="w-10 h-10 object-cover rounded-md border border-slate-200" />
                  ) : (
                    <div className="w-10 h-10 rounded-md bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">DOC</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 truncate">{attachedFile.name}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-mono">{attachedFile.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedFile(null)}
                    className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Form for Polling creation */}
          {composerMode === 'poll' && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 animate-fadeIn" id="panel-composer-poll">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buat Poling Baru</span>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Tanyakan sesuatu... (Contoh: Kapan kita jadwalkan maintenance PM Mesin A?)"
                  value={pollQuestionState}
                  onChange={(e) => setPollQuestionState(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-250 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition"
                  required
                />
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500">Opsi Jawaban:</label>
                  {pollOptionsState.map((opt, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <span className="text-[11px] font-bold font-mono text-slate-400 w-4">{idx + 1}.</span>
                      <input
                        type="text"
                        placeholder={`Opsi ${idx + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const nextOptions = [...pollOptionsState];
                          nextOptions[idx] = e.target.value;
                          setPollOptionsState(nextOptions);
                        }}
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                        required
                      />
                      {pollOptionsState.length > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPollOptionsState(pollOptionsState.filter((_, oIdx) => oIdx !== idx));
                          }}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPollOptionsState([...pollOptionsState, ''])}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 mt-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Opsi
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Form for Event scheduling */}
          {composerMode === 'event' && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-3 animate-fadeIn" id="panel-composer-event">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Jadwalkan Event / Rapat</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">Nama Kegiatan / Rapat:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Rapat Mingguan Teknisi MTC, PM Mesin B"
                    value={eventTitleState}
                    onChange={(e) => setEventTitleState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500">Waktu & Tanggal:</label>
                  <input
                    type="datetime-local"
                    value={eventDateState}
                    onChange={(e) => setEventDateState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
                    required
                  />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500">Lokasi / Tautan Media:</label>
                  <input
                    type="text"
                    placeholder="Contoh: Ruang Workshop MTC Utama / Google Meet Tautan"
                    value={eventLocationState}
                    onChange={(e) => setEventLocationState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Mentions Dropdown list floating above input field */}
          {showMentions && filteredMentionUsers.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl shadow-lg p-1.5 max-h-48 overflow-y-auto z-10 space-y-0.5 animate-fadeIn mb-1" id="mentions-autocomplete">
              <div className="px-2.5 py-1.5 text-[9px] font-extrabold text-slate-400 uppercase tracking-wider border-b border-slate-100/80">
                Sebut/Tag Anggota
              </div>
              {filteredMentionUsers.map((user, idx) => (
                <button
                  key={user.username}
                  type="button"
                  onClick={() => handleSelectMention(user)}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition cursor-pointer ${
                    idx === mentionIndex ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 font-extrabold flex items-center justify-center text-[10px]">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-bold block text-slate-800">{user.name}</span>
                      <span className="text-[9px] text-slate-400 font-mono">@{user.username}</span>
                    </div>
                  </div>
                  <span className="text-[9px] bg-indigo-50 border border-indigo-150 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                    {user.division}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Chat input submission form */}
          <form onSubmit={handleSendMessage} className="flex gap-2 items-end" id="chat-input-form">
            <textarea
              id="input-chat-message"
              required={composerMode === 'none'}
              disabled={sending}
              rows={1}
              placeholder={
                composerMode === 'poll' 
                  ? 'Tulis komentar opsional untuk poling...' 
                  : composerMode === 'event' 
                    ? 'Tulis komentar opsional untuk event...' 
                    : attachedFile 
                      ? `Tulis keterangan file: ${attachedFile.name}` 
                      : `Tulis pesan koordinasi di grup ${activeGroup.name}...`
              }
              value={typedMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition placeholder-slate-400 resize-none min-h-[42px] max-h-[120px] overflow-y-auto font-medium"
            />
            <button
              id="btn-send-chat"
              type="submit"
              disabled={sending || (composerMode === 'none' && !typedMessage.trim() && !attachedFile)}
              className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white rounded-xl transition flex items-center justify-center cursor-pointer shadow-sm font-bold text-xs gap-1 shrink-0 h-[42px]"
            >
              <Send className="w-4 h-4" />
              <span>{composerMode === 'poll' ? 'Poling' : composerMode === 'event' ? 'Event' : 'Kirim'}</span>
            </button>
          </form>
        </div>

      </div>

      <ConfirmModal
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmLabel={dialogConfig.confirmLabel || 'OK'}
        cancelLabel={dialogConfig.cancelLabel}
        variant={dialogConfig.variant || 'info'}
        alertOnly={dialogConfig.alertOnly}
        onConfirm={dialogConfig.onConfirm}
        onCancel={dialogConfig.onCancel}
      />

    </div>
  );
}
