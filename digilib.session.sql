-- Upload history
CREATE TABLE upload_history (
  id SERIAL PRIMARY KEY,
  title TEXT,
  course INT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Search history
CREATE TABLE search_history (
  id SERIAL PRIMARY KEY,
  username TEXT,
  query TEXT,
  course INT,
  searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
