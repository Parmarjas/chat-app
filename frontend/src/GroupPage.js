import React, { useState, useEffect, useRef } from 'react';
import { fetchGroups, addGroupMember, removeGroupMember, fetchGroupMessages, sendGroupMessage, createGroup, votePoll, deleteMessage, sendPoll } from './api.js';
import './GroupPage.css';
import { createPortal } from 'react-dom';

function DeleteDropdownPortal({ children, style }) {
  return createPortal(
    <div className="delete-options-dropdown" style={style}>
      {children}
    </div>,
    document.body
  );
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
    const response = await fetch('http://localhost:8000/api/chat/upload/', {
    method: 'POST',
    body: formData,
  });
    const data = await response.json();
    return data.url; // Backend returns 'url' field, not 'imageUrl'
}

const MultiplePollVoteUI = ({ msg, user, setMessages }) => {
    const [selectedOptions, setSelectedOptions] = useState([]);

    const handleOptionToggle = async (optionIndex) => {
        try {
            console.log('MultiplePollVoteUI voting:', msg.id, user);
            // Use username if available, otherwise use user ID
            const voter = user.username || user.id || user;
            console.log('Using voter:', voter);

            // Get current votes for this user
            const currentVotes = msg.pollVotes?.[voter] || [];

            // Toggle the selected option
            const newVotes = currentVotes.includes(optionIndex)
                ? currentVotes.filter(vote => vote !== optionIndex) // Remove vote
                : [...currentVotes, optionIndex]; // Add vote

            console.log('New votes:', newVotes);
            const updatedMsg = await votePoll(msg.id, voter, newVotes);
            console.log('MultiplePollVoteUI vote result:', updatedMsg);
            setMessages(messages => messages.map(m => m.id === msg.id ? updatedMsg : m));
        } catch (error) {
            console.error('Error in MultiplePollVoteUI voting:', error);
            alert('Failed to vote. Please try again.');
        }
    };

    return (
        <div className="chat-poll-box">
            <div className="poll-header">
                <span className="poll-header-icon">📊</span>
                {msg.poll.question} (Multiple Choice)
            </div>
            <div className="poll-options">
                {msg.poll.options.map((option, i) => {
                    const voteCount = Object.values(msg.pollVotes || {}).flat().filter(vote => vote === i).length;
                    const totalVotes = Object.values(msg.pollVotes || {}).flat().length;
                    const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                    const hasVoted = msg.pollVotes?.[user.username || user.id]?.includes(i);

                    return (
                        <div key={i} style={{ marginBottom: '8px' }}>
                            <div
                                className={`poll-multiple-option ${hasVoted ? 'selected' : ''}`}
                                style={{
                                    background: hasVoted
                                        ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.2) 100%)'
                                        : 'linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(22, 33, 62, 0.6) 100%)',
                                    border: hasVoted
                                        ? '2px solid rgba(34, 197, 94, 0.6)'
                                        : '2px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '6px',
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    minHeight: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    boxShadow: hasVoted
                                        ? '0 3px 12px rgba(34, 197, 94, 0.3)'
                                        : '0 2px 6px rgba(0, 0, 0, 0.15)',
                                    position: 'relative',
                                    overflow: 'hidden',
                                    transition: 'all 0.3s ease'
                                }}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleOptionToggle(i);
                                }}
                            >
                                <div
                                    className="poll-progress-bar"
                                    style={{ width: `${percentage}%` }}
                                ></div>
                                <div className="poll-option-content">
                                    <div className="poll-option-left">
                                        <div className="poll-multiple-checkbox"></div>
                                        <span
                                            className="poll-option-text"
                                            style={{ cursor: 'pointer' }}
                                        >
                                            {option}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                textAlign: 'right',
                                marginTop: '4px',
                                fontSize: '12px',
                                color: '#4ade80',
                                fontWeight: '600'
                            }}>
                                {Math.round(percentage)}% ({voteCount} vote{voteCount !== 1 ? 's' : ''})
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className="poll-total">
                Total votes: {Object.values(msg.pollVotes || {}).flat().length}
            </div>
        </div>
    );
};

function GroupPage({ users = [], user, groups: propGroups = [], setGroups: setPropGroups }) {
    const [groups, setGroupsState] = useState(propGroups);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [showDeleteOptions, setShowDeleteOptions] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [prevMessagesLength, setPrevMessagesLength] = useState(0);
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showPollForm, setShowPollForm] = useState(false);
    const [pollQuestion, setPollQuestion] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    const [allowMultipleVotes, setAllowMultipleVotes] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [attachType, setAttachType] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [selectedImage, setSelectedImage] = useState(null);
    const [unreadCounts, setUnreadCounts] = useState({});
    const [selectedMembers, setSelectedMembers] = useState([]);
    const chatWindowRef = useRef(null);
    const [dropdownPos, setDropdownPos] = useState(null);
    const deleteBtnRef = useRef();
    const [showLeaveGroupConfirm, setShowLeaveGroupConfirm] = useState(null); // {group: ...} or null

    // Scroll tracking refs
    const wasAtBottom = useRef(true);
    const prevSelectedGroup = useRef(selectedGroup);

    // Filter groups based on search term
    const filteredGroups = searchTerm
        ? groups.filter(group => group.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : groups;

    useEffect(() => {
        if (propGroups.length > 0) {
            setGroupsState(propGroups);
        }
    }, [propGroups]);

    // Track scroll position
    useEffect(() => {
        const el = chatWindowRef.current;
        if (!el) return;

        const handleScroll = () => {
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
            wasAtBottom.current = atBottom;
        };

        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [chatWindowRef]);

    useEffect(() => {
            if (selectedGroup) {
            loadMessages();
        }
    }, [selectedGroup]);

    // Auto-scroll to bottom when opening new group or receiving new messages
    useEffect(() => {
        if (selectedGroup && chatWindowRef.current) {
            // Check if this is a new group (group changed) or new messages arrived
            const isNewGroup = prevSelectedGroup.current !== selectedGroup;
            const hasNewMessages = messages.length > prevMessagesLength;

            if (isNewGroup || hasNewMessages) {
                // Force scroll to bottom when opening a new group or receiving new messages
                setTimeout(() => {
                    if (chatWindowRef.current) {
                        chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
                    }
                }, 100);
            }
        }
        prevSelectedGroup.current = selectedGroup;
        setPrevMessagesLength(messages.length);
    }, [selectedGroup, messages, chatWindowRef]);

    // Helper functions for unread message tracking
    const getLastReadId = (groupId) => {
        return localStorage.getItem('lastReadGroup_' + groupId);
    };

    const setLastReadId = (groupId, msgId) => {
        localStorage.setItem('lastReadGroup_' + groupId, msgId);
    };



    // Poll for new messages every 2 seconds
    useEffect(() => {
        const pollGroupMessages = async () => {
            if (selectedGroup && user && user.username) {
                try {
                    const newMessages = await fetchGroupMessages(selectedGroup.id, user.username);
                    if (newMessages && Array.isArray(newMessages)) {
                        setMessages(newMessages);
                    }
                } catch (error) {
                    console.error('Error polling group messages:', error);
                }
            }
        };

        const interval = setInterval(pollGroupMessages, 2000);
        return () => clearInterval(interval);
    }, [selectedGroup, user]);

    // Poll for unread messages in all groups
    useEffect(() => {
        if (!user || !user.username) return;

        const pollUnreadGroupMessages = async () => {
            for (const group of groups) {
                // Skip the currently selected group
                if (selectedGroup && selectedGroup.id === group.id) continue;

                try {
                    const res = await fetchGroupMessages(group.id, user.username);

                    if (res && Array.isArray(res)) {
                        // Get last read message ID for this group
                        const lastReadId = getLastReadId(group.id);

                        // Count messages newer than lastReadId
                        let newMsgs = res;
                        if (lastReadId) {
                            newMsgs = res.filter(m => m.id > lastReadId);
                        }

                        if (newMsgs.length > 0) {
                            setUnreadCounts(prev => ({ ...prev, [group.id]: newMsgs.length }));
                        } else {
                            setUnreadCounts(prev => ({ ...prev, [group.id]: 0 }));
                        }
                    }
                } catch (error) {
                    console.error('Error polling unread group messages:', error);
                }
            }
        };

        const interval = setInterval(pollUnreadGroupMessages, 3000);
        return () => clearInterval(interval);
    }, [user, groups, selectedGroup]);

    // Mark messages as read when group is selected
    useEffect(() => {
        if (selectedGroup && messages.length > 0) {
            // Find the latest message from this group
            const latestMsg = messages[messages.length - 1];
            if (latestMsg && latestMsg.id) {
                setLastReadId(selectedGroup.id, latestMsg.id);
            }
            setUnreadCounts(prev => ({ ...prev, [selectedGroup.id]: 0 }));
        }
    }, [selectedGroup, messages]);

    const loadMessages = async () => {
        if (!selectedGroup || !user || !user.username) return;

        setIsLoading(true);
        try {
            const newMessages = await fetchGroupMessages(selectedGroup.id, user.username);
            if (newMessages && Array.isArray(newMessages)) {
                setMessages(newMessages);
                setPrevMessagesLength(newMessages.length);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Click outside handlers for modals
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showCreateGroupModal && !event.target.closest('.create-group-modal')) {
                setShowCreateGroupModal(false);
                setGroupName('');
                setSelectedMembers([]);
                setError('');
                setSuccessMessage('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showCreateGroupModal]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showLeaveModal && !event.target.closest('.modal-overlay')) {
                setShowLeaveModal(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showLeaveModal]);

    // Click outside handler for attachment dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.chat-attach-dropdown') && !event.target.closest('.icon-btn')) {
                console.log('GroupPage: Click outside detected, closing dropdown');
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    const toggleMessageSelection = (messageId) => {
        const newSelected = new Set(selectedMessages);
        if (newSelected.has(messageId)) {
            newSelected.delete(messageId);
        } else {
            newSelected.add(messageId);
        }
        setSelectedMessages(newSelected);
        setIsSelectionMode(newSelected.size > 0);
        if (newSelected.size === 0) setShowDeleteOptions(null);
    };

    const handleDeleteSelected = async (deleteType = 'for_everyone') => {
        const promises = Array.from(selectedMessages).map(messageId =>
            deleteMessage(messageId, deleteType, user.username)
        );

        try {
            const results = await Promise.all(promises);
            const errors = results.filter(result => result && result.error);

            if (errors.length > 0) {
                alert(errors[0].error);
            } else {
        setSelectedMessages(new Set());
        setIsSelectionMode(false);
                setShowDeleteOptions(null);
                await loadMessages();

                // Scroll to bottom after deleting messages
                setTimeout(() => {
                    if (chatWindowRef.current) {
                        chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error deleting messages:', error);
            alert('Failed to delete messages. Please try again.');
        }
    };

    const handleDeleteMessage = async (messageId, deleteType = 'for_everyone') => {
        try {
            const response = await deleteMessage(messageId, deleteType, user.username);
            if (response && response.error) {
                alert(response.error);
            } else {
                await loadMessages();

                // Scroll to bottom after deleting message
                setTimeout(() => {
                    if (chatWindowRef.current) {
                        chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
                    }
                }, 100);
            }
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Failed to delete message. Please try again.');
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!groupName.trim()) {
            setError('Group name is required');
            return;
        }
        try {
            // Convert usernames to user IDs for the API
            const memberIds = selectedMembers.map(username => {
                const userObj = users.find(u => {
                    const uUsername = typeof u === 'string' ? u : u.username;
                    return uUsername === username;
                });
                return userObj ? (typeof userObj === 'string' ? null : userObj.id) : null;
            }).filter(id => id !== null);
            // Add current user to the group members
            const currentUserId = typeof user === 'string' ? null : user.id;
            if (currentUserId) {
                memberIds.push(currentUserId);
            }
            let newGroup;
            try {
                newGroup = await createGroup(groupName, memberIds);
            } catch (apiError) {
                setError(apiError.message || 'Failed to create group.');
                console.log('Group creation API error:', apiError);
                return;
            }
            if (newGroup && (newGroup.id || newGroup.success || !newGroup.error)) {
                setError('');
                setSuccessMessage('Group created successfully!');
                setGroupName('');
                setSelectedMembers([]);
                const updatedGroups = await fetchGroups();
                const filteredGroups = updatedGroups.filter(g =>
                    g.members && g.members.some(m => (m.username ? m.username === user.username : m === user.username || m === user.id))
                );
                setGroupsState(filteredGroups);
                setPropGroups(filteredGroups);
                const newlyCreatedGroup = filteredGroups.find(g => g.name === groupName);
                if (newlyCreatedGroup) {
                    setSelectedGroup(newlyCreatedGroup);
                }
                setTimeout(() => {
                    setShowCreateGroupModal(false);
                    setSuccessMessage('');
                }, 1500);
            } else {
                const errorMessage = newGroup?.error || newGroup?.message || 'Failed to create group';
                setError(errorMessage);
                setSuccessMessage('');
            }
        } catch (error) {
            setError(error.message || 'Failed to create group.');
            setSuccessMessage('');
            console.log('Group creation error:', error);
        }
    };

    const handleSendWithImage = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                console.log('Uploading image:', file.name);
                const imageUrl = await uploadImage(file);
                console.log('Image uploaded successfully:', imageUrl);
                // Store the uploaded image URL instead of sending immediately
                setSelectedImage(imageUrl);
                setAttachType(null); // Hide the file input
            } catch (error) {
                console.error('Error uploading image:', error);
                alert('Failed to upload image. Please try again.');
            }
        }
    };

    const handleSendWithDocument = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                console.log('Uploading document:', file.name);
                // Upload the document file first
                const formData = new FormData();
                formData.append('file', file);
                const response = await fetch('http://localhost:8000/api/chat/upload/', {
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                console.log('Document uploaded successfully:', data.url);

                const documentData = {
                    documentName: file.name,
                    documentUrl: data.url,
                    type: file.type
                };
                // Store the uploaded document instead of sending immediately
                setSelectedDocument(documentData);
                setAttachType(null); // Hide the file input
            } catch (error) {
                console.error('Error uploading document:', error);
                alert('Failed to upload document. Please try again.');
            }
        }
    };

    const handleSend = async (e, imageUrl = null, document = null, poll = null) => {
        if (e) e.preventDefault();

        // Use stored image and document if no parameters provided
        const imageToSend = imageUrl || selectedImage;
        const documentToSend = document || selectedDocument;

        // Allow sending if there's content, image, document, or poll
        const hasContent = newMessage.trim() || imageToSend || documentToSend || poll;
        if (!hasContent) return;

        try {
            const messageData = {
                content: newMessage || '', // Ensure content is never undefined
                groupId: selectedGroup.id,
                sender: user.username
            };

            if (imageToSend) messageData.imageUrl = imageToSend;
            if (documentToSend) messageData.document = documentToSend;
            if (poll) messageData.poll = poll;

            await sendGroupMessage(messageData);

            setNewMessage('');

            // Clear all attachments and states
        setAttachType(null);
            setSelectedDocument(null);
            setSelectedImage(null);

            await loadMessages();

            // Scroll to bottom after sending message
            setTimeout(() => {
                if (chatWindowRef.current) {
                    chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
                }
            }, 100);
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
    };

    const handleLeaveGroup = async () => {
        setShowLeaveModal(true);
    };

    const confirmLeaveGroup = async () => {
        try {
            const response = await removeGroupMember(selectedGroup.id, user.username);
            console.log('Leave group response:', response);
            if (response && response.error) {
                alert('Failed to leave group: ' + response.error);
                return;
            }
            setShowLeaveModal(false);
            // Refresh groups list
        const updatedGroups = await fetchGroups();
        const filteredGroups = updatedGroups.filter(g =>
            g.members && g.members.some(m => (m.username ? m.username === user.username : m === user.username || m === user.id))
        );
            setGroupsState(filteredGroups);
            setPropGroups(filteredGroups);
        setSelectedGroup(null);
        } catch (error) {
            console.error('Error leaving group:', error);
            alert('Failed to leave group. Please try again.');
        }
    };

    const handleCreatePoll = async () => {
        if (!user || !selectedGroup) return;

        const validOptions = pollOptions.filter(opt => opt.trim());
        if (!pollQuestion.trim() || validOptions.length < 2) {
            alert('Please enter a question and at least 2 options.');
            return;
        }

        try {
            const pollData = {
                question: pollQuestion.trim(),
                options: validOptions,
                allowMultiple: allowMultipleVotes
            };

            await handleSend(null, null, null, pollData);

            // Clear poll form
            setShowPollForm(false);
            setPollQuestion('');
            setPollOptions(['', '']);
            setAllowMultipleVotes(false);
        } catch (error) {
            console.error('Error creating poll:', error);
            alert('Failed to create poll. Please try again.');
        }
    };

    // Smart scroll to bottom only on new messages or group change
    useEffect(() => {
        if (chatWindowRef.current && messages.length > prevMessagesLength) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
        }
        setPrevMessagesLength(messages.length);
    }, [messages.length, prevMessagesLength]);

    const allSelectedAreSelf = messages.filter(m => selectedMessages.has(m.id)).every(m => {
        const senderUsername = typeof m.sender === 'object' ? m.sender?.username : m.sender;
        return senderUsername === user.username;
    });

    useEffect(() => {
        // Reset input and selection when switching group
        setNewMessage('');
        setSelectedImage(null);
        setSelectedDocument(null);
        setAttachType(null);
        setSelectedMessages(new Set());
        setIsSelectionMode(false);
        setShowDeleteOptions(null);
        setShowPollForm(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        setAllowMultipleVotes(false);
    }, [selectedGroup]);

    const handleDeleteClick = () => {
        if (showDeleteOptions === 'selected') {
            setShowDeleteOptions(null);
            return;
        }
        if (deleteBtnRef.current) {
            const rect = deleteBtnRef.current.getBoundingClientRect();
            const dropdownHeight = 90; // px, adjust if needed
            const spaceBelow = window.innerHeight - rect.bottom;
            const spaceAbove = rect.top;
            let top;
            if (spaceBelow > dropdownHeight) {
                top = rect.bottom + window.scrollY + 4;
            } else if (spaceAbove > dropdownHeight) {
                top = rect.top + window.scrollY - dropdownHeight - 4;
            } else {
                top = rect.bottom + window.scrollY + 4;
            }
            setDropdownPos({
                top,
                left: rect.left + window.scrollX,
                minWidth: rect.width
            });
            setShowDeleteOptions('selected');
        }
    };

    return (
        <div className="main-container">
            <div className="chat-header">
                <div className="header-avatar-container">
                    <div className="header-avatar">
                        G
                    </div>
                    <h2 style={{ margin: 0, color: '#3182ce', fontSize: '1.5em', fontWeight: 700 }}>Group Chat</h2>
                </div>
                <button
                    className="create-group-btn"
                    onClick={() => setShowCreateGroupModal(true)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'linear-gradient(135deg, #3182ce 0%, #2c5aa0 100%)',
                        color: 'white',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 2px 8px rgba(49, 130, 206, 0.3)'
                    }}
                    onMouseEnter={(e) => {
                        e.target.style.transform = 'translateY(-1px)';
                        e.target.style.boxShadow = '0 4px 12px rgba(49, 130, 206, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 2px 8px rgba(49, 130, 206, 0.3)';
                    }}
                >
                    + Create Group
                </button>
            </div>
            <div className="chat-flex-layout">
                <div className="chat-users-col">
                    <b>Groups:</b>
                    <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="chat-users-search"
                    />
                    {searchTerm && (
                        <div style={{ fontSize: '0.8em', color: '#666', marginBottom: '8px' }}>
                            Found {filteredGroups.length} group{filteredGroups.length !== 1 ? 's' : ''}
                        </div>
                    )}
                    <ul className="chat-users-ul">
                        {filteredGroups.map(group => (
                            <li
                                key={group.id}
                                className={`chat-users-li-flex${selectedGroup && selectedGroup.id === group.id ? ' chat-users-li-selected' : ''}`}
                            >
                                <button
                                    className={`chat-user-btn${selectedGroup && selectedGroup.id === group.id ? ' chat-user-selected' : ''}`}
                                    onClick={() => {
                                        setSelectedGroup(group);
                                        setSearchTerm(''); // Clear search when group is selected
                                    }}
                                >
                                    <span className="chat-user-avatar">{group.name.charAt(0).toUpperCase()}</span>
                                    <span className="chat-user-username">{group.name}</span>
                                    {unreadCounts[group.id] > 0 && (
                                        <span className="chat-unread-badge">{unreadCounts[group.id] > 9 ? '9+' : unreadCounts[group.id]}</span>
                                    )}
                                </button>
                                {/* <span className="chat-group-members">{group.members.length} members</span> */}
                                {/* Leave Group Button */}
                                {group.members.some(m => (typeof m === 'object' ? m.username : m) === user.username) && (
                                    <button
                                        className="leave-group-list-btn"
                                        style={{ marginLeft: 10, background: '#e53e3e', color: '#fff', border: 'none', borderRadius: '5px', padding: '6px 14px', fontWeight: 600, fontSize: '0.95em', cursor: 'pointer' }}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowLeaveGroupConfirm(group);
                                        }}
                                    >
                                        X
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="chat-main-col">
                    {groups.length === 0 ? (
                        <div style={{ textAlign: 'center', marginTop: '40px', color: '#aaa', fontSize: '1.2em' }}>
                            You are not a member of any group yet.<br />
                            Create a new group or ask someone to add you to a group!
                        </div>
                    ) : !selectedGroup ? (
                        <div style={{ textAlign: 'center', marginTop: '40px', color: '#aaa', fontSize: '1.2em' }}>
                            Select a group to chat with.
                        </div>
                    ) : (
                        <>
                            <div className="group-header-frame">
                                <div style={{ marginLeft: 20, fontSize: '1.5em', fontWeight: 700, color: '#3182ce', textAlign: 'center', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div className="header-avatar-container">
                                        <div className="header-avatar">
                                            {selectedGroup.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            {selectedGroup.name.length > 5
                                                ? selectedGroup.name.slice(0, 5) + '...'
                                                : selectedGroup.name}
                                        </div>
                                    </div>
                            </div>
                                {/* Group Header Framed Section - Option 2: All in a single row */}
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                    <div className="group-header-row">
                                        {/* <div className="group-header-avatar">
                                  {selectedGroup && selectedGroup.name ? selectedGroup.name.charAt(0).toUpperCase() : 'G'}
                                </div> */}
                                        <div className="group-header-info">
                                            
                                            <div className="group-header-members">
                                                <span
                                                    style={{ fontWeight: 700, color: '#ffe082', cursor: 'pointer', textDecoration: 'underline dotted' }}
                                                    title={selectedGroup && selectedGroup.members
                                                        ? selectedGroup.members.map(m => (typeof m === 'string' ? m : m.username)).join(', ')
                                                        : ''}
                                                >
                                                    Members:
                                                </span>
                                                {selectedGroup && selectedGroup.members
                                                    ? (() => {
                                                        const names = selectedGroup.members.map(m => (typeof m === 'string' ? m : m.username));
                                                        const shown = names.slice(0, 4).join(', ');
                                                        const more = names.length > 4 ? ' ...' : '';
                                                        return ` ${shown}${more}`;
                                                    })()
                                                    : ''}
                                            </div>
                                </div>
                                        <div >
                                            <span style={{ color: '#3182ce', fontWeight: 500, marginRight: 6 }}>Add member:</span>

                                            <select
                                                className="add-member-dropdown"
                                                style={{ padding: '7px 12px', borderRadius: '5px', border: '1px solid #3182ce', background: '#1e293b', color: '#e2e8f0', fontWeight: 500 }}
                                        onChange={async e => {
                                                    const username = e.target.value;
                                                    if (username && !selectedGroup.members.some(m => (typeof m === 'string' ? m : m.username) === username)) {
                                                        await addGroupMember(selectedGroup.id, username);
                                            const updatedGroups = await fetchGroups();
                                                        const filteredGroups = updatedGroups.filter(g =>
                                                            g.members && g.members.some(m => (m.username ? m.username === user.username : m === user.username || m === user.id))
                                                        );
                                                        setGroupsState(filteredGroups);
                                                        setPropGroups(filteredGroups);
                                                        const updatedGroup = filteredGroups.find(g => g.id === selectedGroup.id);
                                            if (updatedGroup) setSelectedGroup(updatedGroup);
                                                    }
                                            e.target.value = '';
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>Add user...</option>
                                                {users && selectedGroup && selectedGroup.members && users
                                                    .filter(u => {
                                                        const username = typeof u === 'string' ? u : u.username;
                                                        return !selectedGroup.members.some(m => (typeof m === 'string' ? m : m.username) === username);
                                                    })
                                                    .map(u => {
                                                        const username = typeof u === 'string' ? u : u.username;
                                                        return <option key={username} value={username}>{username}</option>;
                                                    })}
                                            </select></div>
                                    </div>

                                    {isSelectionMode && (
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '0px 25px' }}>
                                            <div style={{ position: 'relative' }}>
                                                <button
                                                    ref={deleteBtnRef}
                                                    onClick={handleDeleteClick}
                                                    style={{
                                                        background: '#e53e3e',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '6px 12px',
                                                        cursor: 'pointer',
                                                        fontSize: '0.8em'
                                                    }}
                                                >
                                                    Delete ({selectedMessages.size})
                                                </button>
                                                {showDeleteOptions === 'selected' && dropdownPos && (
                                                    <DeleteDropdownPortal style={{
                                                        position: 'absolute',
                                                        top: dropdownPos.top,
                                                        left: dropdownPos.left,
                                                        minWidth: dropdownPos.minWidth,
                                                        zIndex: 9999
                                                    }}>
                                                        <button
                                                            onClick={() => {
                                                                handleDeleteSelected('for_me');
                                                                setShowDeleteOptions(null);
                                                            }}
                                                        >
                                                            Delete for me
                                                        </button>
                                                        {allSelectedAreSelf && (
                                                            <button
                                                                onClick={() => {
                                                                    handleDeleteSelected('for_everyone');
                                                                    setShowDeleteOptions(null);
                                                                }}
                                                                style={{ borderTop: '1px solid #eee' }}
                                                            >
                                                                Delete for everyone
                                                            </button>
                                                        )}
                                                    </DeleteDropdownPortal>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setSelectedMessages(new Set());
                                                    setIsSelectionMode(false);
                                                    setShowDeleteOptions(null);
                                                }}
                                                style={{
                                                    background: '#666',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '6px 12px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.8em'
                                                }}
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="chat-window" ref={chatWindowRef}>
                                {isLoading ? (
                                    <div style={{ textAlign: 'center', padding: '20px' }}>Loading messages...</div>
                                ) : (
                                    messages.map((msg, idx) => {
                                        const isSelf = (typeof msg.sender === 'object' ? msg.sender?.username : msg.sender) === user.username;
                                        const isSelected = selectedMessages.has(msg.id);
                                        let poll = msg.poll;
                                        if (!poll && msg.content && typeof msg.content === 'string') {
                                            try {
                                                const parsed = JSON.parse(msg.content);
                                                if (parsed.type === 'poll') poll = parsed;
                                            } catch (e) { }
                                        }
                                        if (poll) {
                                            const pollVotes = msg.pollVotes || {};
                                            const totalVotes = pollVotes ? Object.values(pollVotes).flat().length : 0;
                                            const userVote = pollVotes?.[user.username] || [];
                                            const results = poll.options.map((_, i) =>
                                                pollVotes ? Object.values(pollVotes).flat().filter(v => v === i).length : 0
                                            );
                                            // Check if this poll was sent by the current user
                                            const isSelf = (typeof msg.sender === 'object' ? msg.sender?.username : msg.sender) === user.username;
                                            const originalSender = typeof msg.sender === 'object' && msg.sender !== null ? msg.sender.username : msg.sender;

                                            // Check if this is a multiple choice poll
                                            if (poll.allowMultiple) {
                                            return (
                                                <div
                                                    key={msg.id || idx}
                                                        className={`chat-message ${isSelf ? 'chat-message-self' : 'chat-message-other'} ${selectedMessages.has(msg.id) ? 'chat-message-selected' : ''}`}
                                                    onClick={() => toggleMessageSelection(msg.id)}
                                                    style={{ 
                                                        cursor: 'pointer',
                                                            position: 'relative'
                                                    }}
                                                >
                                                        {selectedMessages.has(msg.id) && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            right: '4px',
                                                            background: '#3182ce',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '20px',
                                                            height: '20px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '12px'
                                                        }}>
                                                            ✓
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start', alignItems: 'center', marginBottom: 2 }}>
                                                            <span style={{
                                                                fontWeight: 600,
                                                                color: isSelf ? '#3182ce' : '#2d3748',
                                                                fontSize: '0.97em',
                                                                marginRight: isSelf ? 0 : 8,
                                                                marginLeft: isSelf ? 8 : 0
                                                            }}>
                                                                {isSelf ? 'You' : originalSender}
                                                        </span>
                                                    </div>
                                                        <MultiplePollVoteUI msg={msg} user={user} setMessages={setMessages} />
                                                        <div className="chat-message-time">
                                                            {(msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : '')} {(msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '')}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // Single choice poll rendering
                                            return (
                                                <div
                                                    key={msg.id || idx}
                                                    className={`chat-message ${isSelf ? 'chat-message-self' : 'chat-message-other'} ${selectedMessages.has(msg.id) ? 'chat-message-selected' : ''}`}
                                                    onClick={() => toggleMessageSelection(msg.id)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        position: 'relative'
                                                    }}
                                                >
                                                    {selectedMessages.has(msg.id) && (
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            right: '4px',
                                                            background: '#3182ce',
                                                            color: 'white',
                                                            borderRadius: '50%',
                                                            width: '20px',
                                                            height: '20px',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '12px'
                                                        }}>
                                                            ✓
                                                        </div>
                                                    )}
                                                    <div style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start', alignItems: 'center', marginBottom: 2 }}>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: isSelf ? '#3182ce' : '#2d3748',
                                                            fontSize: '0.97em',
                                                            marginRight: isSelf ? 0 : 8,
                                                            marginLeft: isSelf ? 8 : 0
                                                        }}>
                                                            {isSelf ? 'You' : originalSender}
                                                                        </span>
                                                    </div>
                                                    <div className="chat-poll-box">
                                                        <div className="poll-header">
                                                            <span className="poll-header-icon">📊</span>
                                                            {poll.question}
                                                        </div>
                                                        <div className="poll-options">
                                                            {poll.options.map((option, i) => {
                                                                const voteCount = Object.values(msg.pollVotes || {}).flat().filter(vote => vote === i).length;
                                                                const totalVotes = Object.values(msg.pollVotes || {}).flat().length;
                                                                const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                                                                const hasVoted = msg.pollVotes?.[user.username || user.id]?.includes(i);

                                                                return (
                                                                    <div key={i} style={{ marginBottom: '8px' }}>
                                                                        <div
                                                                            className={`poll-option ${hasVoted ? 'selected' : ''}`}
                                                                            style={{
                                                                                background: hasVoted
                                                                                    ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.2) 100%)'
                                                                                    : 'linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(22, 33, 62, 0.6) 100%)',
                                                                                border: hasVoted
                                                                                    ? '2px solid rgba(34, 197, 94, 0.6)'
                                                                                    : '2px solid rgba(255, 255, 255, 0.2)',
                                                                                borderRadius: '6px',
                                                                                padding: '8px 10px',
                                                                                cursor: 'pointer',
                                                                                minHeight: '32px',
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                boxShadow: hasVoted
                                                                                    ? '0 3px 12px rgba(74, 222, 128, 0.3)'
                                                                                    : '0 2px 6px rgba(0, 0, 0, 0.15)',
                                                                                position: 'relative',
                                                                                overflow: 'hidden',
                                                                                transition: 'all 0.3s ease'
                                                                            }}
                                                                            onClick={async (e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                console.log('Poll option clicked!', msg.id, i);
                                                                                try {
                                                                                    console.log('Voting on poll:', msg.id, 'option:', i, 'user:', user);
                                                                                    console.log('Message data:', msg);
                                                                                    // Use username if available, otherwise use user ID
                                                                                    const voter = user.username || user.id || user;
                                                                                    console.log('Using voter:', voter);
                                                                                    const updatedMsg = await votePoll(msg.id, voter, i);
                                                                                    console.log('Vote result:', updatedMsg);
                                                                                    // Preserve the original message structure to prevent position changes
                                                                                    const preservedMsg = {
                                                                                        ...updatedMsg,
                                                                                        sender: msg.sender, // Keep original sender
                                                                                        poll: poll // Keep original poll data
                                                                                    };
                                                                                    setMessages(messages => messages.map(m => m.id === msg.id ? preservedMsg : m));
                                                                                } catch (error) {
                                                                                    console.error('Error voting on poll:', error);
                                                                                    alert('Failed to vote. Please try again.');
                                                                                }
                                                                            }}
                                                                        >
                                                                            <div
                                                                                className="poll-progress-bar"
                                                                                style={{ width: `${percentage}%` }}
                                                                            ></div>
                                                                            <div className="poll-option-content">
                                                                                <div className="poll-option-left">
                                                                                    <div className="poll-option-radio"></div>
                                                                                    <span
                                                                                        className="poll-option-text"
                                                                                        style={{ cursor: 'pointer' }}
                                                                                    >
                                                                                        {option}
                                                                                    </span>
                                                        </div>
                                                        </div>
                                                                        </div>
                                                                        <div style={{
                                                                            textAlign: 'right',
                                                                            marginTop: '4px',
                                                                            fontSize: '12px',
                                                                            color: '#4ade80',
                                                                            fontWeight: '600'
                                                                        }}>
                                                                            {Math.round(percentage)}% ({voteCount} vote{voteCount !== 1 ? 's' : ''})
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="poll-total">
                                                            Total votes: {Object.values(msg.pollVotes || {}).flat().length}
                                                        </div>
                                                    </div>
                                                    <div className="chat-message-time">
                                                        {(msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : '')} {(msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '')}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        const dateObj = msg.timestamp ? new Date(msg.timestamp) : null;
                                        const dateStr = dateObj ? dateObj.toLocaleDateString() : '';
                                        const timeStr = dateObj ? dateObj.toLocaleTimeString() : '';
                                        return (
                                            <div
                                                key={msg.id || idx}
                                                className={`chat-message ${isSelf ? 'chat-message-self' : 'chat-message-other'} ${isSelected ? 'chat-message-selected' : ''}`}
                                                onClick={() => toggleMessageSelection(msg.id)}
                                                style={{ 
                                                    cursor: 'pointer',
                                                    position: 'relative',
                                                    border: isSelected ? '2px solid #3182ce' : 'none',
                                                    borderRadius: isSelected ? '8px' : 'inherit'
                                                }}
                                            >
                                                {isSelected && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '4px',
                                                        right: '4px',
                                                        background: '#3182ce',
                                                        color: 'white',
                                                        borderRadius: '50%',
                                                        width: '20px',
                                                        height: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '12px'
                                                    }}>
                                                        ✓
                                                    </div>
                                                )}
                                                <div style={{ display: 'flex', justifyContent: isSelf ? 'flex-end' : 'flex-start', alignItems: 'center', marginBottom: 2 }}>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: isSelected ? '#2d3748' : (isSelf ? '#3182ce' : '#2d3748'),
                                                        fontSize: '0.97em',
                                                        marginRight: isSelf ? 0 : 8,
                                                        marginLeft: isSelf ? 8 : 0
                                                    }}>
                                                        {isSelf ? 'You' : (typeof msg.sender === 'object' && msg.sender !== null ? msg.sender.username : msg.sender)}
                                                    </span>
                                                </div>
                                                {msg.poll ? (
                                                    (() => {
                                                        const totalVotes = msg.pollVotes ? Object.values(msg.pollVotes).flat().length : 0;
                                                        const userVote = msg.pollVotes?.[user.username] || [];
                                                        const results = msg.poll.options.map((_, i) =>
                                                            msg.pollVotes ? Object.values(msg.pollVotes).flat().filter(v => v === i).length : 0
                                                        );
                                                        return (
                                                            <div className="chat-poll-box">
                                                                <div className="poll-header">
                                                                    <span className="poll-header-icon">📊</span>
                                                                    {msg.poll.question}
                                                                </div>
                                                                <div className="poll-options">
                                                                    {msg.poll.options.map((option, i) => {
                                                                        const voteCount = Object.values(msg.pollVotes || {}).flat().filter(vote => vote === i).length;
                                                                        const totalVotes = Object.values(msg.pollVotes || {}).flat().length;
                                                                        const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
                                                                        const hasVoted = msg.pollVotes?.[user.username || user.id]?.includes(i);

                                                                        return (
                                                                            <div key={i} style={{ marginBottom: '8px' }}>
                                                                                <div
                                                                                    className={`poll-option ${hasVoted ? 'selected' : ''}`}
                                                                                    style={{
                                                                                        background: hasVoted
                                                                                            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3) 0%, rgba(22, 163, 74, 0.2) 100%)'
                                                                                            : 'linear-gradient(135deg, rgba(26, 26, 46, 0.8) 0%, rgba(22, 33, 62, 0.6) 100%)',
                                                                                        border: hasVoted
                                                                                            ? '2px solid rgba(34, 197, 94, 0.6)'
                                                                                            : '2px solid rgba(255, 255, 255, 0.2)',
                                                                                        borderRadius: '6px',
                                                                                        padding: '8px 10px',
                                                                                        cursor: 'pointer',
                                                                                        minHeight: '32px',
                                                                                        display: 'flex',
                                                                                        alignItems: 'center',
                                                                                        boxShadow: hasVoted
                                                                                            ? '0 3px 12px rgba(34, 197, 94, 0.3)'
                                                                                            : '0 2px 6px rgba(0, 0, 0, 0.15)',
                                                                                        position: 'relative',
                                                                                        overflow: 'hidden',
                                                                                        transition: 'all 0.3s ease'
                                                                                    }}
                                                                                    onClick={async (e) => {
                                                                                        e.preventDefault();
                                                                                        e.stopPropagation();
                                                                                        console.log('Poll option clicked!', msg.id, i);
                                                                                        try {
                                                                                            console.log('Voting on poll:', msg.id, 'option:', i, 'user:', user);
                                                                                            console.log('Message data:', msg);
                                                                                            // Use username if available, otherwise use user ID
                                                                                            const voter = user.username || user.id || user;
                                                                                            console.log('Using voter:', voter);
                                                                                            const updatedMsg = await votePoll(msg.id, voter, i);
                                                                                            console.log('Vote result:', updatedMsg);
                                                                                            // Preserve the original message structure to prevent position changes
                                                                                            const preservedMsg = {
                                                                                                ...updatedMsg,
                                                                                                sender: msg.sender, // Keep original sender
                                                                                                poll: msg.poll // Keep original poll data
                                                                                            };
                                                                                            setMessages(messages => messages.map(m => m.id === msg.id ? preservedMsg : m));
                                                                                        } catch (error) {
                                                                                            console.error('Error voting on poll:', error);
                                                                                            alert('Failed to vote. Please try again.');
                                                                                        }
                                                                                    }}
                                                                                >
                                                                                    <div
                                                                                        className="poll-progress-bar"
                                                                                        style={{ width: `${percentage}%` }}
                                                                                    ></div>
                                                                                    <div className="poll-option-content">
                                                                                        <div className="poll-option-left">
                                                                                            <div className="poll-option-radio"></div>
                                                                                            <span
                                                                                                className="poll-option-text"
                                                                                                style={{ cursor: 'pointer' }}
                                                                                            >
                                                                                                {option}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                                <div style={{
                                                                                    textAlign: 'right',
                                                                                    marginTop: '4px',
                                                                                    fontSize: '12px',
                                                                                    color: '#4ade80',
                                                                                    fontWeight: '600'
                                                                                }}>
                                                                                    {Math.round(percentage)}% ({voteCount} vote{voteCount !== 1 ? 's' : ''})
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                <div className="poll-total">
                                                                    Total votes: {Object.values(msg.pollVotes || {}).flat().length}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()
                                                ) : msg.audioUrl ? (
                                                    <audio controls src={msg.audioUrl} style={{ width: '100%' }} />
                                                ) : msg.imageUrl ? (
                                                    <>
                                                    <img src={msg.imageUrl} alt="attachment" className="chat-img" />
                                                        <div className="chat-message-time">
                                                            {(msg.timestamp ? new Date(msg.timestamp).toLocaleDateString() : '')} {(msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '')}
                                                        </div>
                                                    </>
                                                ) : msg.documentUrl && msg.documentName ? (
                                                    <div>
                                                        <a href={msg.documentUrl} download={msg.documentName} className="chat-doc-link">
                                                            📄 {msg.documentName}
                                                        </a>
                                                        <div className="chat-message-time">
                                                            {dateStr} {timeStr}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <span style={{
                                                            color: isSelected ? '#1a202c' : 'inherit',
                                                            fontWeight: isSelected ? '600' : 'inherit'
                                                        }}>
                                                            {msg.text || msg.content || msg.message}
                                                        </span>
                                                        <div className="chat-message-time">
                                                            {dateStr} {timeStr}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                            <form onSubmit={handleSend} className="chat-form">
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', position: 'relative', flexDirection: 'row' }}>
                                    <div style={{ position: 'relative' }}>
                                        <button type="button" className="icon-btn" onClick={() => {
                                            console.log('Attach button clicked, current showDropdown:', showDropdown);
                                            setShowDropdown(!showDropdown);
                                        }} title="Attach">
                                            <i className="fa fa-paperclip" style={{ fontSize: "28px" }}></i>
                                    </button>
                                    {showDropdown && (
                                        <div className="chat-attach-dropdown">
                                            <div className="chat-attach-dropdown-item" onClick={() => { setAttachType('image'); setShowDropdown(false); }}>
                                                🖼️ Image
                                            </div>
                                            <div className="chat-attach-dropdown-item" onClick={() => { setAttachType('document'); setShowDropdown(false); }}>
                                                📄 Document
                                            </div>
                                                <div className="chat-attach-dropdown-item" onClick={() => { setShowPollForm(true); setShowDropdown(false); }}>
                                                📊 Poll
                                            </div>
                                        </div>
                                    )}
                                    </div>
                                            <input
                                                type="text"
                                        value={newMessage}
                                        onChange={e => setNewMessage(e.target.value)}
                                        placeholder={`Message @${selectedGroup.name}`}
                                        style={{ flex: 1, minWidth: 0 }}
                                    />
                                    <button type="submit">
                                        Send
                                    </button>
                                    {(selectedImage || selectedDocument) && (
                                        <button
                                            type="button"
                                            className="cancel-btn"
                                            onClick={() => {
                                                setSelectedImage(null);
                                                setSelectedDocument(null);
                                                setAttachType(null);
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    )}
                                    {attachType === 'image' && !selectedImage && (
                                        <div className="file-upload-section" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleSendWithImage}
                                                id="image-upload"
                                                style={{ display: 'none' }}
                                            />
                                            <label htmlFor="image-upload" className="file-upload-label" style={{ flex: 1 }}>
                                                <div className="file-upload-content">
                                                    <span className="file-upload-icon">🖼️</span>
                                                    <span className="file-upload-text">Select image</span>
                                                </div>
                                            </label>
                                            <button
                                                type="button"
                                                className="file-close-btn"
                                                onClick={() => {
                                                    setAttachType(null);
                                                    setSelectedImage(null);
                                                }}
                                                title="Close"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}
                                    {selectedImage && (
                                        <div className="selected-file-inline" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="selected-file-content" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '8px 12px',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                borderRadius: '8px',
                                                color: '#e2e8f0',
                                                fontSize: '0.9rem',
                                                flex: 1
                                            }}>
                                                <span>🖼️</span>
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {selectedImage.name}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    {attachType === 'document' && !selectedDocument && (
                                        <div className="file-upload-section" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.txt,.ppt,.pptx,.xls,.xlsx"
                                                onChange={handleSendWithDocument}
                                                id="document-upload"
                                                style={{ display: 'none' }}
                                            />
                                            <label htmlFor="document-upload" className="file-upload-label" style={{ flex: 1 }}>
                                                <div className="file-upload-content">
                                                    <span className="file-upload-icon">📄</span>
                                                    <span className="file-upload-text">Select document</span>
                                                </div>
                                            </label>
                                            <button
                                                type="button"
                                                className="file-close-btn"
                                                onClick={() => {
                                                    setAttachType(null);
                                                    setSelectedDocument(null);
                                                }}
                                                title="Close"
                                            >
                                                ✕
                                                </button>
                                        </div>
                                    )}
                                    {selectedDocument && (
                                        <div className="selected-file-inline" style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="selected-file-content" style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '8px 12px',
                                                background: 'rgba(255, 255, 255, 0.1)',
                                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                                borderRadius: '8px',
                                                color: '#e2e8f0',
                                                fontSize: '0.9rem',
                                                flex: 1
                                            }}>
                                                <span>📄</span>
                                                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {selectedDocument.documentName}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                            </div>



                            </form>
                        </>
                    )}
                </div>
            </div>
            {showCreateGroupModal && (
                <div className="modal-overlay">
                    <div className="create-group-modal">
                        <div className="modal-header">
                            <div className="modal-icon">👥</div>
                            <h2 className="modal-title">Create New Group</h2>
                            <button
                                className="modal-close-btn"
                                onClick={() => {
                                    setShowCreateGroupModal(false);
                                    setGroupName('');
                                    setSelectedMembers([]);
                                    setError('');
                                    setSuccessMessage('');
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateGroup} className="create-group-form">
                            <div className="form-section">
                                <div className="form-field">
                                    <label className="form-label">
                                        <span className="label-icon">📝</span>
                                        Group Name
                                    </label>
                                    <input
                                        type="text"
                                        value={groupName}
                                        onChange={e => setGroupName(e.target.value)}
                                        placeholder="Enter a creative group name..."
                                        className="form-input"
                                    />
                                </div>

                                <div className="form-field">
                                    <label className="form-label">
                                        <span className="label-icon">👤</span>
                                        Add Members
                                        <span className="optional-text">(Optional)</span>
                                    </label>
                                    <div className="member-selector">
                                        <select
                                            className="member-select"
                                            onChange={(e) => {
                                                const selectedUsername = e.target.value;
                                                if (selectedUsername && !selectedMembers.includes(selectedUsername)) {
                                                    setSelectedMembers(prev => [...prev, selectedUsername]);
                                                }
                                                e.target.value = '';
                                            }}
                                            value=""
                                        >
                                            <option value="" disabled>Choose members to invite...</option>
                                            {users
                                                .filter(u => {
                                                    const username = typeof u === 'string' ? u : u.username;
                                                    return username !== user.username &&
                                                        username !== 'You' &&
                                                        !selectedMembers.includes(username);
                                                })
                                                .map(u => {
                                                    const username = typeof u === 'string' ? u : u.username;
                                                    return (
                                                        <option key={username} value={username}>
                                                            {username}
                                                        </option>
                                                    );
                                                })}
                                        </select>
                                    </div>

                                    {selectedMembers.length > 0 && (
                                        <div className="selected-members-section">
                                            <div className="members-header">
                                                <span className="members-count">{selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected</span>
                                            </div>
                                            <div className="members-grid">
                                                {selectedMembers.map(username => (
                                                    <div key={username} className="member-chip">
                                                        <div className="member-avatar">
                                                            {username.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="member-name">{username}</span>
                                                        <button
                                                            type="button"
                                                            className="remove-member-btn"
                                                            onClick={() => setSelectedMembers(prev => prev.filter(m => m !== username))}
                                                            title="Remove member"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {error && (
                                    <div className="error-banner">
                                        <span className="error-icon">⚠️</span>
                                        {error}
                                    </div>
                                )}
                                {successMessage && (
                                    <div className="success-banner">
                                        <span className="success-icon">✅</span>
                                        {successMessage}
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => {
                                        setShowCreateGroupModal(false);
                                        setGroupName('');
                                        setSelectedMembers([]);
                                        setError('');
                                        setSuccessMessage('');
                                    }}
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn-primary">
                                    <span className="btn-icon">🚀</span>
                                    Create Group
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {showLeaveModal && selectedGroup && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <div className="modal-title">Leave Group</div>
                        <div className="modal-body">Are you sure you want to leave <b>{selectedGroup.name}</b>?</div>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setShowLeaveModal(false)}>Cancel</button>
                            <button className="modal-btn modal-btn-remove" onClick={confirmLeaveGroup}>Leave</button>
                        </div>
                    </div>
                </div>
            )}
            {showPollForm && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <div className="modal-title">Create Poll</div>
                        <div className="modal-body">
                            <div className="poll-form-group">
                                <label>Question:</label>
                                <input
                                    type="text"
                                    value={pollQuestion}
                                    onChange={e => setPollQuestion(e.target.value)}
                                    placeholder="Enter your question..."
                                />
                            </div>
                            <div className="poll-form-group">
                                <label>Options:</label>
                                {pollOptions.map((option, index) => (
                                    <div key={index} className="poll-option-input">
                                        <input
                                            type="text"
                                            value={option}
                                            onChange={e => {
                                                const newOptions = [...pollOptions];
                                                newOptions[index] = e.target.value;
                                                setPollOptions(newOptions);
                                            }}
                                            placeholder={`Option ${index + 1}`}
                                        />
                                        {pollOptions.length > 2 && (
                                            <button
                                                type="button"
                                                className="poll-remove-option"
                                                onClick={() => {
                                                    const newOptions = pollOptions.filter((_, i) => i !== index);
                                                    setPollOptions(newOptions);
                                                }}
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    className="poll-add-option"
                                    onClick={() => setPollOptions([...pollOptions, ''])}
                                >
                                    + Add Option
                                </button>
                            </div>
                            <div className="poll-form-group">
                                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={allowMultipleVotes}
                                        onChange={e => setAllowMultipleVotes(e.target.checked)}
                                    />
                                    <span style={{ marginLeft: '8px' }}>Allow multiple votes</span>
                                </label>
                            </div>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="modal-btn-cancel"
                                    style={{
                                        background: 'rgba(226, 26, 26, 0.5)',
                                        color: '#e2e8f0',
                                        padding: '10px 22px',
                                        border: '1px solid rgba(255, 255, 255, 0.2)',
                                    }}
                                    onClick={() => {
                                        setShowPollForm(false);
                                        setPollQuestion('');
                                        setPollOptions(['', '']);
                                        setAllowMultipleVotes(false);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="modal-btn"
                                    onClick={handleCreatePoll}
                                    disabled={!pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2}
                                    style={{
                                        background: !pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2
                                            ? 'rgba(255, 255, 255, 0.1)'
                                            : 'linear-gradient(135deg, #3182ce 0%, #2c5aa0 100%)',
                                        color: '#fff',
                                        boxShadow: !pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2
                                            ? 'none'
                                            : '0 4px 12px rgba(49, 130, 206, 0.3)',
                                        cursor: !pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2
                                            ? 'not-allowed'
                                            : 'pointer',
                                        marginLeft: '10px',
                                        padding: '10px 22px',
                                    }}
                                >
                                    Create Poll
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showLeaveGroupConfirm && (
                <div className="modal-overlay">
                    <div className="modal-dialog">
                        <div className="modal-title">Leave Group</div>
                        <div className="modal-body">Are you sure you want to leave <b>{showLeaveGroupConfirm.name}</b>?</div>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setShowLeaveGroupConfirm(null)}>Cancel</button>
                            <button className="modal-btn modal-btn-remove" onClick={async () => {
                                try {
                                    await removeGroupMember(showLeaveGroupConfirm.id, user.username);
                                    const updatedGroups = await fetchGroups();
                                    const filteredGroups = updatedGroups.filter(g =>
                                        g.members && g.members.some(m => (m.username ? m.username === user.username : m === user.username || m === user.id))
                                    );
                                    setGroupsState(filteredGroups);
                                    setPropGroups(filteredGroups);
                                    if (selectedGroup && selectedGroup.id === showLeaveGroupConfirm.id) setSelectedGroup(null);
                                    setShowLeaveGroupConfirm(null);
                                } catch (error) {
                                    console.error('Error leaving group:', error);
                                    alert('Failed to leave group. Please try again.');
                                }
                            }}>Leave</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default GroupPage; 