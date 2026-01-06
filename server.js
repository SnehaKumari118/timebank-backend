const express = require("express");
const cors = require("cors");
const db = require("./db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(cors({
  origin: [
    "http://localhost:5173",        // local React (Vite)
    "http://localhost:3000",        // optional
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send("TimeBank backend running ✅");
});


/* ================= MOCK AI ================= */

app.post("/generate-description", (req, res) => {
  const { title } = req.body;

  if (!title) {
    return res.json({
      success: false,
      message: "Title is required"
    });
  }

  const templates = [
    `I offer professional ${title} services with a focus on quality, efficiency, and timely delivery. Ideal for individuals and small teams.`,
    
    `${title} service designed to help you achieve your goals efficiently. Clear communication and reliable support guaranteed.`,
    
    `Get expert help with ${title}. I provide structured, easy-to-understand solutions tailored to your needs.`,
    
    `Looking for reliable ${title}? I offer practical solutions with a user-friendly and professional approach.`,
    
    `High-quality ${title} service focused on problem-solving, learning, and long-term value.`
  ];

  // pick random description
  const description =
    templates[Math.floor(Math.random() * templates.length)];

  res.json({
    success: true,
    description
  });
});

/* ================= IMAGE UPLOAD SETUP ================= */
const uploadDir = "uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });
app.use("/uploads", express.static("uploads"));

/* ================= AUTH ================= */

app.post("/register", (req, res) => {
  const { name, email, password } = req.body;

    // Validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters"
    });
  }

  db.query(
    "SELECT id FROM users WHERE email=?",
    [email],
    (err, result) => {
      if (result.length > 0) {
        return res.json({ success: false, message: "Email already exists" });
      }

      db.query(
        "INSERT INTO users (name, email, password) VALUES (?,?,?)",
        [name, email, password],
        () => res.json({ success: true })
      );
    }
  );
});


/* LOGIN */
app.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  db.query(
    "SELECT * FROM users WHERE email=?",
    [email],
    (err, result) => {
      if (err) {
        return res.status(500).json({ success: false });
      }

      if (result.length === 0) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }

      const user = result[0];

      if (user.password !== password) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials"
        });
      }

      res.json({
        success: true,
        user
      });
    }
  );
});



/* ================= PROFILE ================= */

/* GET USER PROFILE */
app.get("/user/:id", (req, res) => {
  db.query(
    "SELECT * FROM users WHERE id=?",
    [req.params.id],
    (err, result) => {
      if (err || result.length === 0) return res.json(null);
      res.json(result[0]);
    }
  );
});

/* UPDATE USER PROFILE (WITH IMAGE) */
app.post("/update-profile", upload.single("profile_pic"), (req, res) => {
  const {
    id,
    name,
    email,
    bio,
    skills_offered,
    skills_needed,
    location,
    experience_level,
  } = req.body;

  const profilePic = req.file ? req.file.filename : null;

  let sql = `
    UPDATE users SET
    name=?, email=?, bio=?, skills_offered=?,
    skills_needed=?, location=?, experience_level=? 
    ${profilePic ? ", profile_pic=?" : ""}
    WHERE id=?
  `;

  const params = profilePic
    ? [name, email, bio, skills_offered, skills_needed, location, experience_level, profilePic, id]
    : [name, email, bio, skills_offered, skills_needed, location, experience_level, id];

  db.query(sql, params, err => {
    if (err) {
      console.log(err);
      return res.json({ success: false });
    }
    res.json({ success: true });
  });
});


/* ================= LEARNING CONTENT ================= */

const resourceUpload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

app.post("/upload-resource", resourceUpload.single("resource"), (req, res) => {
  const { user_id, title, description, file_type } = req.body;

  if (!req.file) {
    return res.json({ success: false, message: "No file uploaded" });
  }

  db.query(
    `INSERT INTO learning_resources 
     (user_id, title, description, file_type, file_path)
     VALUES (?,?,?,?,?)`,
    [
      user_id,
      title,
      description,
      file_type,
      req.file.filename
    ],
    err => {
      if (err) {
        console.log(err);
        return res.json({ success: false });
      }
      res.json({ success: true });
    }
  );
});


app.get("/resources", (req, res) => {
  db.query(
    `SELECT lr.*, u.name 
     FROM learning_resources lr
     JOIN users u ON lr.user_id = u.id
     ORDER BY lr.created_at DESC`,
    (err, result) => {
      if (err) return res.json([]);
      res.json(result);
    }
  );
});

/* ================= SERVICES ================= */

app.post("/service", (req, res) => {
  const { user_id, user_name, title, description, hours } = req.body;

  const sql = `
    INSERT INTO services (user_id, user_name, title, description, hours)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [user_id, user_name, title, description, hours], (err) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ success: true });
  });
});

app.get("/services", (req, res) => {
  db.query("SELECT * FROM services ORDER BY id DESC", (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json([]);
    }
    res.json(result);
  });
});



/* ================= CONTACT ================= */

/* SEND MESSAGE */
app.post("/contact", (req, res) => {
  const { user_id, name, phone, subject, message } = req.body;

  if (!user_id || !name || !phone || !subject || !message) {
    return res.status(400).json({
      success: false,
      error: "All fields are required"
    });
  }

  db.query(
    `INSERT INTO contact_messages 
     (user_id, name, phone, subject, message) 
     VALUES (?,?,?,?,?)`,
    [user_id, name, phone, subject, message],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({
          success: false,
          error: "Database error"
        });
      }

      res.json({
        success: true,
        message: "Message sent successfully"
      });
    }
  );
});


// My Srvices
app.get("/my-services/:userId", (req, res) => {
  db.query(
    "SELECT * FROM services WHERE user_id=?",
    [req.params.userId],
    (err, result) => res.json(result || [])
  );
});



app.put("/service/:id", (req, res) => {
  const { title, description, hours, user_id } = req.body;
  const serviceId = req.params.id;

  db.query(
    "SELECT * FROM services WHERE id=? AND user_id=?",
    [serviceId, user_id],
    (err, result) => {
      if (err) return res.status(500).json({ success: false });

      if (result.length === 0) {
        return res.status(403).json({
          success: false,
          message: "Unauthorized access"
        });
      }

      db.query(
        "UPDATE services SET title=?, description=?, hours=? WHERE id=?",
        [title, description, hours, serviceId],
        err => {
          if (err) return res.status(500).json({ success: false });
          res.json({ success: true });
        }
      );
    }
  );
});



app.delete("/service/:id", (req, res) => {
  db.query(
    "DELETE FROM services WHERE id=?",
    [req.params.id],
    err => {
      if (err) return res.json({ success: false });
      res.json({ success: true });
    }
  );
});


/* MY RESOURCES */
app.get("/my-resources/:userId", (req, res) => {
  const { userId } = req.params;

  db.query(
    "SELECT * FROM learning_resources WHERE user_id=? ORDER BY created_at DESC",
    [userId],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.json([]);
      }
      res.json(result || []);
    }
  );
});





/* UPDATE RESOURCE */
app.put("/update-resource/:id", (req, res) => {
  const { title, description, userId } = req.body;
  const { id } = req.params;

  db.query(
    "UPDATE learning_resources SET title=?, description=? WHERE id=? AND user_id=?",
    [title, description, id, userId],
    (err, result) => {
      if (err) return res.json({ success: false });
      if (result.affectedRows === 0)
        return res.json({ success: false, message: "Unauthorized" });

      res.json({ success: true });
    }
  );
});



//Delete resouces
app.delete("/delete-resource/:id/:userId", (req, res) => {
  const { id, userId } = req.params;

  db.query(
    "SELECT file_path FROM learning_resources WHERE id=? AND user_id=?",
    [id, userId],
    (err, result) => {
      if (err || result.length === 0)
        return res.json({ success: false });

      const filePath = `./uploads/${result[0].file_path}`;

      db.query(
        "DELETE FROM learning_resources WHERE id=? AND user_id=?",
        [id, userId],
        err => {
          if (err) return res.json({ success: false });

          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          res.json({ success: true });
        }
      );
    }
  );
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});