const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { supabase } = require("../utils/supabaseClient");

function calculateAge(birthday) {
  const birth = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

exports.me = async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: "No token" });
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", decoded.id)
      .limit(1);
    if (error || !users || users.length === 0)
      return res.status(404).json({ error: "User not found" });
    const user = users[0];
    delete user.password_hash;
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
};

exports.register = async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      birthday,
      gender,
      nickname,
    } = req.body;
    if (
      !first_name ||
      !last_name ||
      !email ||
      !password ||
      !birthday ||
      !gender ||
      !nickname
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }
    // Check if email or nickname exists
    let { data: existing, error: existErr } = await supabase
      .from("users")
      .select("id")
      .or(`email.eq.${email},nickname.eq.${nickname}`);
    if (existing && existing.length > 0) {
      return res
        .status(409)
        .json({ error: "Email or Nickname already exists" });
    }
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    const age = calculateAge(birthday);
    const { data, error } = await supabase
      .from("users")
      .insert([
        {
          first_name,
          last_name,
          email,
          password_hash,
          birthday,
          age,
          gender,
          nickname,
        },
      ])
      .select("id, email, nickname");
    if (error) throw error;
    const token = jwt.sign({ id: data[0].id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ user: data[0], token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password required" });
    const { data: users, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .limit(1);
    if (error || !users || users.length === 0)
      return res.status(401).json({ error: "Invalid credentials" });
    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: "Invalid credentials" });
    // Generate JWT (optional, for auth)
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({
      user: user,
      token: token,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
