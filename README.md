# Chat Application

A full-stack real-time chat application built with React.js and Django, featuring private messaging, group chats, and user profiles.

## Features

### User Authentication
- Secure user registration and login
- Profile management with user information
- Persistent login sessions

### Private Messaging
- Real-time one-to-one chat
- Message history
- Unread message indicators
- Message deletion (for me/for everyone)

### Group Chats
- Create and manage groups
- Add group members
- Group message history
- Multiple group support

### Rich Media Support
- Text messages
- Image sharing
- Document sharing
- Interactive polls

### User Experience
- Intuitive navigation
- Real-time updates
- Clean and modern UI

## Tech Stack

### Frontend
- **React.js** - Frontend library
- **React Router** - Client-side routing
- **CSS Modules** - Component styling
- **Axios** - HTTP client

### Backend
- **Django** - Backend framework
- **Django REST Framework** - API development
- **SQLite** - Database

## Getting Started

### Prerequisites
- Node.js (v14 or later)
- Python (3.8 or later)
- pip (Python package manager)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd fsd-sem4
   ```

2. **Set up the backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # On Linux and macOS: venv/bin/activate
   pip install -r requirements.txt
   python manage.py migrate
   python manage.py runserver
   ```

3. **Set up the frontend**
   ```bash
   cd ../frontend
   npm install
   npm start
   ```

4. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

## API Endpoints

### Authentication
- `POST /api/chat/register/` - Register a new user
- `POST /api/chat/login/` - User login
- `POST /api/chat/logout/` - User logout

### Messages
- `GET /api/chat/messages/?user1=<user1>&user2=<user2>` - Get messages between users
- `POST /api/chat/messages/` - Send a new message
- `DELETE /api/chat/messages/<id>/` - Delete a message

### Groups
- `GET /api/chat/groups/` - Get all groups
- `POST /api/chat/groups/` - Create a new group
- `POST /api/chat/groups/<group_id>/add_member/` - Add member to group
- `POST /api/chat/groups/<group_id>/remove_member/` - Remove member from group

## Project Structure

```
fsd-sem4/
├── frontend/               # React frontend
│   ├── public/             # Static files
│   └── src/                # Source files
│       ├── components/      # Reusable components
│       ├── pages/          # Page components
│       ├── App.js          # Main App component
│       └── api.js          # API service
└── backend/                # Django backend
    ├── chat/              # Chat app
    │   ├── migrations/    # Database migrations
    │   ├── models.py      # Data models
    │   ├── views.py       # Request handlers
    │   └── urls.py        # URL routing
    └── manage.py          # Django management script
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments
- Built as part of FSD Sem 4 project
- Uses modern web technologies for real-time communication
