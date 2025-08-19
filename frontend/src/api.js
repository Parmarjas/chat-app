const API_BASE = 'http://localhost:8000/api/chat';



export async function register(username, password) {
  try {
  const res = await fetch(`${API_BASE}/register/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
    
    if (!res.ok) {
      console.error('Registration failed with status:', res.status);
      const errorText = await res.text();
      console.error('Error response:', errorText);
      
      // Parse the error response to get user-friendly messages
      let userFriendlyError = 'Registration failed. Please try again.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          switch (errorData.error) {
            case 'Username already exists':
              userFriendlyError = 'Username already taken. Please choose a different username.';
              break;
            case 'Username and password required':
              userFriendlyError = 'Please enter both username and password.';
              break;
            case 'Password too short':
              userFriendlyError = 'Password must be at least 8 characters long.';
              break;
            default:
              userFriendlyError = errorData.error;
          }
        }
      } catch (parseError) {
        // If we can't parse the JSON, use a generic message
        userFriendlyError = 'Registration failed. Please try again.';
      }
      
      return { error: userFriendlyError };
    }
    
  return res.json();
  } catch (error) {
    console.error('Registration request failed:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}


export async function login(username, password) {
  try {
  const res = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
    credentials: 'include'
  });
    
    if (!res.ok) {
      console.error('Login failed with status:', res.status);
      const errorText = await res.text();
      console.error('Error response:', errorText);
      
      // Parse the error response to get user-friendly messages
      let userFriendlyError = 'Login failed. Please try again.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          switch (errorData.error) {
            case 'Invalid password':
              userFriendlyError = 'Incorrect password. Please try again.';
              break;
            case 'User not found':
              userFriendlyError = 'Username not found. Please check your username or register.';
              break;
            case 'Username and password required':
              userFriendlyError = 'Please enter both username and password.';
              break;
            default:
              userFriendlyError = errorData.error;
          }
        }
      } catch (parseError) {
        // If we can't parse the JSON, use a generic message
        userFriendlyError = 'Login failed. Please check your credentials and try again.';
      }
      
      return { error: userFriendlyError };
    }
    
  return res.json();
  } catch (error) {
    console.error('Login request failed:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}


export async function logout() {
  const res = await fetch(`${API_BASE}/logout/`, {
    method: 'POST',
    credentials: 'include'
  });
  return res.json();
}

export async function fetchUsers() {
  const res = await fetch(`${API_BASE}/users/`);
  return res.json();
}



export async function fetchMessages(user1, user2) {
  try {
  const res = await fetch(`${API_BASE}/messages/user1=${user1}&user2=${user2}/`);
    
    if (!res.ok) {
      const errorText = await res.text();
      let userFriendlyError = 'Failed to fetch messages. Please try again.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          userFriendlyError = errorData.error;
        }
      } catch (parseError) {
        userFriendlyError = 'Failed to fetch messages. Please try again.';
      }
      
      return { error: userFriendlyError };
    }
    
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Fetch messages failed:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}



export async function fetchFriends() {
  const res = await fetch(`${API_BASE}/friends/`, {
    credentials: 'include' // Include cookies for authentication
  });
  return res.json();
}

export async function fetchCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/current-user/`, {
      credentials: 'include' // Include cookies for authentication
    });
    
    if (!res.ok) {
      throw new Error('Failed to fetch current user');
    }
    
    return res.json();
  } catch (error) {
    console.error('Fetch current user failed:', error);
    throw error;
  }
}


export async function sendGroupMessage({ sender, groupId, content, imageUrl = null, document = null, poll = null }) {
  const body = { sender, group_id: groupId, content };
  if (imageUrl) body.imageUrl = imageUrl;
  if (document && document.documentUrl && document.documentName) {
    body.documentUrl = document.documentUrl;
    body.documentName = document.documentName;
  }
  if (poll) body.poll = poll;
  const res = await fetch(`${API_BASE}/group_messages/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}


export async function checkNewChats(username) {
  const res = await fetch(`${API_BASE}/check-new-chats/?username=${username}`);
  return res.json();
}

export async function updateProfile(user) {
  try {
    console.log('updateProfile called with user:', user);

  const res = await fetch(`${API_BASE}/users/${user.id}/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // Include cookies for authentication
    body: JSON.stringify(user)
  });
    
          if (!res.ok) {
        const errorText = await res.text();
        console.error('Profile update failed with status:', res.status);
        console.error('Error response:', errorText);
        
        let userFriendlyError = 'Failed to update profile. Please try again.';
        
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            userFriendlyError = errorData.error;
          }
        } catch (parseError) {
          console.error('Failed to parse error response:', errorText);
          userFriendlyError = 'Failed to update profile. Please try again.';
        }
        
        console.error('Profile update failed with status:', res.status, 'Error:', userFriendlyError);
        throw new Error(userFriendlyError);
      }
    
  return res.json();
  } catch (error) {
    console.error('Update profile failed:', error);
    throw error;
  }
}


export async function fetchGroupMessages(groupId, username) {
  const res = await fetch(`${API_BASE}/group_messages/?group_id=${groupId}&username=${username}`);
  return res.json();
}



export async function deleteMessage(id, deleteType = 'for_me', username) {
  try {
  const res = await fetch(`${API_BASE}/messages/${id}/?type=${deleteType}&username=${username}`, {
    method: 'DELETE',
  });
    
    if (!res.ok) {
      const errorText = await res.text();
      let userFriendlyError = 'Failed to delete message. Please try again.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          switch (errorData.error) {
            case 'Only the sender can delete messages for everyone':
              userFriendlyError = 'Only the sender can delete messages for everyone.';
              break;
            case 'You can only delete messages you sent or received':
              userFriendlyError = 'You can only delete messages you sent or received.';
              break;
            case 'You can only delete messages from groups you are a member of':
              userFriendlyError = 'You can only delete messages from groups you are a member of.';
              break;
            case 'Message or user not found':
              userFriendlyError = 'Message not found or user not authenticated.';
              break;
            default:
              userFriendlyError = errorData.error;
          }
        }
      } catch (parseError) {
        userFriendlyError = 'Failed to delete message. Please try again.';
      }
      
      return { error: userFriendlyError };
    }
    
  return res.json();
  } catch (error) {
    console.error('Delete message failed:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}


export async function sendMessage(sender, receiver, content, imageUrl = null, document = null) {
  try {
  const body = { sender, receiver, content, imageUrl };
  if (document && document.documentUrl && document.documentName) {
    body.documentUrl = document.documentUrl;
    body.documentName = document.documentName;
  }
  const res = await fetch(`${API_BASE}/send/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
    
    if (!res.ok) {
      const errorText = await res.text();
      let userFriendlyError = 'Failed to send message. Please try again.';
      
      try {
        const errorData = JSON.parse(errorText);
        if (errorData.error) {
          switch (errorData.error) {
            case 'sender and receiver required':
              userFriendlyError = 'Please select a recipient to send the message.';
              break;
            case 'User not found':
              userFriendlyError = 'Recipient not found. Please check the username.';
              break;
            case 'content, imageUrl, or documentUrl required':
              userFriendlyError = 'Please enter a message or attach a file.';
              break;
            default:
              userFriendlyError = errorData.error;
          }
        }
      } catch (parseError) {
        userFriendlyError = 'Failed to send message. Please try again.';
      }
      
      return { error: userFriendlyError };
    }
    
  return res.json();
  } catch (error) {
    console.error('Send message failed:', error);
    return { error: 'Network error. Please check your connection and try again.' };
  }
}

export async function votePoll(messageId, voter, selected) {
  const res = await fetch(`${API_BASE}/poll/vote/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message_id: messageId, voter, selected })
  });
  return res.json();
}

export async function sendPoll(sender, receiver, question, options, allowMultiple) {
  const res = await fetch(`${API_BASE}/send/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender,
      receiver,
      type: 'poll',
      poll: {
        question,
        options,
        allowMultiple
      }
    })
  });
  return res.json();
}

// Group-related API functions
const GROUP_API_BASE = 'http://localhost:8000/api/chat/groups';

export async function createGroup(name, member_ids) {
  const res = await fetch(`${GROUP_API_BASE}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, member_ids })
  });
  return res.json();
}

export async function fetchGroups() {
  const res = await fetch(`${GROUP_API_BASE}/`);
  return res.json();
}

export async function addGroupMember(groupId, username) {
  const res = await fetch(`${GROUP_API_BASE}/${groupId}/add_member/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  return res.json();
}

export async function removeGroupMember(groupId, username) {
  const res = await fetch(`${GROUP_API_BASE}/${groupId}/remove_member/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  return res.json();
}

