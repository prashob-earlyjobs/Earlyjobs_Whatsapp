import AWS from 'aws-sdk';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const bucketName = process.env.AWS_BUCKET_NAME || '';

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  mimeType: string;
}

// Upload file to S3
export const uploadToS3 = async (
  file: Buffer,
  fileName: string,
  mimeType: string,
  folder: string = 'uploads'
): Promise<UploadResult> => {
  const key = `${folder}/${uuidv4()}-${fileName}`;

  const params = {
    Bucket: bucketName,
    Key: key,
    Body: file,
    ContentType: mimeType,
    ACL: 'public-read',
  };

  try {
    const result = await s3.upload(params).promise();
    
    return {
      url: result.Location,
      key: result.Key,
      size: file.length,
      mimeType,
    };
  } catch (error) {
    console.error('S3 upload error:', error);
    throw new Error('Failed to upload file to S3');
  }
};

// Delete file from S3
export const deleteFromS3 = async (key: string): Promise<boolean> => {
  const params = {
    Bucket: bucketName,
    Key: key,
  };

  try {
    await s3.deleteObject(params).promise();
    return true;
  } catch (error) {
    console.error('S3 delete error:', error);
    return false;
  }
};

// Generate presigned URL for secure access
export const generatePresignedUrl = (key: string, expiresIn: number = 3600): string => {
  const params = {
    Bucket: bucketName,
    Key: key,
    Expires: expiresIn,
  };

  return s3.getSignedUrl('getObject', params);
};

// Multer configuration for file uploads
export const multerS3Config = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, documents, and audio files
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

// Helper function to upload multer file to S3
export const uploadMulterFileToS3 = async (
  file: Express.Multer.File,
  folder: string = 'uploads'
): Promise<UploadResult> => {
  return await uploadToS3(
    file.buffer,
    file.originalname,
    file.mimetype,
    folder
  );
};

// Get file type category
export const getFileCategory = (mimeType: string): 'image' | 'document' | 'audio' | 'other' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word')) {
    return 'document';
  }
  return 'other';
}; 