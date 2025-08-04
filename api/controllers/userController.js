// controllers/avatarController.js
const { supabase } = require("../utils/supabaseClient");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const OpenAI = require("openai");
const fetch = require("node-fetch");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// This function handles the upload of a local file
exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const fileExtension = path.extname(file.originalname);
    const newFileName = `avatar-${userId}-${uuidv4()}${fileExtension}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(newFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: "Failed to upload avatar to storage." });
    }

    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(newFileName);
    
    const avatarUrl = publicUrlData.publicUrl;

    const { data: updateData, error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
      .select();

    if (updateError) {
      await supabase.storage.from("avatars").remove([newFileName]);
      console.error('Supabase database update error:', updateError);
      return res.status(500).json({ error: "Failed to update user avatar in the database." });
    }

    res.status(200).json({ 
      message: "Avatar uploaded and saved successfully.",
      avatar_url: avatarUrl,
      user: updateData[0]
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
};

// This function GENERATES the image and returns the URL. It does NOT save it.
exports.generateAvatar = async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }
    
    const response = await openai.images.generate({
      prompt: prompt,
      n: 1,
      size: "256x256",
    });

    const imageUrl = response.data[0].url;

    // Send the temporary URL back to the client for preview
    res.status(200).json({ 
      message: "Avatar generated successfully. Please confirm to save.",
      image_url: imageUrl
    });

  } catch (err) {
    console.error('OpenAI generation error:', err);
    res.status(500).json({ error: "Failed to generate AI avatar." });
  }
};

// This NEW function handles the confirmation and saving of the AI-generated image
exports.saveGeneratedAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { imageUrl } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required to save." });
    }

    // Fetch the image from the URL to get its buffer data
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl}`);
    }
    const imageBuffer = await imageResponse.buffer();

    // Create a unique file name
    const newFileName = `avatar-${userId}-${uuidv4()}.jpg`;

    // Upload the image buffer to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(newFileName, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return res.status(500).json({ error: "Failed to upload generated avatar." });
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
      .from("avatars")
      .getPublicUrl(newFileName);
    
    const avatarUrl = publicUrlData.publicUrl;

    // Update the user's avatar_url in the database
    const { data: updateData, error: updateError } = await supabase
      .from("users")
      .update({ avatar_url: avatarUrl })
      .eq("id", userId)
      .select();

    if (updateError) {
      await supabase.storage.from("avatars").remove([newFileName]);
      console.error('Supabase database update error:', updateError);
      return res.status(500).json({ error: "Failed to update user avatar in the database." });
    }

    res.status(200).json({ 
      message: "Avatar generated and saved successfully.",
      avatar_url: avatarUrl,
      user: updateData[0]
    });

  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
};