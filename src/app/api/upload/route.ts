import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!
});

export async function POST(request: Request) {
  const data = await request.formData();
  const file = data.get("file") as File;

  const buffer = Buffer.from(await file.arrayBuffer());

  const uploaded = await cloudinary.uploader.upload_stream(
    { resource_type: "video", folder: "meet-recordings" },
    (error, result) => {
      if (error) throw error;
    }
  );

  const stream = cloudinary.uploader.upload_stream(
    { resource_type: "video", folder: "meet-recordings" },
    (err, result) => {}
  );

  stream.end(buffer);

  return NextResponse.json({ status: "ok" });
}
