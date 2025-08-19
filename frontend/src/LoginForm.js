import React from 'react';
import { Link } from 'react-router-dom';
import './LoginForm.css';

function LoginForm({ username, setUsername, password, setPassword, handleLogin, loginError }) {
  return (
    <>
      <nav className="navbar-brand">
        <span>Chat App</span>
      </nav>
      <div className="login-bg">
        <div className="login-card">
          <h2 className="login-title">Login</h2>
          <form className="login-form" onSubmit={handleLogin}>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              className="login-input"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="login-input"
            />
            <button type="submit" className="login-btn">Login</button>
          </form>
          {loginError && <div className="login-error">{loginError}</div>}
          <div className="login-link-text">
            Don't have an account?
            <Link to="/register" className="login-link">Register</Link>
          </div>
        </div>
      </div>
    </>
  );
}

export default LoginForm;
