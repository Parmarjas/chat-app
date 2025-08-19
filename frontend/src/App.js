import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { register, login, logout, fetchUsers, fetchMessages, sendMessage, deleteMessage, updateProfile, fetchGroups, checkNewChats, fetchFriends, fetchCurrentUser } from './api';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ChatPage from './ChatPage';
import SideNavBar from './SideNavBar';
import './SideNavBar.css';
import ProfilePage from './ProfilePage';
import AddFriendPage from './AddFriendPage';
import GroupPage from './GroupPage';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';

function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    const parsedUser = saved ? JSON.parse(saved) : null;
    console.log('Initializing user from localStorage:', parsedUser);
    return parsedUser;
  });
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [input, setInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [sideNavActive, setSideNavActive] = useState(() => {
    const saved = localStorage.getItem('sideNavActive');
    return saved || 'chats';
  });
  const messagesEndRef = useRef(null);
  const pollingRef = useRef(null);
  const chatWindowRef = useRef(null);
  const [unreadCounts, setUnreadCounts] = useState({});

  const navigate = useNavigate();

  // Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    if (!username.trim() || !password.trim()) {
      setLoginError('Username and password required');
      return;
    }
    const res = await login(username.trim(), password.trim());
    if (res && res.id) {
      setUser(res);
      setSideNavActive('profile');
      localStorage.setItem('user', JSON.stringify(res));
      localStorage.setItem('sideNavActive', 'profile');
      navigate('/');
    } else if (res && res.error) {
      setLoginError(res.error);
    } else {
      setLoginError('Unknown error');
    }
  };

  // Register
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');
    if (!username.trim() || !password.trim()) {
      setRegisterError('Username and password required');
      return;
    }
    const res = await register(username.trim(), password.trim());
    if (res && res.id) {
      setUsername('');
      setPassword('');
      setRegisterError('');
      window.location.href = '/login';
    } else if (res && res.error) {
      setRegisterError(res.error);
    } else {
      setRegisterError('Unknown error');
    }
  };

  // Logout
  const handleLogout = async () => {
    console.log('Logging out, clearing all state...');
    
    // Call backend logout endpoint to clear session
    try {
      await logout();
      console.log('Backend logout successful');
    } catch (error) {
      console.error('Backend logout error:', error);
    }
    
    // Clear frontend state
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('sideNavActive');
    setUsername('');
    setPassword('');
    setSelectedUser(null);
    setMessages([]);
    setFriends([]); // Clear friends list on logout
    setUsers([]); // Clear users list on logout
    setGroups([]); // Clear groups on logout
    setUnreadCounts({}); // Clear unread counts on logout
    console.log('Logout complete, all state cleared');
  };

  // Fetch users (except self)
  useEffect(() => {
    if (!user) return;
    const getUsers = async () => {
      const res = await fetchUsers();
      setUsers(res.filter(u => u.username !== user.username));
    };
    getUsers();
  }, [user]);

  // Fetch friends from backend on login
  useEffect(() => {
    console.log('Friends useEffect triggered, user:', user ? user.username : 'null');
    if (!user) {
      console.log('No user, clearing friends list');
      setFriends([]); // Clear friends when no user is logged in
      return;
    }
    const getFriends = async () => {
      try {
        console.log('Fetching friends for user:', user.username);
        const res = await fetchFriends();
        console.log('Friends API response:', res);
        setFriends(Array.isArray(res) ? res : []);
        console.log('Friends fetched:', res); // Debug log
      } catch (error) {
        console.error('Error fetching friends:', error);
        setFriends([]);
      }
    };
    getFriends();
  }, [user]);

  // Add a manual refresh function
  const refreshFriends = async () => {
    if (!user) return;
    try {
      const res = await fetchFriends();
      setFriends(Array.isArray(res) ? res : []);
      console.log('Friends refreshed:', res); // Debug log
    } catch (error) {
      console.error('Error refreshing friends:', error);
      setFriends([]);
    }
  };

  // Fetch groups with polling
  useEffect(() => {
    const fetchAndUpdateGroups = async () => {
      const allGroups = await fetchGroups();
      // Filter groups to only those where the user is a member
      if (user && allGroups && Array.isArray(allGroups)) {
        // Some APIs return members as objects, some as usernames/ids
        const filtered = allGroups.filter(g =>
          g.members && g.members.some(m => (m.username ? m.username === user.username : m === user.username || m === user.id))
        );
        setGroups(filtered);
      } else {
        setGroups([]);
      }
    };
    fetchAndUpdateGroups();
    const interval = setInterval(fetchAndUpdateGroups, 5000); // every 5 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Check for new chats and auto-add to friends list
  useEffect(() => {
    if (!user) return;
    
    const checkForNewChats = async () => {
      try {
        const chatUsers = await checkNewChats(user.username);
        // Note: Auto-adding friends is now handled by the backend friends system
        // Users will need to manually add friends through the AddFriendPage
      } catch (error) {
        console.error('Error checking for new chats:', error);
      }
    };
    
    checkForNewChats();
    const interval = setInterval(checkForNewChats, 3000); // every 3 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Fetch messages (polling)
  useEffect(() => {
    if (!user || !selectedUser) return;
    const fetchAndSetMessages = async () => {
      try {
      const res = await fetchMessages(user.username, selectedUser.username);
        
        // Check if the response is an error object
        if (res && res.error) {
          console.error('Error fetching messages:', res.error);
          return;
        }
        
        // Ensure res is an array
        if (Array.isArray(res)) {
      setMessages(res);
      
      // Mark messages as read for selectedUser
      setUnreadCounts(prev => ({ ...prev, [selectedUser.id]: 0 }));
        } else {
          console.error('Invalid response format for messages:', res);
          setMessages([]);
        }
      } catch (error) {
        console.error('Error in fetchAndSetMessages:', error);
        setMessages([]);
      }
    };
    fetchAndSetMessages();
    pollingRef.current = setInterval(fetchAndSetMessages, 2000);
    return () => clearInterval(pollingRef.current);
  }, [user, selectedUser, users, friends]);

  // Helper to get/set last read message ID for a friend
  function getLastReadId(friendId) {
    return localStorage.getItem('lastRead_' + friendId);
  }
  function setLastReadId(friendId, msgId) {
    localStorage.setItem('lastRead_' + friendId, msgId);
  }

  // Poll for new messages from all friends and update unreadCounts using last read message ID
  useEffect(() => {
    if (!user) return;
    const pollUnread = async () => {
      for (const friend of friends) {
        if (!selectedUser || friend.id !== selectedUser.id) {
          try {
          const res = await fetchMessages(user.username, friend.username);
            
            // Check if the response is an error object
            if (res && res.error) {
              console.error('Error fetching messages for unread count:', res.error);
              continue; // Skip this friend and continue with the next one
            }
            
            // Ensure res is an array
            if (!Array.isArray(res)) {
              console.error('Invalid response format for messages:', res);
              continue;
            }
            
          // Get last read message ID for this friend
          const lastReadId = getLastReadId(friend.id);
          // Only count messages sent by friend to user that are newer than lastReadId
          let newMsgs = res.filter(m => (typeof m.sender === 'object' ? m.sender.username : m.sender) === friend.username);
          if (lastReadId) {
            // Only count messages with id > lastReadId (assuming id is increasing)
            newMsgs = newMsgs.filter(m => m.id > lastReadId);
          }
          if (newMsgs.length > 0) {
            setUnreadCounts(prev => ({ ...prev, [friend.id]: newMsgs.length }));
          } else {
            setUnreadCounts(prev => ({ ...prev, [friend.id]: 0 }));
            }
          } catch (error) {
            console.error('Error in pollUnread for friend:', friend.username, error);
            // Continue with next friend instead of breaking the entire loop
          }
        }
      }
    };
    const interval = setInterval(pollUnread, 3000);
    return () => clearInterval(interval);
  }, [user, friends, selectedUser, messages]);

  // When selectedUser changes, mark their messages as read and persist last read message ID
  useEffect(() => {
    if (selectedUser && messages.length > 0) {
      // Find the latest message from this chat
      const latestMsg = messages[messages.length - 1];
      if (latestMsg && latestMsg.id) {
        setLastReadId(selectedUser.id, latestMsg.id);
      }
      setUnreadCounts(prev => ({ ...prev, [selectedUser.id]: 0 }));
    }
  }, [selectedUser, messages]);

  // Send message
  const handleSend = async (e, imageUrl = null, document = null) => {
    e.preventDefault();
    if ((!input.trim() && !imageUrl && !document) || !user || !selectedUser) return;
    
    const response = await sendMessage(user.username, selectedUser.username, input, imageUrl, document);
    
    if (response && response.error) {
      // Show error message to user
      alert(response.error);
      return;
    }
    
    setInput('');
    // message will appear on next poll
  };


  // SideNavBar handlers
  const handleChats = () => setSideNavActive('chats');
  const handleGroups = () => setSideNavActive('groups');
  const handleProfile = () => setSideNavActive('profile');
  const handleAddFriend = () => setSideNavActive('addfriend');

  // Add friend
  const handleSendFriendRequest = async (userToAdd) => {
    try {
      const response = await fetch('http://localhost:8000/api/chat/users/' + userToAdd.id + '/add_friend/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({}) // No need to send username since we're using authentication
      });
      
      if (response.ok) {
        // Refresh friends list from backend
        const updatedFriends = await fetchFriends();
        setFriends(Array.isArray(updatedFriends) ? updatedFriends : []);
      setSelectedUser(userToAdd);
      setSideNavActive('chats');
      setMessages([]);
      } else {
        const errorText = await response.text();
        let userFriendlyError = 'Failed to add friend. Please try again.';
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            userFriendlyError = errorData.error;
          }
        } catch (parseError) {
          userFriendlyError = 'Failed to add friend. Please try again.';
        }
        
        alert(userFriendlyError);
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      alert('Network error. Please check your connection and try again.');
    }
  };

  // Remove friend
  const handleDeleteFriend = async (userToRemove) => {
    try {
      console.log('Attempting to remove friend:', userToRemove);
      const response = await fetch('http://localhost:8000/api/chat/users/' + userToRemove.id + '/remove_friend/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          user_id: user.id  // Send current user's ID
        })
      });
      
      console.log('Remove friend response status:', response.status);
      
      if (response.ok) {
        console.log('Friend removed successfully');
        // Refresh friends list from backend
        const updatedFriends = await fetchFriends();
        setFriends(Array.isArray(updatedFriends) ? updatedFriends : []);
        if (selectedUser && selectedUser.id === userToRemove.id) {
          setSelectedUser(null);
          setMessages([]);
        }
      } else {
        const errorText = await response.text();
        console.log('Remove friend error response:', errorText);
        console.log('Response status:', response.status);
        
        let userFriendlyError = 'Failed to remove friend. Please try again.';
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            userFriendlyError = errorData.error;
          }
        } catch (parseError) {
          console.log('Failed to parse error response:', parseError);
          userFriendlyError = 'Failed to remove friend. Please try again.';
        }
        
        alert(userFriendlyError);
      }
    } catch (error) {
      console.error('Error removing friend:', error);
      alert('Network error. Please check your connection and try again.');
    }
  };

  // Save profile changes
  const handleSaveProfile = async (updatedUser) => {
    try {
      const savedUser = await updateProfile(updatedUser);
      setUser(savedUser);
      localStorage.setItem('user', JSON.stringify(savedUser));
    } catch (err) {
      alert('Failed to save profile.');
    }
  };

  // Persist sideNavActive to localStorage
  useEffect(() => {
    localStorage.setItem('sideNavActive', sideNavActive);
  }, [sideNavActive]);

  // Refresh user data from backend if user exists but is missing data
  useEffect(() => {
    if (user && (!user.username || !user.id)) {
      console.log('User object is missing required data, attempting to refresh...');
      // Try to fetch fresh user data from backend
      const refreshUserData = async () => {
        try {
          const freshUser = await fetchCurrentUser();
          if (freshUser && freshUser.username) {
            setUser(freshUser);
            localStorage.setItem('user', JSON.stringify(freshUser));
            console.log('Successfully refreshed user data:', freshUser);
          } else {
            // If we can't get fresh data, clear and redirect to login
            setUser(null);
            localStorage.removeItem('user');
            navigate('/login');
          }
        } catch (error) {
          console.error('Failed to refresh user data:', error);
          // Clear corrupted user data and redirect to login
          setUser(null);
          localStorage.removeItem('user');
          navigate('/login');
        }
      };
      refreshUserData();
    }
  }, [user, navigate]);












  
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <LoginForm
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            handleLogin={handleLogin}
            loginError={loginError}
          />
        }
      />
      <Route
        path="/register"
        element={
          <RegisterForm
            username={username}
            setUsername={setUsername}
            password={password}
            setPassword={setPassword}
            handleRegister={handleRegister}
            registerError={registerError}
          />
        }
      />
      <Route
        path="/*"
        element={
          user ? (
            <>
              <div style={{ display: 'flex', minHeight: '100vh' }}>
                <SideNavBar
                  onChats={handleChats}
                  onGroups={handleGroups}
                  onProfile={handleProfile}
                  onAddFriend={handleAddFriend}
                  onLogout={handleLogout}
                  active={sideNavActive}
                />
                <div style={{ marginLeft: 130, flex: 1, transition: 'margin-left 0.2s' }}>
                  {sideNavActive === 'chats' && (
                    <ChatPage
                      user={user}
                      users={friends}
                      selectedUser={selectedUser}
                      setSelectedUser={setSelectedUser}
                      messages={messages}
                      input={input}
                      setInput={setInput}
                      handleSend={handleSend}
                      deleteMessage={deleteMessage}
                      fetchMessages={fetchMessages}
                      setMessages={setMessages}
                      messagesEndRef={messagesEndRef}
                      chatWindowRef={chatWindowRef}
                      onDeleteFriend={handleDeleteFriend}
                      unreadCounts={unreadCounts}
                    />
                  )}
                  {sideNavActive === 'groups' && (
                    <GroupPage users={users} user={user} groups={groups} setGroups={setGroups} />
                  )}
                  {sideNavActive === 'profile' && (
                    <>
                      {console.log('Rendering ProfilePage with user:', user)}
                    <ProfilePage
                      user={user}
                      messages={messages}
                      users={users}
                      editable={true}
                      onSaveProfile={handleSaveProfile}
                      groups={groups}
                    />
                    </>
                  )}
                  {sideNavActive === 'addfriend' && (
                    <AddFriendPage users={users} onAddFriend={handleSendFriendRequest} groups={groups} />
                  )}
                </div>
              </div>
            </>
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  );
}

export default App;
