// setup-database.js
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const SQL = `
-- Drop existing tables if needed
DROP TABLE IF EXISTS download_history CASCADE;
DROP TABLE IF EXISTS search_history CASCADE;
DROP TABLE IF EXISTS upload_history CASCADE;
DROP TABLE IF EXISTS recently_viewed CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS download_requests CASCADE;
DROP TABLE IF EXISTS pdfs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PDFs table
CREATE TABLE pdfs (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  cluster INT DEFAULT 0,
  url TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  uploader VARCHAR(100),
  confidence FLOAT DEFAULT 0.0,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Favorites table
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  pdf_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, pdf_id),
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Recently viewed table
CREATE TABLE recently_viewed (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  pdf_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Download requests table
CREATE TABLE download_requests (
  id SERIAL PRIMARY KEY,
  pdf_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Download history table
CREATE TABLE download_history (
  id SERIAL PRIMARY KEY,
  pdf_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Search history table
CREATE TABLE search_history (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  query TEXT NOT NULL,
  searched_at TIMESTAMP DEFAULT NOW()
);

-- Upload history table
CREATE TABLE upload_history (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  course INT NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);
`;

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database...');
    
    // Execute SQL
    await pool.query(SQL);
    console.log('✅ Database tables created');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await pool.query(
      `INSERT INTO users (username, password) 
       VALUES ($1, $2) 
       ON CONFLICT (username) DO NOTHING`,
      ['admin', adminPassword]
    );
    
    console.log('✅ Admin user created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');
    console.log('   ⚠️ CHANGE THIS PASSWORD IMMEDIATELY!');
    
    // Create test user
    const userPassword = await bcrypt.hash('user123', 10);
    await pool.query(
      `INSERT INTO users (username, password) 
       VALUES ($1, $2) 
       ON CONFLICT (username) DO NOTHING`,
      ['testuser', userPassword]
    );
    
    console.log('✅ Test user created:');
    console.log('   Username: testuser');
    console.log('   Password: user123');
    
    console.log('\n🎉 Database setup complete!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

setupDatabase();