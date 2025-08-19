import React, { useState, useRef, useEffect } from 'react';
import './ChatPage.css';
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
  const res = await fetch('http://localhost:8000/api/chat/upload/', {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();
  return data.url;
}

function ChatPage({
  user,
  users,
  selectedUser,
  setSelectedUser,
  messages,
  input,
  setInput,
  handleSend,
  deleteMessage,
  fetchMessages,
  setMessages,
  messagesEndRef,
  chatWindowRef,
  onDeleteFriend,
  unreadCounts = {},
}) {

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [attachType, setAttachType] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // {user: ...} or null
  const [selectedMessages, setSelectedMessages] = useState(new Set()); // Set of message IDs
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showDeleteOptions, setShowDeleteOptions] = useState(null); // messageId or 'selected' for bulk delete
  const filteredUsers = Array.isArray(users)
    ? users.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  // chatWindowRef is now passed from App.js
  const wasAtBottom = useRef(true);
  const prevSelectedUser = useRef(selectedUser);
  const prevMessagesLength = useRef(messages.length);

  // Track scroll manually
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

  // Scroll to bottom only when opening a new chat or when new messages arrive
  useEffect(() => {
    if (selectedUser && chatWindowRef.current) {
      // Check if this is a new chat (user changed) or new messages arrived
      const isNewChat = prevSelectedUser.current !== selectedUser;
      const hasNewMessages = messages.length > prevMessagesLength.current;

      if (isNewChat || hasNewMessages) {
        // Force scroll to bottom when opening a new chat or receiving new messages
        setTimeout(() => {
          if (chatWindowRef.current) {
            chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
          }
        }, 100);
      }
    }
    prevSelectedUser.current = selectedUser;
    prevMessagesLength.current = messages.length;
  }, [selectedUser, messages, messagesEndRef, chatWindowRef]);

  // Clear selection when changing users
  useEffect(() => {
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
    setShowDeleteOptions(null);
  }, [selectedUser]);

  // Handle clicking outside delete options dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDeleteOptions && !event.target.closest('.delete-options-dropdown')) {
        setShowDeleteOptions(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDeleteOptions]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showDropdown && !event.target.closest('.chat-attach-dropdown') && !event.target.closest('.icon-btn')) {
        console.log('ChatPage: Click outside detected, closing dropdown');
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Handle message selection
  const toggleMessageSelection = (messageId) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessages(newSelected);
    setIsSelectionMode(newSelected.size > 0);
  };

  // Handle single message delete
  const handleDeleteMessage = async (messageId, deleteType = 'for_me') => {
    const response = await deleteMessage(messageId, deleteType, user.username);

    if (response && response.error) {
      alert(response.error);
      return;
    }

    if (selectedUser) {
      try {
        const updatedMessages = await fetchMessages(user.username, selectedUser.username);

        // Check if the response is an error object
        if (updatedMessages && updatedMessages.error) {
          console.error('Error fetching messages:', updatedMessages.error);
          return;
        }

        // Ensure updatedMessages is an array
        if (Array.isArray(updatedMessages)) {
          setMessages(updatedMessages);
        } else {
          console.error('Invalid response format for messages:', updatedMessages);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error in handleDeleteMessage:', error);
        setMessages([]);
      }
    }
  };

  // Handle delete selected messages
  const handleDeleteSelected = async (deleteType = 'for_me') => {
    if (selectedMessages.size === 0) return;

    const promises = Array.from(selectedMessages).map(async (messageId) => {
      const response = await deleteMessage(messageId, deleteType, user.username);
      if (response && response.error) {
        alert(response.error);
        return false;
      }
      return true;
    });

    const results = await Promise.all(promises);
    const allSuccessful = results.every(result => result === true);

    if (allSuccessful) {
      // Refresh messages
      if (selectedUser) {
        try {
          const updatedMessages = await fetchMessages(user.username, selectedUser.username);

          // Check if the response is an error object
          if (updatedMessages && updatedMessages.error) {
            console.error('Error fetching messages:', updatedMessages.error);
            return;
          }

          // Ensure updatedMessages is an array
          if (Array.isArray(updatedMessages)) {
            setMessages(updatedMessages);
          } else {
            console.error('Invalid response format for messages:', updatedMessages);
            setMessages([]);
          }
        } catch (error) {
          console.error('Error in handleDeleteSelected:', error);
          setMessages([]);
        }
      }

      setSelectedMessages(new Set());
      setIsSelectionMode(false);
    }
  };


  const handleSendWithImage = async (e) => {
    e.preventDefault();
    if (!user || !selectedUser) return;
    if (selectedImage) {
      const imageUrl = await uploadImage(selectedImage);
      await handleSend(e, imageUrl);
      setSelectedImage(null);
      setAttachType(null);
      setShowDropdown(false);
    } else if (selectedDocument) {
      const documentUrl = URL.createObjectURL(selectedDocument); // Replace with real upload logic
      // Send a message with the document URL and name
      await handleSend(e, null, { documentUrl, documentName: selectedDocument.name });
      setSelectedDocument(null);
      setAttachType(null);
      setShowDropdown(false);
    } else {
      await handleSend(e);
    }
  };



  const allSelectedAreSelf = messages.filter(m => selectedMessages.has(m.id)).every(m => {
    const senderUsername = typeof m.sender === 'object' ? m.sender?.username : m.sender;
    return senderUsername === user.username;
  });

  useEffect(() => {
    setInput && setInput('');
    setSelectedImage(null);
    setSelectedDocument(null);
    setAttachType(null);
    setSelectedMessages(new Set());
    setIsSelectionMode(false);
  }, [selectedUser]);

  const deleteBtnRef = useRef(null);
  const [dropdownPos, setDropdownPos] = useState(null);

  const handleDeleteClick = () => {
    if (showDeleteOptions === 'selected') {
      setShowDeleteOptions(null);
      return;
    }
    if (deleteBtnRef.current) {
      const rect = deleteBtnRef.current.getBoundingClientRect();
      const dropdownHeight = 80; // Approximate height of dropdown
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > dropdownHeight
        ? rect.bottom + window.scrollY
        : rect.top + window.scrollY - dropdownHeight;
      setDropdownPos({
        top,
        left: rect.left + window.scrollX,
        minWidth: rect.width
      });
      setShowDeleteOptions('selected');
    }
  };

  return (<>
    <div className="main-container">
      <div className="chat-header">
        <div className="header-avatar-container">
          <div className="header-avatar">
            {user.username.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ margin: 0, color: '#3182ce', fontSize: '1.5em', fontWeight: 700 }}>{user.username}</h2>
        </div>
        {/* Removed refresh friends button */}
      </div>
      <div className="chat-flex-layout">
        <div className="chat-users-col">
          <b>Users:</b>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="chat-users-search"
          />
          <ul className="chat-users-ul">
            {filteredUsers.map(u => (
              <li key={u.id} className={`chat-users-li-flex${selectedUser && selectedUser.id === u.id ? ' chat-users-li-selected' : ''}`}>
                <button
                  className={`chat-user-btn${selectedUser && selectedUser.id === u.id ? ' chat-user-selected' : ''}`}
                  onClick={() => setSelectedUser(u)}
                >
                  <span className="chat-user-avatar">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt={u.username} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                    ) : (
                      u.username.charAt(0).toUpperCase()
                    )}
                  </span>
                  <span className="chat-user-username">{u.username}</span>
                  {unreadCounts[u.id] > 0 && (
                    <span className="chat-unread-badge">{unreadCounts[u.id] > 9 ? '9+' : unreadCounts[u.id]}</span>
                  )}
                </button>
                <button
                  className="chat-remove-friend-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setConfirmRemove(u);
                  }}
                  title="Remove Friend"
                  type="button"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        {selectedUser ? (
          <div className="chat-main-col">
            <div className="chat-header" style={{
              padding: '7px 20px', background: 'radial-gradient(circle at 50.3% 47.3%, #54533f 0.1%, rgb(6 30 89 / 66%) 90%)',
              textAlign: 'center', fontSize: '1.5em', fontWeight: 700, color: '#3182ce', marginBottom: 8, width: '-webkit-fill-available', display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div className="chat-user-avatar">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt={selectedUser.username} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
                  ) : (
                    selectedUser.username.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  {selectedUser.username}
                </div>
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
            <div className="chat-window" ref={chatWindowRef}>
              {messages.map((msg, idx) => {
                // Modern chat bubble style
                const isSelf = (typeof msg.sender === 'object' ? msg.sender?.username : msg.sender) === user.username;
                const displayName = isSelf
                  ? 'You'
                  : (typeof msg.sender === 'object' && msg.sender !== null)
                    ? msg.sender.username
                    : msg.sender || (selectedUser?.username || '');
                const dateObj = msg.timestamp ? new Date(msg.timestamp) : null;
                const dateStr = dateObj ? dateObj.toLocaleDateString() : '';
                const timeStr = dateObj ? dateObj.toLocaleTimeString() : '';
                const isSelected = selectedMessages.has(msg.id);

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
                        color: isSelected ? '#456db1' : (isSelf ? '#3182ce' : '#456db1'),
                        fontSize: '0.97em',
                        marginRight: isSelf ? 0 : 8,
                        marginLeft: isSelf ? 8 : 0
                      }}>
                        {displayName}
                      </span>
                    </div>
                    {msg.imageUrl ? (
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
              })}
              {/* <div ref={messagesEndRef} /> */}
            </div>
            <div className="chat-form">
              <form onSubmit={handleSendWithImage} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', position: 'relative', flexDirection: 'row' }}>
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="icon-btn" onClick={() => {
                      console.log('ChatPage: Attach button clicked, current showDropdown:', showDropdown);
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
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder={`Message @${selectedUser.username}`}
                    style={{ flex: 1, minWidth: 0 }}
                  />
                  <button type="submit">Send</button>
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
                        onChange={e => setSelectedImage(e.target.files[0])}
                        id="chat-image-upload"
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="chat-image-upload" className="file-upload-label" style={{ flex: 1 }}>
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
                        onChange={e => setSelectedDocument(e.target.files[0])}
                        id="chat-document-upload"
                        style={{ display: 'none' }}
                      />
                      <label htmlFor="chat-document-upload" className="file-upload-label" style={{ flex: 1 }}>
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
                          {selectedDocument.name}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="chat-main-col"><div>Select a user to chat with.</div></div>
        )}
      </div>
    </div>
    {confirmRemove && (
      <div className="modal-overlay">
        <div className="modal-dialog">
          <div className="modal-title">Remove Friend</div>
          <div className="modal-body">Are you sure you want to remove <b>{confirmRemove.username}</b> from your friends?</div>
          <div className="modal-actions">
            <button className="modal-btn modal-btn-cancel" onClick={() => setConfirmRemove(null)}>Cancel</button>
            <button className="modal-btn modal-btn-remove" onClick={() => {
              if (onDeleteFriend) onDeleteFriend(confirmRemove);
              setConfirmRemove(null);
            }}>Remove</button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}

export default ChatPage;

