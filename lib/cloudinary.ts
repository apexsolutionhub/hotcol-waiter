export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME,
  );
}

export async function uploadImageToCloudinary(
  file: File,
  opts?: { folder?: string },
) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const presetName = process.env.NEXT_PUBLIC_CLOUDINARY_PRESET_NAME;

  if (!cloudName || !presetName) {
    throw new Error("Cloudinary environment variables are missing.");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", presetName);
  if (opts?.folder) {
    formData.append("folder", opts.folder);
  }

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  const data = await response.json();

  if (!response.ok || !data.secure_url) {
    throw new Error(data.error?.message || "Image upload failed.");
  }

  return data.secure_url as string;
}
