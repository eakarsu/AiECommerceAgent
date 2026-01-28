import { useState, useRef } from 'react';
import { useApi } from '../hooks/useApi';

export const ImageUpload = ({ productId, currentImages = [], onUploadComplete }) => {
  const [images, setImages] = useState(currentImages);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = async (files) => {
    setUploading(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append('images', file);
    });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/upload/products/${productId}/multiple`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        const newImages = [...images, ...data.files.map(f => f.url)];
        setImages(newImages);
        if (onUploadComplete) {
          onUploadComplete(newImages);
        }
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image(s)');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const newImages = images.filter((_, i) => i !== index);
    setImages(newImages);
    if (onUploadComplete) {
      onUploadComplete(newImages);
    }
  };

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-900">Product Images</h4>

      {/* Existing Images */}
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-4">
          {images.map((url, index) => (
            <div key={index} className="relative group">
              <img
                src={url.startsWith('http') ? url : `http://localhost:3001${url}`}
                alt={`Product image ${index + 1}`}
                className="w-full h-24 object-cover rounded-lg border"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
              >
                X
              </button>
              {index === 0 && (
                <span className="absolute bottom-1 left-1 bg-primary-600 text-white text-xs px-2 py-0.5 rounded">
                  Main
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          dragActive
            ? 'border-primary-500 bg-primary-50'
            : 'border-gray-300 hover:border-primary-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          onChange={handleChange}
          className="hidden"
        />

        <div className="space-y-2">
          <div className="text-4xl">
            {uploading ? (
              <span className="animate-spin">...</span>
            ) : (
              <span>+</span>
            )}
          </div>
          <p className="text-gray-600">
            {uploading
              ? 'Uploading...'
              : 'Drag and drop images here, or click to select'}
          </p>
          <p className="text-xs text-gray-400">
            Supports: JPEG, PNG, GIF, WebP (max 5MB each)
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-secondary mt-2"
          >
            Select Files
          </button>
        </div>
      </div>

      {images.length > 0 && (
        <p className="text-sm text-gray-500">
          {images.length} image(s) uploaded. The first image will be used as the main product image.
        </p>
      )}
    </div>
  );
};
