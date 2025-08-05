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
      console.error("Supabase upload error:", uploadError);
      return res
        .status(500)
        .json({ error: "Failed to upload avatar to storage." });
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
      console.error("Supabase database update error:", updateError);
      return res
        .status(500)
        .json({ error: "Failed to update user avatar in the database." });
    }

    res.status(200).json({
      message: "Avatar uploaded and saved successfully.",
      avatar_url: avatarUrl,
      user: updateData[0],
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
};

// This function GENERATES the image and returns the URL. It does NOT save it.
exports.generateAvatar = async (req, res) => {
  try {
    const { prompt, artStyle, artisticFilters } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    } // Build the powerful prompt here

    const fullPrompt = buildPrompt(prompt, artStyle, artisticFilters);
    console.log("Final prompt sent to OpenAI:", fullPrompt); // Good for debugging

    const response = await openai.images.generate({
      model: "dall-e-3", // Use DALL-E 3 for superior quality
      prompt: fullPrompt,
      n: 1,
      size: "1024x1024", // Use a larger size for better detail // You can also add 'quality: "hd"' for even better images
    });

    const imageUrl = response.data[0].url;

    res.status(200).json({
      message: "Avatar generated successfully. Please confirm to save.",
      image_url: imageUrl,
    });
  } catch (err) {
    console.error("OpenAI generation error:", err);
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
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Supabase upload error:", uploadError);
      return res
        .status(500)
        .json({ error: "Failed to upload generated avatar." });
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
      console.error("Supabase database update error:", updateError);
      return res
        .status(500)
        .json({ error: "Failed to update user avatar in the database." });
    }

    res.status(200).json({
      message: "Avatar generated and saved successfully.",
      avatar_url: avatarUrl,
      user: updateData[0],
    });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
};

const buildPrompt = (basePrompt, artStyle, artisticFilters) => {
  let styleSuffix = ""; // Add specific style keywords

  if (artStyle === "realistic") {
    styleSuffix =
      "photorealistic studio portrait, high detail, sharp focus, octane render, trending on ArtStation";
  } else if (artStyle === "anime") {
    styleSuffix =
      "anime style, digital illustration, vibrant colors, clean lines, trending on Pixiv";
  } else if (artStyle === "cartoon") {
    styleSuffix =
      "3D Pixar style, cute, cheerful, smooth shading, high resolution";
  } else if (artStyle === "pixelart") {
    styleSuffix =
      "pixel art style, 8-bit, retro gaming aesthetic, perfect pixels";
  } // Add artistic filters

  const filterKeywords = {
    "vibrant": "vibrant, saturated colors, cinematic lighting",
    "pastel": "soft pastel colors, serene lighting",
    "dark": "dark fantasy, dramatic lighting, moody atmosphere",
    "cinematic": "cinematic lighting, film grain, volumetric light",
    "high_detail": "ultra-detailed, intricate, high resolution, 4k",
    "fantasy": "fantasy aesthetic, magical, mythical",
  };

  console.log(artisticFilters)
  const additionalFilters = artisticFilters
    .map((filter) => filterKeywords[filter])
    .filter(Boolean)
    .join(", "); // Combine everything into one powerful prompt

  const finalPrompt = `${basePrompt}, ${styleSuffix}, ${additionalFilters}`;
  return finalPrompt.replace(/, +/g, ", ").trim(); // Clean up commas
};
