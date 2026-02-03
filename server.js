require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { Pool } = require('pg');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = 3000;

/* ================= CONFIG ================= */
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // <-- for AJAX JSON
app.use(express.static('public'));

/* ================= SESSION ================= */
app.use(session({
  secret: 'super-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));

/* ================= NO-CACHE ================= */
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/* ================= DATABASE ================= */
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

/* ================= CLOUDINARY ================= */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_KEY,
  api_secret: process.env.CLOUD_SECRET
});
const storage = new CloudinaryStorage({ cloudinary, params:{ folder:'theses', resource_type:'raw' } });
const upload = multer({ storage });

/* ================= MIDDLEWARE ================= */
const requireLogin = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
};

const isAdmin = (req, res, next) => {
  if (!req.session.user || req.session.role !== 'admin') {
    // 🔥 DO NOT redirect to /
    return res.redirect('/login');
  }
  next();
};


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
app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error(err);
      return res.redirect('/login');
    }

    // 🔥 clear session cookie
    res.clearCookie('connect.sid');

    // 🔥 extra safety (optional but recommended)
    res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage"');

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
app.post('/upload', requireLogin, isAdmin, upload.single('pdf'), async (req,res)=>{
  const isPrivate = req.body.private === 'on';
  try {
    if(!req.file?.path) return res.json({ success:false, message:'No file selected' });

    const filename = path.parse(req.file.originalname).name;

    const tempPath = path.join(__dirname, 'temp.pdf');
    const response = await fetch(req.file.path);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempPath, buffer);

    execFile('python', ['ml/predict_cluster.py', tempPath], async (err,stdout)=>{
      fs.unlinkSync(tempPath);
      if(err) return res.json({ success:false, message:'ML prediction failed' });

      stdout = stdout.trim();
      const [clusterIndexStr, confidenceStr] = stdout.split(',');
      let clusterIndex = parseInt(clusterIndexStr);
      let confidence = parseFloat(confidenceStr);
      if(isNaN(clusterIndex)) clusterIndex = 0;
      if(isNaN(confidence)) confidence = 0;

      try {
        await pool.query(
          'INSERT INTO pdfs(title, cluster, url, is_private, uploader, confidence) VALUES($1,$2,$3,$4,$5,$6)',
          [filename, clusterIndex, req.file.path, isPrivate, req.session.user, confidence]
        );

        // ==== LOG UPLOAD HISTORY ====
        await pool.query(
          'INSERT INTO upload_history(title, course, uploaded_by) VALUES($1,$2,$3)',
          [filename, clusterIndex, req.session.user]
        );

        res.json({ success:true, title:filename, cluster:clusterIndex, confidence });
      } catch(e){
        console.error(e);
        res.json({ success:false, message:'Database error' });
      }
    });
  } catch(e){
    console.error(e);
    res.json({ success:false, message:'Upload failed' });
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
    SELECT p.title, dh.downloaded_at
    FROM download_history dh
    JOIN pdfs p ON p.id = dh.pdf_id
    WHERE dh.username=$1
    ORDER BY dh.downloaded_at DESC
  `,[req.session.user]);

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
app.get('/user/analytics-data', requireLogin, async (req, res) => {
  try {
    const username = req.session.user;

    // Total PDFs downloaded (all statuses)
    const totalDownloads = await pool.query(
      'SELECT COUNT(*) FROM download_requests WHERE username = $1', [username]
    );

    // Total PDFs uploaded by user
    const totalUploads = await pool.query(
      'SELECT COUNT(*) FROM pdfs WHERE uploader = $1', [username]
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
      FROM download_requests dr
      JOIN pdfs p ON dr.pdf_id = p.id
      WHERE dr.username = $1 AND dr.status='accepted'
      GROUP BY p.cluster
      ORDER BY p.cluster
    `, [username]);

    // Downloads over time (weekly)
    const downloadsOverTime = await pool.query(`
      SELECT DATE_TRUNC('week', dr.requested_at) AS week, COUNT(*) AS count
      FROM download_requests dr
      WHERE dr.username = $1 AND dr.status='accepted'
      GROUP BY week
      ORDER BY week ASC
    `, [username]);

    res.json({
      summary: {
        totalDownloads: parseInt(totalDownloads.rows[0].count),
        totalUploads: parseInt(totalUploads.rows[0].count)
      },
      downloadStatus: downloadStatus.rows,
      downloadsPerCourse: downloadsPerCourse.rows,
      downloadsOverTime: downloadsOverTime.rows.map(r=>({
        week: r.week.toISOString().slice(0,10),
        count: parseInt(r.count)
      }))
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'User analytics error' });
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


/* ================= START SERVER ================= */
app.listen(PORT,()=>console.log(`Server running at http://localhost:${PORT}`));
