const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = process.env.API_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

app.use(cors());
app.use(express.json());

let db;

async function initializeDatabase() {
  try {
    db = await open({
      filename: path.join(__dirname, 'todos.db'),
      driver: sqlite3.Database
    });
    
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      );
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized: No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden: Invalid token' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    
    const existingUser = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    );
    
    const user = {
      id: result.lastID,
      username,
      email
    };
    
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
    
    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ message: 'username and password are required' });
    }
    
    const user = await db.get('SELECT * FROM users WHERE username = ?', username);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const userForToken = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    
    const token = jwt.sign(userForToken, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ user: userForToken, token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const todos = await db.all(
      'SELECT * FROM todos WHERE user_id = ? ORDER BY created_at DESC',
      userId
    );
    
    res.json(todos);
  } catch (error) {
    console.error('Error fetching todos:', error);
    res.status(500).json({ message: 'Server error fetching todos' });
  }
});

app.get('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const todoId = req.params.id;
    const userId = req.user.id;
    
    const todo = await db.get(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?',
      [todoId, userId]
    );
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found' });
    }
    
    res.json(todo);
  } catch (error) {
    console.error('Error fetching todo:', error);
    res.status(500).json({ message: 'Server error fetching todo' });
  }
});

app.post('/api/todos', authenticateToken, async (req, res) => {
  try {
    const { title, description } = req.body;
    const userId = req.user.id;
    
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    const result = await db.run(
      'INSERT INTO todos (user_id, title, description) VALUES (?, ?, ?)',
      [userId, title, description || '']
    );
    
    const newTodo = await db.get('SELECT * FROM todos WHERE id = ?', result.lastID);
    
    res.status(201).json(newTodo);
  } catch (error) {
    console.error('Error creating todo:', error);
    res.status(500).json({ message: 'Server error creating todo' });
  }
});

app.put('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const todoId = req.params.id;
    const userId = req.user.id;
    const { title, description, completed } = req.body;
    
    const todo = await db.get(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?',
      [todoId, userId]
    );
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found or not authorized' });
    }
    
    const updatedTitle = title !== undefined ? title : todo.title;
    const updatedDescription = description !== undefined ? description : todo.description;
    const updatedCompleted = completed !== undefined ? completed : todo.completed;
    
    await db.run(
      'UPDATE todos SET title = ?, description = ?, completed = ? WHERE id = ? AND user_id = ?',
      [updatedTitle, updatedDescription, updatedCompleted, todoId, userId]
    );
    
    const updatedTodo = await db.get('SELECT * FROM todos WHERE id = ?', todoId);
    
    res.json(updatedTodo);
  } catch (error) {
    console.error('Error updating todo:', error);
    res.status(500).json({ message: 'Server error updating todo' });
  }
});

app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const todoId = req.params.id;
    const userId = req.user.id;
    
    const todo = await db.get(
      'SELECT * FROM todos WHERE id = ? AND user_id = ?',
      [todoId, userId]
    );
    
    if (!todo) {
      return res.status(404).json({ message: 'Todo not found or not authorized' });
    }
    
    await db.run('DELETE FROM todos WHERE id = ?', todoId);
    
    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ message: 'Server error deleting todo' });
  }
});

async function startServer() {
  await initializeDatabase();
  
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

