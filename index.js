require("dotenv").config();

const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const cors = require("cors");
const cloudinary = require("./config/cloudinary");

// ================= MIDDLEWARE =================
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://perles-wons.vercel.app",
      "https://perles-wons-admin.vercel.app"
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "auth-token"]
  })
);

// ================= PORT =================
const port = process.env.PORT || 4000;

// ================= DATABASE =================
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

// ================= ROOT =================
app.get("/", (req, res) => {
  res.send("Express App is running");
});

// ================= PRODUCT MODEL =================
const Product = mongoose.model("Product", {
  id: { type: Number, required: true },
  name: { type: String, required: true },
  image: { type: String, required: true },
  category: { type: String, required: true },
  new_price: { type: Number, required: true },
  old_price: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  available: { type: Boolean, default: true }
});

// ================= ADD PRODUCT =================
app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id = products.length > 0 ? products.slice(-1)[0].id + 1 : 1;

  const product = new Product({
    id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price
  });

  await product.save();
  res.json({ success: true, name: req.body.name });
});

// ================= CLOUDINARY UPLOAD =================
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/upload", upload.single("product"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "products" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.end(req.file.buffer);
    });

    res.json({
      success: true,
      image_url: result.secure_url
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ================= REMOVE PRODUCT =================
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  res.json({ success: true });
});

// ================= GET ALL PRODUCTS =================
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({});
  res.send(products);
});

// ================= USER MODEL =================
const Users = mongoose.model("Users", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  cartData: Object,
  date: { type: Date, default: Date.now }
});

// ================= SIGNUP =================
app.post("/signup", async (req, res) => {
  let check = await Users.findOne({ email: req.body.email });

  if (check) {
    return res.status(400).json({
      success: false,
      errors: "User already exists"
    });
  }

  let cart = {};
  for (let i = 0; i < 300; i++) cart[i] = 0;

  const user = new Users({
    name: req.body.username,
    email: req.body.email,
    password: req.body.password,
    cartData: cart
  });

  await user.save();

  const token = jwt.sign(
    { user: { id: user._id } },
    process.env.JWT_SECRET
  );

  res.json({ success: true, token });
});

// ================= LOGIN =================
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });

  if (!user) {
    return res.json({ success: false, errors: "Wrong Email Id" });
  }

  if (req.body.password !== user.password) {
    return res.json({ success: false, errors: "Wrong password" });
  }

  const token = jwt.sign(
    { user: { id: user._id } },
    process.env.JWT_SECRET
  );

  res.json({ success: true, token });
});

// ================= NEW COLLECTION =================
app.get("/newcollections", async (req, res) => {
  let products = await Product.find({});
  res.send(products.slice(-8));
});

// ================= POPULAR =================
app.get("/popularinwomen", async (req, res) => {
  let products = await Product.find({ category: "accessories" });
  res.send(products.slice(0, 4));
});

// ================= AUTH MIDDLEWARE =================
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");

  if (!token) {
    return res.status(401).send({ errors: "Please authenticate" });
  }

  try {
    const data = jwt.verify(token, process.env.JWT_SECRET);
    req.user = data.user;
    next();
  } catch (error) {
    res.status(401).send({ errors: "Invalid token" });
  }
};

// ================= CART =================
app.post("/addtocart", fetchUser, async (req, res) => {
  let userData = await Users.findById(req.user.id);
  userData.cartData[req.body.itemId] += 1;

  await Users.findByIdAndUpdate(req.user.id, {
    cartData: userData.cartData
  });

  res.send("Added");
});

app.post("/removefromcart", fetchUser, async (req, res) => {
  let userData = await Users.findById(req.user.id);

  if (userData.cartData[req.body.itemId] > 0) {
    userData.cartData[req.body.itemId] -= 1;
  }

  await Users.findByIdAndUpdate(req.user.id, {
    cartData: userData.cartData
  });

  res.send("Removed");
});

app.post("/getcart", fetchUser, async (req, res) => {
  let userData = await Users.findById(req.user.id);
  res.json(userData.cartData);
});

// ================= START SERVER =================
app.listen(port, () => {
  console.log("Server running on port " + port);
});