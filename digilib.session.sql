CREATE TABLE recently_viewed (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  pdf_id INT,
  viewed_at TIMESTAMP DEFAULT NOW()
);
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  pdf_id INT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(username, pdf_id)
);
