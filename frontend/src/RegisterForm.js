import React from 'react';
import { Link } from 'react-router-dom';
import './RegisterForm.css';

function RegisterForm({ username, setUsername, password, setPassword, handleRegister, registerError }) {
  return (<>
    
    <div className="register-bg">
    <nav className="navbar-brand">
      <span>Chat App</span>
    </nav>
      <div className="register-card">
        <h2 className="register-title">Register</h2>
        <form className="register-form" onSubmit={handleRegister}>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Choose username"
            autoComplete="username"
            className="register-input"
          />
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Choose password"
            autoComplete="new-password"
            className="register-input"
          />
          <button type="submit" className="register-btn">Register</button>
        </form>
        {registerError && <div className="register-error">{registerError}</div>}
        <div className="register-link-text">
          Already have an account?
          <Link to="/login" className="register-link">Login</Link>
        </div>
      </div>
    </div>
    </> );
}

export default RegisterForm;
