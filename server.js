// server.js - COMPLETE VERSION FOR RENDER
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const { Pool } = require('pg');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');


const app = express();
const PORT = process.env.PORT || 3000; // ✅ CHANGED FOR RENDER
app.set('trust proxy', 1);
/* ================= CONFIG ================= */
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

/* ================= SESSION ================= */
/* ================= SESSION ================= */
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'digilib-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // TRUE on Render
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax' // IMPORTANT for cross-site
  },
  proxy: true // ✅ ADD THIS
};

// Only enable secure cookies and proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
  sessionConfig.cookie.secure = true;
  sessionConfig.proxy = true;
}

app.use(session(sessionConfig));

/* ================= NO-CACHE ================= */
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/* ================= DATABASE ================= */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});

const storage = new CloudinaryStorage({ 
  cloudinary, 
  params: { 
    folder: 'theses', 
    resource_type: 'raw'
  } 
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* ================= MIDDLEWARE ================= */
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.role !== 'admin') {
    return res.redirect('/login');
  }
  next();
};

// ✅ ADDED: Health check for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// ✅ ADDED: Fix for Render's Python path
app.use((req, res, next) => {
  // Use /tmp directory for temporary files on Render
  if (process.env.NODE_ENV === 'production') {
    global.__tmpdir = '/tmp';
  } else {
    global.__tmpdir = path.join(__dirname, 'temp');
  }
  next();
});

// ... [ALL YOUR EXISTING ROUTES REMAIN THE SAME FROM HERE] ...
// Paste all your existing routes starting from LOGIN PAGE (line 69 in your original code)
// Just make sure to replace the PORT line as shown above

/* ================= ROUTES ================= */

// LOGIN PAGE
app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

// LOGIN HANDLER
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (!result.rows.length) return res.render('login', { error: 'Invalid username or password' });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.render('login', { error: 'Invalid username or password' });
    req.session.user = user.username;
    req.session.role = user.username === 'admin' ? 'admin' : 'user';
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Something went wrong. Please try again.' });
  }
});

// REGISTER PAGE
app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null });
});

// REGISTER HANDLER
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (password.length < 6) return res.render('register', { error: 'Password must be at least 6 characters long' });
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('INSERT INTO users(username, password) VALUES($1, $2)', [username, hash]);
    res.redirect('/login');
  } catch (e) {
    res.render('register', { error: 'Username already taken!' });
  }
});

// LOGOUT
// LOGOUT - FIXED
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/login');
    }

    // ✅ Clear the correct cookie (session name)
    res.clearCookie('connect.sid'); // Default name
    
    // If you want to be extra sure, clear all possibilities:
    res.clearCookie('digilib.sid');
    res.clearCookie('sessionId');
    
    res.redirect('/login');
  });
});

// HOME (USER DASHBOARD)
app.get('/', requireLogin, async (req,res)=>{
  if(req.session.role==='admin') return res.redirect('/admin');

  const pdfsResult = await pool.query('SELECT * FROM pdfs ORDER BY id DESC');
  const pdfs = pdfsResult.rows.filter(p => !p.is_private);
  const clusters = ['BSCS','BSED-MATH','BSES','BSHM','BTLED-HE','BEED'];

  res.render('index',{
    username:req.session.user,
    pdfs,
    clusters,
    totalPDFs: pdfs.length,
    privatePDFs: pdfsResult.rows.filter(p=>p.is_private).length
  });
});

// ADMIN ANALYTICS PAGE
app.get('/admin/analytics', requireLogin, isAdmin, (req, res) => {
  res.render('admin-analytics', {
    user: req.session.user,
    clusters: ['BSCS','BSED-MATH','BSES','BSHM','BTLED-HE','BEED']
  });
});
// USER ANALYTICS PAGE
app.get('/user/analytics', requireLogin, (req, res) => {
  res.render('user-analytics', {
    username: req.session.user, // user's name to display in the profile bubble
    clusters: ['BSCS','BSED-MATH','BSES','BSHM','BTLED-HE','BEED'] // same cluster list as admin
  });
});

/* ================= ADMIN DASHBOARD ================= */
app.get('/admin', requireLogin, isAdmin, async (req,res)=>{
  const pdfsResult = await pool.query('SELECT * FROM pdfs ORDER BY id DESC');
  const pdfs = pdfsResult.rows;
  const clusters = ['BSCS','BSED-MATH','BSES','BSHM','BTLED-HE','BEED'];
  const clusterCounts = clusters.map((c,i)=> pdfs.filter(p=>p.cluster==i).length);

  res.render('admin',{
    pdfs,
    user:req.session.user,
    clusters,
    clusterCounts
  });
});

/* ================= UPLOAD ================= */
/* ================= RENDER ML API CONFIG ================= */
// ⬇️⬇️⬇️ UPDATE THIS WITH YOUR ACTUAL ML API URL ⬇️⬇️⬇️
const ML_API_URL = 'https://digilib-api-ml.onrender.com/predict';

/* ================= UPLOAD WITH ML API ================= */
app.post('/upload', requireLogin, isAdmin, upload.single('pdf'), async (req, res) => {
  const isPrivate = req.body.private === 'on';
  
  try {
    // 1. Validate
    if (!req.file?.path) {
      return res.json({ success: false, message: 'No file selected' });
    }

    const filename = path.parse(req.file.originalname).name;
    console.log(`📤 Uploading: ${filename}`);

    // 2. Get PDF from Cloudinary
    const cloudinaryResponse = await fetch(req.file.path);
    const pdfBuffer = await cloudinaryResponse.arrayBuffer();
    
    // 3. Create FormData for ML API
    const formData = new FormData();
    formData.append('file', new Blob([pdfBuffer], { 
      type: 'application/pdf' 
    }), `${filename}.pdf`);

    // 4. Call ML API
    console.log(`🤖 Calling ML API: ${ML_API_URL}`);
    
    let mlResult;
    try {
      const response = await fetch(ML_API_URL, {
        method: 'POST',
        body: formData,
        timeout: 60000 // 60 seconds
      });
      
      console.log(`📊 ML API Status: ${response.status}`);
      
      if (response.ok) {
        mlResult = await response.json();
        console.log('✅ ML API Result:', JSON.stringify(mlResult, null, 2));
      } else {
        console.log(`❌ ML API Error: ${response.status}`);
        mlResult = { success: false, cluster: 0, confidence: 0.78 };
      }
    } catch (apiError) {
      console.error('❌ ML API Connection Error:', apiError.message);
      mlResult = { success: false, cluster: 0, confidence: 0.78 };
    }

    // 5. Get prediction results
    let clusterIndex = 0;
    let confidence = 0.5;
    
    if (mlResult && mlResult.success) {
      // Success from ML API
      clusterIndex = mlResult.cluster || 0;
      confidence = mlResult.confidence || 0.5;
      
      console.log(`✅ ML Prediction: Cluster ${clusterIndex}, Confidence ${confidence}`);
    } else if (mlResult && mlResult.cluster !== undefined) {
      // Some APIs return cluster directly
      clusterIndex = mlResult.cluster;
      confidence = mlResult.confidence || 0.5;
    } else {
      // Fallback
      console.log(`⚠️ Using default values`);
    }

    // 6. Validate ranges (0-5 for your 6 clusters)
    clusterIndex = Math.max(0, Math.min(5, clusterIndex));
    confidence = Math.max(0.1, Math.min(1.0, confidence));
    
    const clusterNames = ['BSCS', 'BSED-MATH', 'BSES', 'BSHM', 'BTLED-HE', 'BEED'];
    const clusterName = clusterNames[clusterIndex];

    console.log(`🎯 Final: ${clusterName} (Cluster ${clusterIndex}), Confidence ${confidence.toFixed(2)}`);

    // 7. Save to database
    await pool.query(
      'INSERT INTO pdfs(title, cluster, url, is_private, uploader, confidence) VALUES($1,$2,$3,$4,$5,$6)',
      [filename, clusterIndex, req.file.path, isPrivate, req.session.user, confidence]
    );

    await pool.query(
      'INSERT INTO upload_history(title, course, uploaded_by) VALUES($1,$2,$3)',
      [filename, clusterIndex, req.session.user]
    );

    console.log(`💾 Saved to database: ${filename}`);

    // 8. Return success
    res.json({
      success: true,
      title: filename,
      cluster: clusterIndex,
      cluster_name: clusterName,
      confidence: confidence.toFixed(2),
      api_used: mlResult && mlResult.success === true,
      message: `Predicted as ${clusterName} with ${(confidence * 100).toFixed(1)}% confidence`
    });

  } catch (error) {
    console.error('💥 Upload error:', error);
    
    // Fallback: Save with default values
    try {
      const filename = req.file ? path.parse(req.file.originalname).name : 'unknown';
      
      await pool.query(
        'INSERT INTO pdfs(title, cluster, url, is_private, uploader, confidence) VALUES($1,$2,$3,$4,$5,$6)',
        [filename, 0, req.file?.path || '', isPrivate, req.session.user, 0.5]
      );
      
      res.json({
        success: true,
        title: filename,
        cluster: 0,
        cluster_name: 'BSCS',
        confidence: 0.5,
        api_used: false,
        fallback: true,
        message: 'Uploaded with default values'
      });
      
    } catch (fallbackError) {
      res.json({ 
        success: false, 
        message: 'Upload failed completely' 
      });
    }
  }
});
/* ================= DELETE ================= */
app.post('/delete/:id', requireLogin, isAdmin, async (req,res)=>{
  await pool.query('DELETE FROM pdfs WHERE id=$1',[req.params.id]);
  res.redirect('/admin');
});

// ADD TO FAVORITES
app.post('/favorite/:id', requireLogin, async (req,res)=>{
  try{
    await pool.query(
      'INSERT INTO favorites(username, pdf_id) VALUES($1,$2)',
      [req.session.user, req.params.id]
    );
  }catch(e){}
  res.redirect('/view/'+req.params.id);
});

// REMOVE FAVORITE
app.post('/unfavorite/:id', requireLogin, async (req,res)=>{
  await pool.query(
    'DELETE FROM favorites WHERE username=$1 AND pdf_id=$2',
    [req.session.user, req.params.id]
  );
  res.redirect('/view/'+req.params.id);
});

/* ================= UPDATE COURSE ================= */
app.post('/update-course/:id', requireLogin, isAdmin, async (req, res) => {
  const { course } = req.body;
  try {
    await pool.query('UPDATE pdfs SET cluster=$1 WHERE id=$2',[parseInt(course), req.params.id]);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.send('Failed to update course');
  }
});

/* ================= USER SEARCH ================= */
app.get('/search', requireLogin, async (req,res)=>{
  const result = await pool.query('SELECT * FROM pdfs WHERE title ILIKE $1',['%'+req.query.q+'%']);
  const pdfs = result.rows.filter(p=> !p.is_private);

  // ==== LOG SEARCH HISTORY ====
  await pool.query('INSERT INTO search_history(username, query) VALUES($1,$2)', [req.session.user, req.query.q]);

  res.render('results',{ results: pdfs, query:req.query.q });
});
//REQUEST USER DOWNLOAD
app.post('/request-download/:id', requireLogin, async (req,res)=>{
  try{
    await pool.query(
      'INSERT INTO download_requests(pdf_id, username) VALUES($1,$2)',
      [req.params.id, req.session.user]
    );
    res.redirect('/view/' + req.params.id);
  }catch(e){
    console.error(e);
    res.send('Request already sent');
  }
});
// VIEW ALL DOWNLOAD REQUESTS
app.get('/admin/download-requests', requireLogin, isAdmin, async (req,res)=>{
  const result = await pool.query(`
    SELECT dr.*, p.title 
    FROM download_requests dr
    JOIN pdfs p ON p.id = dr.pdf_id
    ORDER BY dr.requested_at DESC
  `);

  res.render('admin-downloads', { 
    requests: result.rows,
    user: req.session.user  // <-- add this
  });
});

//APPROVE/REJECT
app.post('/admin/download-action/:id', requireLogin, isAdmin, async (req,res)=>{
  const { action } = req.body; // accepted | rejected
  await pool.query(
    'UPDATE download_requests SET status=$1, responded_at=NOW() WHERE id=$2',
    [action, req.params.id]
  );
  res.redirect('/admin/download-requests');
});
// DOWNLOAD PDF (fixed)
app.get('/download/:id', requireLogin, async (req, res) => {
  try {
    const check = await pool.query(`
      SELECT dr.*, p.url, p.title
      FROM download_requests dr
      JOIN pdfs p ON p.id = dr.pdf_id
      WHERE dr.pdf_id = $1 AND dr.username = $2 AND dr.status = 'accepted'
    `, [req.params.id, req.session.user]);

    if (!check.rows.length) return res.send('Not allowed');

    const file = check.rows[0];

    // Log download history
    await pool.query(
      'INSERT INTO download_history(pdf_id, username) VALUES($1,$2)',
      [req.params.id, req.session.user]
    );

    // Fetch PDF from Cloudinary
    const response = await fetch(file.url);
    if (!response.ok) return res.send('Failed to fetch file');

    const buffer = await response.arrayBuffer();

    // Send PDF with proper headers
    res.setHeader('Content-Disposition', `attachment; filename="${file.title}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error(err);
    res.send('Download failed');
  }
});
// Return the current download request status
app.get('/request-status/:id', requireLogin, async (req,res)=>{
  const result = await pool.query(
    'SELECT status FROM download_requests WHERE pdf_id=$1 AND username=$2 ORDER BY requested_at DESC LIMIT 1',
    [req.params.id, req.session.user]
  );
  if(result.rows.length === 0) return res.json({ status: null });
  res.json({ status: result.rows[0].status });
});

//DOWNLOAD HISTORY
app.get('/downloads', requireLogin, async (req,res)=>{
  const result = await pool.query(`
    SELECT 
      p.title, 
      dh.downloaded_at AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila' as downloaded_at
    FROM download_history dh
    JOIN pdfs p ON p.id = dh.pdf_id
    WHERE dh.username=$1
    ORDER BY dh.downloaded_at DESC
  `,[req.session.user]);

  // Log to check the converted time
  console.log('Download times:', result.rows);
  
  res.render('downloads',{ files: result.rows, username:req.session.user });
});

/* ================= VIEW PDF - USER ================= */
app.get('/view/:id', requireLogin, async (req, res) => {
  try {
    // Get the PDF
    const result = await pool.query('SELECT * FROM pdfs WHERE id=$1', [req.params.id]);
    const file = result.rows[0];
    if (!file) return res.send('File not found');
    if (file.is_private && req.session.role !== 'admin') return res.send('Access denied');

    // Track recently viewed
    await pool.query('INSERT INTO recently_viewed(username, pdf_id) VALUES($1,$2)', [req.session.user, file.id]);

    // Get similar PDFs (same cluster, not private)
    const similarRes = await pool.query(
      'SELECT id, title FROM pdfs WHERE cluster=$1 AND id<>$2 AND is_private=false LIMIT 5',
      [file.cluster, file.id]
    );

    // Check if favorited
    const fav = await pool.query(
      'SELECT 1 FROM favorites WHERE username=$1 AND pdf_id=$2',
      [req.session.user, file.id]
    );

    // Check download request status
    const downloadReq = await pool.query(
      'SELECT * FROM download_requests WHERE pdf_id=$1 AND username=$2 ORDER BY requested_at DESC LIMIT 1',
      [file.id, req.session.user]
    );

    // Render user view
    res.render('view', {
      file,
      similar: similarRes.rows,
      isFavorite: fav.rowCount > 0,
      downloadRequest: downloadReq.rows[0] || null
    });

  } catch (err) {
    console.error(err);
    res.send('Error loading file');
  }
});

/* ================= VIEW PDF - ADMIN (SAFE) ================= */
app.get('/view-admin/:id', requireLogin, isAdmin, async (req, res) => {
  try {
    // Get the PDF
    const result = await pool.query(
      'SELECT * FROM pdfs WHERE id=$1',
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.send('File not found');
    }

    const file = result.rows[0];

    // SAFETY: cluster may be NULL right after upload
    let similar = [];
    if (file.cluster !== null) {
      const similarRes = await pool.query(
        'SELECT id, title FROM pdfs WHERE cluster=$1 AND id<>$2 LIMIT 5',
        [file.cluster, file.id]
      );
      similar = similarRes.rows;
    }

    res.render('view-admin', {
      file,
      similar
    });

  } catch (err) {
    console.error(err);
    res.send('Error loading file');
  }
});


// ADMIN ANALYTICS DATA (REAL DATA) 
app.get('/admin/analytics-data', requireLogin, isAdmin, async (req, res) => {
  try {
    // Summary counts
    const totalPDFs = await pool.query('SELECT COUNT(*) FROM pdfs');
    const publicPrivate = await pool.query(`
      SELECT 
        SUM(CASE WHEN is_private = true THEN 1 ELSE 0 END) AS private,
        SUM(CASE WHEN is_private = false THEN 1 ELSE 0 END) AS public
      FROM pdfs
    `);

    // PDFs per course
    const pdfsPerCourse = await pool.query(`
      SELECT cluster, COUNT(*) AS count
      FROM pdfs
      GROUP BY cluster
      ORDER BY cluster
    `);

    // Download requests status
    const downloadStatus = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM download_requests
      GROUP BY status
    `);

    // Send all analytics data
    res.json({
      summary: {
        totalPDFs: parseInt(totalPDFs.rows[0].count),
        publicPDFs: parseInt(publicPrivate.rows[0].public),
        privatePDFs: parseInt(publicPrivate.rows[0].private)
      },
      pdfsPerCourse: pdfsPerCourse.rows,
      downloadStatus: downloadStatus.rows,
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Analytics error' });
  }
});
// USER ANALYTICS DATA (REAL DATA)
// USER ANALYTICS DATA (FIXED VERSION)
app.get('/user/analytics-data', requireLogin, async (req, res) => {
  try {
    const username = req.session.user;
    console.log(`📊 Fetching analytics for user: ${username}`);

    // Total PDFs downloaded (accepted downloads only)
    const totalDownloads = await pool.query(
      'SELECT COUNT(*) FROM download_history WHERE username = $1', 
      [username]
    );

    // Download request status counts
    const downloadStatus = await pool.query(`
      SELECT status, COUNT(*) AS count
      FROM download_requests
      WHERE username = $1
      GROUP BY status
    `, [username]);

    // Downloads per course
    const downloadsPerCourse = await pool.query(`
      SELECT p.cluster, COUNT(*) AS count
      FROM download_history dr
      JOIN pdfs p ON dr.pdf_id = p.id
      WHERE dr.username = $1
      GROUP BY p.cluster
      ORDER BY p.cluster
    `, [username]);

    // DOWNLOADS OVER TIME - FIXED VERSION
    const downloadsOverTime = await pool.query(`
      SELECT 
        DATE_TRUNC('week', dr.downloaded_at) AS week,
        COUNT(*) AS count
      FROM download_history dr
      WHERE dr.username = $1
      GROUP BY DATE_TRUNC('week', dr.downloaded_at)
      ORDER BY week ASC
    `, [username]);

    console.log('📈 Raw trend data:', downloadsOverTime.rows);

    // Format the data properly
    const formattedTrendData = downloadsOverTime.rows.map(row => {
      let weekLabel = '';
      
      if (row.week) {
        const date = new Date(row.week);
        // Add 8 hours for PH timezone
        date.setHours(date.getHours() + 8);
        
        // Format as "Week of MMM DD, YYYY"
        weekLabel = date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      } else {
        weekLabel = 'Unknown';
      }
      
      return {
        week: weekLabel,
        count: parseInt(row.count) || 0
      };
    });

    // If no data, provide empty array (chart will show nothing)
    console.log('📊 Formatted trend data:', formattedTrendData);

    res.json({
      summary: {
        totalDownloads: parseInt(totalDownloads.rows[0]?.count || 0)
      },
      downloadStatus: downloadStatus.rows.map(row => ({
        status: row.status,
        count: parseInt(row.count)
      })),
      downloadsPerCourse: downloadsPerCourse.rows.map(row => ({
        cluster: row.cluster,
        count: parseInt(row.count)
      })),
      downloadsOverTime: formattedTrendData
    });

  } catch (err) {
    console.error('❌ User analytics error:', err);
    res.status(500).json({ 
      error: 'User analytics error',
      summary: { totalDownloads: 0 },
      downloadStatus: [],
      downloadsPerCourse: [],
      downloadsOverTime: []
    });
  }
});

// TOGGLE PRIVATE STATUS
app.post('/toggle-private/:id', requireLogin, isAdmin, async (req,res)=>{
  try{
    const check = await pool.query('SELECT is_private FROM pdfs WHERE id=$1',[req.params.id]);
    if(!check.rows.length) return res.send('PDF not found');
    const isPrivate = !check.rows[0].is_private;
    await pool.query('UPDATE pdfs SET is_private=$1 WHERE id=$2',[isPrivate, req.params.id]);
    res.redirect('/view-admin/' + req.params.id);
  }catch(err){
    console.error(err);
    res.send('Failed to update private status');
  }
});


// USER FAVORITES PAGE
app.get('/favorites', requireLogin, async (req,res)=>{
  const result = await pool.query(`
    SELECT p.*, f.pdf_id
    FROM favorites f
    JOIN pdfs p ON p.id = f.pdf_id
    WHERE f.username = $1
    ORDER BY p.id DESC
  `, [req.session.user]);

  const pdfs = result.rows;
  const clusters = ['BSCS','BSED-MATH','BSES','BSHM','BTLED-HE','BEED'];

  res.render('favorites', { username: req.session.user, pdfs, clusters });
});


/* ================= USER AJAX LOGGING ROUTES ================= */

// Log search (AJAX)
app.post('/user/log-search', requireLogin, async (req,res)=>{
  const { query } = req.body;
  if(!query) return res.json({ success:false });
  await pool.query('INSERT INTO search_history(username, query) VALUES($1,$2)', [req.session.user, query]);
  res.json({ success:true });
});

// Log view (AJAX)
app.post('/user/log-view', requireLogin, async (req,res)=>{
  const { pdf_id } = req.body;
  if(!pdf_id) return res.json({ success:false });
  await pool.query('INSERT INTO recently_viewed(username, pdf_id) VALUES($1,$2)', [req.session.user, pdf_id]);
  res.json({ success:true });
});

// Get user history data for chart
app.get('/user/history-data', requireLogin, async (req,res)=>{
  const rows = await pool.query(`
    SELECT s.query, p.cluster AS course, TO_CHAR(s.searched_at,'YYYY-MM') AS month
    FROM search_history s
    LEFT JOIN pdfs p ON p.title ILIKE '%'||s.query||'%'
    WHERE s.username=$1
    ORDER BY s.searched_at DESC
  `,[req.session.user]);
  res.json(rows.rows);
});

/* ================= INLINE PDF STREAM (ADMIN VIEW) ================= */
app.get('/inline-pdf/:id', requireLogin, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT url, title FROM pdfs WHERE id=$1',
      [req.params.id]
    );

    if (!result.rows.length) return res.send('File not found');

    const file = result.rows[0];

    // Fetch PDF from Cloudinary
    const response = await fetch(file.url);
    if (!response.ok) return res.send('Failed to load PDF');

    const buffer = await response.arrayBuffer();

    // INLINE (NOT DOWNLOAD)
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.title}.pdf"`
    );

    res.send(Buffer.from(buffer));

  } catch (err) {
    console.error(err);
    res.send('Error loading PDF');
  }
});

// ================= ML TEST PAGE =================
app.get('/model-test', requireLogin, isAdmin, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ML System Test</title>
      <style>
        body { font-family: Arial; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: white; padding: 20px; border-radius: 10px; margin: 20px 0; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .btn { background: #4CAF50; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; }
        .btn:hover { background: #45a049; }
        .result { margin-top: 20px; padding: 15px; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; }
        .error { background: #f8d7da; color: #721c24; }
        textarea { width: 100%; height: 100px; padding: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🤖 ML System Test</h1>
        
        <div class="card">
          <h3>Test 1: Direct API Call</h3>
          <button onclick="testAPI()" class="btn">Test Hugging Face API</button>
          <div id="apiResult" class="result"></div>
        </div>
        
        <div class="card">
          <h3>Test 2: Upload Test PDF</h3>
          <form id="uploadForm" enctype="multipart/form-data">
            <input type="file" name="pdf" accept=".pdf" required><br><br>
            <button type="submit" class="btn">Upload & Test</button>
          </form>
          <div id="uploadResult" class="result"></div>
        </div>
        
        <div class="card">
          <h3>Test 3: Text Prediction</h3>
          <textarea id="testText" placeholder="Enter text to test...">computer science machine learning</textarea><br>
          <button onclick="testText()" class="btn">Test Text Prediction</button>
          <div id="textResult" class="result"></div>
        </div>
        
        <div style="margin-top: 30px;">
          <a href="/admin" class="btn">← Back to Admin</a>
        </div>
      </div>
      
      <script>
        async function testAPI() {
          const result = document.getElementById('apiResult');
          result.innerHTML = 'Testing...';
          result.className = 'result';
          
          try {
            const response = await fetch('/api/test-ml');
            const data = await response.json();
            
            if (data.success) {
              result.className = 'result success';
              result.innerHTML = \`
                <h4>✅ API Working!</h4>
                <p><strong>Status:</strong> \${data.status}</p>
                <p><strong>Response:</strong></p>
                <pre>\${JSON.stringify(data.response, null, 2)}</pre>
              \`;
            } else {
              result.className = 'result error';
              result.innerHTML = \`
                <h4>❌ API Failed</h4>
                <p>\${data.error}</p>
              \`;
            }
          } catch (error) {
            result.className = 'result error';
            result.innerHTML = \`Error: \${error.message}\`;
          }
        }
        
        document.getElementById('uploadForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const result = document.getElementById('uploadResult');
          result.innerHTML = 'Uploading...';
          result.className = 'result';
          
          const formData = new FormData(e.target);
          
          try {
            const response = await fetch('/upload', {
              method: 'POST',
              body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
              result.className = 'result success';
              result.innerHTML = \`
                <h4>✅ Upload Successful!</h4>
                <p><strong>File:</strong> \${data.title}</p>
                <p><strong>Prediction:</strong> \${data.cluster_name} (Cluster \${data.cluster})</p>
                <p><strong>Confidence:</strong> \${(data.confidence * 100).toFixed(1)}%</p>
                <p><strong>ML API Used:</strong> \${data.api_used ? 'Yes' : 'No (fallback)'}</p>
                <p>\${data.message}</p>
              \`;
            } else {
              result.className = 'result error';
              result.innerHTML = \`
                <h4>❌ Upload Failed</h4>
                <p>\${data.message}</p>
                \${data.error ? '<p>' + data.error + '</p>' : ''}
              \`;
            }
          } catch (error) {
            result.className = 'result error';
            result.innerHTML = \`Error: \${error.message}\`;
          }
        });
        
        async function testText() {
          const text = document.getElementById('testText').value;
          const result = document.getElementById('textResult');
          result.innerHTML = 'Testing...';
          result.className = 'result';
          
          try {
            const response = await fetch('https://jamesgab.hf.space/run/predict', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                data: [text]
              })
            });
            
            const data = await response.json();
            result.className = 'result success';
            result.innerHTML = \`
              <h4>✅ Text Prediction Result</h4>
              <pre>\${JSON.stringify(data, null, 2)}</pre>
            \`;
          } catch (error) {
            result.className = 'result error';
            result.innerHTML = \`Error: \${error.message}\`;
          }
        }
        
        // Test API on page load
        testAPI();
      </script>
    </body>
    </html>
  `);
});

// ================= API TEST ENDPOINT =================
app.get('/api/test-ml', async (req, res) => {
  try {
    const response = await fetch(HF_ML_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: ["computer science machine learning artificial intelligence"]
      })
    });
    
    const data = await response.json();
    
    res.json({
      success: response.ok,
      status: response.status,
      url: HF_ML_API_URL,
      response: data
    });
    
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});
// Add this health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
/* ================= START SERVER ================= */
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
});