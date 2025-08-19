import React, { useState, useEffect } from 'react';
import ProfilePage from './ProfilePage';
import './AddFriendPage.css';
import './ProfilePage.css';

export default function AddFriendPage({ users = [], onAddFriend}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [viewProfile, setViewProfile] = useState(null);

  // Filter users based on search term
  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = (userToAdd) => {
    const user = userToAdd || selected;
    if (user) {
      if (onAddFriend) onAddFriend(user);
      setSelected(null);
      setSearch('');
    }
  };

  return (
    <div className="add-friend-container">
      <div className="friend-selection">
        <h2>Add Friend</h2>
        
        {/* Simple Search Input */}
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="chat-users-search"
          
        />

        {/* Simple User List */}
        <div>
          <h3 style={{ color: '#e2e8f0', marginBottom: '12px' }}>All Users</h3>
          <ul style={{
            maxHeight: '400px',
            overflowY: 'auto'
          }}>
            {filteredUsers.length === 0 && <li style={{ color: '#a0aec0', padding: '12px' }}>No users available.</li>}
            {filteredUsers.map(u => (
              <li
                key={u.id}
                style={{
                  background: viewProfile && viewProfile.id === u.id ? '#25d366' : '#23272f',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 12px',
                  marginBottom: 6,
                  cursor: 'pointer',
                  fontWeight: viewProfile && viewProfile.id === u.id ? 'bold' : 'normal',
                  height: '50px',
                  display: 'flex',
                  alignItems: 'center'
                }}
                onClick={() => { console.log('Selected user:', u); setViewProfile(u); }}
              >
                {u.username}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="profile-section">
        {viewProfile ? (
          <>
            <button
              className="close-profile-btn"
              onClick={() => setViewProfile(null)}
              aria-label="Close profile"
            >
              &times;
            </button>
            <div className="profile-card-follow">
              <ProfilePage user={viewProfile} editable={false} />
              <button
                className="profile-btn"
                onClick={() => { handleAdd(viewProfile); setViewProfile(null); }}
                disabled={false}>Chat Now</button>
            </div>
          </>
        ) : (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 60 }}>
            Select a user to view their profile
          </div>
        )}
      </div>
    </div>
  );
}

