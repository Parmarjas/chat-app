import React from 'react';
import './SideNavBar.css';

const IconProfile = () => (
  <i className="fa fa-user" style={{color: "#63E6BE", fontSize: "24px" }}></i>
);

const IconAddFriend = () => (
  <i className="fa fa-user-plus" style={{ color: "#63E6BE", fontSize: "24px" }}></i>
);
const IconChats = () => (
  <i className="fa fa-comments" style={{ color: "#63E6BE", fontSize: "24px" }}></i>
);
const IconGroups = () => (
  <i className="fa fa-users" style={{ color: "#63E6BE", fontSize: "24px" }}></i>
);
const IconLogout = () => (
  <i className="fa fa-sign-out" style={{ color: "#e53e3e", fontSize: "24px" }}></i>
);

export default function SideNavBar({ onChats, onGroups, onProfile, onAddFriend, onLogout, active }) {
  return (
    <nav className="side-nav-bar">
      <button className={active === 'profile' ? 'active' : ''} onClick={onProfile}>
        <IconProfile /> <span>Profile</span>
      </button>
      <button className={active === 'addfriend' ? 'active' : ''} onClick={onAddFriend}>
        <IconAddFriend /> <span>Add Friend</span>
      </button>
      <button className={active === 'chats' ? 'active' : ''} onClick={onChats}>
        <IconChats /> <span>Chats</span>
      </button>
      <button className={active === 'groups' ? 'active' : ''} onClick={onGroups}>
        <IconGroups /> <span>Groups</span>
      </button>
      <button className="logout" onClick={onLogout}>
        <IconLogout /> <span>Logout</span>
      </button>
    </nav>
  );
}
