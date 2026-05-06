import { createClient } from '@supabase/supabase-js';

// ✅ Create admin client for storage operations
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ✅ Upload event image to Supabase Storage
 * 
 * @param {Buffer} fileBuffer - Image file buffer
 * @param {string} fileName - Original file name
 * @param {string} eventId - Event ID for organizing files
 * @returns {Promise<{success: boolean, url: string|null, error: string|null}>}
 */
export const uploadEventImage = async (fileBuffer, fileName, eventId) => {
  try {
    if (!fileBuffer || !fileName || !eventId) {
      return {
        success: false,
        url: null,
        error: 'Missing required parameters: fileBuffer, fileName, eventId',
      };
    }

    console.log('📸 Uploading event image:', {
      fileName,
      eventId,
      fileSize: fileBuffer.length,
    });

    // ✅ Generate unique file name to avoid conflicts
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${eventId}-${timestamp}-${randomString}.${fileExtension}`;
    const filePath = `event-images/${eventId}/${uniqueFileName}`;

    console.log('📝 File path:', filePath);

    // ✅ Upload to Supabase Storage
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from('event-images')
      .upload(filePath, fileBuffer, {
        contentType: getContentType(fileExtension),
        upsert: false,
      });

    if (uploadError) {
      console.error('❌ Upload error:', uploadError);
      return {
        success: false,
        url: null,
        error: uploadError.message,
      };
    }

    console.log('✅ File uploaded:', data.path);

    // ✅ Get public URL
    const { data: publicUrlData } = supabaseAdmin.storage
      .from('event-images')
      .getPublicUrl(filePath);

    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      console.error('❌ Could not generate public URL');
      return {
        success: false,
        url: null,
        error: 'Could not generate public URL for uploaded file',
      };
    }

    console.log('✅ Public URL generated:', publicUrl);

    return {
      success: true,
      url: publicUrl,
      error: null,
    };
  } catch (error) {
    console.error('❌ Image upload error:', error);
    return {
      success: false,
      url: null,
      error: error.message,
    };
  }
};

/**
 * ✅ Delete event image from Supabase Storage
 * 
 * @param {string} imageUrl - Public URL of the image
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export const deleteEventImage = async (imageUrl) => {
  try {
    if (!imageUrl) {
      return {
        success: false,
        error: 'Image URL is required',
      };
    }

    console.log('🗑️ Deleting event image:', imageUrl);

    // ✅ Extract file path from public URL
    // URL format: https://project.supabase.co/storage/v1/object/public/event-images/path/to/file
    const urlParts = imageUrl.split('/storage/v1/object/public/event-images/');
    if (urlParts.length !== 2) {
      return {
        success: false,
        error: 'Invalid image URL format',
      };
    }

    const filePath = `event-images/${urlParts[1]}`;

    // ✅ Delete from storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from('event-images')
      .remove([filePath]);

    if (deleteError) {
      console.error('❌ Delete error:', deleteError);
      return {
        success: false,
        error: deleteError.message,
      };
    }

    console.log('✅ Image deleted successfully');

    return {
      success: true,
      error: null,
    };
  } catch (error) {
    console.error('❌ Image delete error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * ✅ Get content type based on file extension
 * 
 * @param {string} extension - File extension
 * @returns {string} Content type
 */
function getContentType(extension) {
  const contentTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    pdf: 'application/pdf',
  };

  return contentTypes[extension.toLowerCase()] || 'application/octet-stream';
}
