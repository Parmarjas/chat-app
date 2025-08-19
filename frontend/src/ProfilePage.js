import React, { useState } from 'react';
import './ProfilePage.css';

export default function ProfilePage({ user, messages = [], users = [], editable = true, onSaveProfile, groups = [] }) {
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState(user?.profile?.bio || 'This is your bio. Click edit to update.');
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [email, setEmail] = useState(user?.profile?.email || '');
  const [mobile, setMobile] = useState(user?.profile?.mobile_number || '');

  React.useEffect(() => {
    setFirstName(user?.first_name || '');
    setLastName(user?.last_name || '');
    setBio(user?.profile?.bio || 'This is your bio. Click edit to update.');
    setEmail(user?.profile?.email || '');
    setMobile(user?.profile?.mobile_number || '');
    setEditing(false);
  }, [user]);


  
  if (!user) return <div className="profile-page"><h2>Profile</h2><p>No user data.</p></div>;
  
  // Check if user has required properties
  if (!user.username && !user.id) {
    console.error('User object missing required properties:', user);
    return (
      <div className="profile-page">
        <h2>Profile</h2>
        <p>Invalid user data. Please log in again.</p>
        <button 
          className="profile-btn" 
          onClick={() => {
            localStorage.removeItem('user');
            window.location.href = '/login';
          }}
          style={{ marginTop: '20px' }}
        >
          Go to Login
        </button>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <h2>Profile</h2>
      <div className="profile-card profile-card-extended">
        <div className="profile-avatar-large">{(user.username || user.id || 'U').charAt(0).toUpperCase()}</div>
        <div className="profile-info">
          {editing ? (
            <>
              <div className="profile-edit-row"><label className="profile-info-label">First Name:</label><input className="profile-edit-name compact" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First Name" /></div>
              <div className="profile-edit-row"><label className="profile-info-label">Last Name:</label><input className="profile-edit-name compact" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last Name" /></div>
              <div className="profile-edit-row"><label className="profile-info-label">Email:</label><input className="profile-edit-name compact" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email" /></div>
              <div className="profile-edit-row"><label className="profile-info-label">Mobile Number:</label><input className="profile-edit-name compact" value={mobile} onChange={e => setMobile(e.target.value)} placeholder="Mobile Number" type="tel" /></div>
              <div className="profile-edit-row"><label className="profile-info-label">Bio:</label><textarea className="profile-edit-bio compact" value={bio} onChange={e => setBio(e.target.value)} placeholder="Bio" /></div>
              <button className="profile-btn" onClick={async () => {
                try {
                if (onSaveProfile) {
                    const updatedUser = {
                    ...user,
                    first_name: firstName,
                    last_name: lastName,
                      profile: { 
                        ...(user.profile || {}), 
                        bio: bio || '', 
                        email: email || '', 
                        mobile_number: mobile || '' 
                      }
                    };

                    await onSaveProfile(updatedUser);
                }
                setEditing(false);
                } catch (error) {
                  console.error('Error saving profile:', error);
                  alert(`Failed to save profile: ${error.message}`);
                }
              }}>Save</button>
            </>
          ) : (
            <>
              <div className="profile-username"><label>Username:</label> {user.username || user.id || 'Not set'}</div>
              <div className="profile-name"><label>Name:</label> {user.first_name || ''} {user.last_name || ''}</div>
              <div className="profile-email"><label>Email:</label> {(user.profile && user.profile.email) ? user.profile.email : <span style={{color:'#aaa'}}>Not set</span>}</div>
              <div className="profile-mobile"><label>Mobile:</label> {(user.profile && user.profile.mobile_number) ? user.profile.mobile_number : <span style={{color:'#aaa'}}>Not set</span>}</div>
              <div className="profile-bio"><label>Bio:</label> {bio}</div>
              {editable && (
                <button className="profile-btn" onClick={() => setEditing(true)}>Edit</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

