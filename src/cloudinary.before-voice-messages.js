export async function uploadImage(file) {
  const formData = new FormData();

  formData.append("file", file);
  formData.append("upload_preset", "phoenix_unsigned");

  const response = await fetch(
    "https://api.cloudinary.com/v1_1/duhi1po6w/auto/upload",
    {
      method: "POST",
      body: formData,
    }
  );

  const data = await response.json();

  return data.secure_url;
}
