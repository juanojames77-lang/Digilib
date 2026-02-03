-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- PDFs table
CREATE TABLE IF NOT EXISTS pdfs (
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
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  pdf_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, pdf_id),
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Recently viewed table
CREATE TABLE IF NOT EXISTS recently_viewed (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  pdf_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Download requests table
CREATE TABLE IF NOT EXISTS download_requests (
  id SERIAL PRIMARY KEY,
  pdf_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  requested_at TIMESTAMP DEFAULT NOW(),
  responded_at TIMESTAMP,
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Download history table
CREATE TABLE IF NOT EXISTS download_history (
  id SERIAL PRIMARY KEY,
  pdf_id INT NOT NULL,
  username VARCHAR(100) NOT NULL,
  downloaded_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (pdf_id) REFERENCES pdfs(id) ON DELETE CASCADE
);

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  query TEXT NOT NULL,
  searched_at TIMESTAMP DEFAULT NOW()
);

-- Upload history table
CREATE TABLE IF NOT EXISTS upload_history (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  course INT NOT NULL,
  uploaded_by VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Insert default admin user (password: admin123)
INSERT INTO users (username, password) 
VALUES ('admin', '$2b$10$YourHashedPasswordHere') 
ON CONFLICT (username) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pdfs_cluster ON pdfs(cluster);
CREATE INDEX IF NOT EXISTS idx_pdfs_is_private ON pdfs(is_private);
CREATE INDEX IF NOT EXISTS idx_download_requests_status ON download_requests(status);
CREATE INDEX IF NOT EXISTS idx_download_requests_username ON download_requests(username);