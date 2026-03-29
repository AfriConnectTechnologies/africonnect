"use client";

import { useState, useCallback, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Upload,
  X,
  Star,
  GripVertical,
  Loader2,
  ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

interface ProductImage {
  _id: Id<"productImages">;
  url: string;
  isPrimary: boolean;
  order: number;
  r2Key: string;
}

interface ImageUploaderProps {
  productId: Id<"products">;
  existingImages?: ProductImage[];
  onImagesChange?: () => void;
  maxImages?: number;
}

interface UploadingImage {
  id: string;
  file: File;
  preview: string;
  progress: number;
  status: "pending" | "uploading" | "complete" | "error";
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

// Error codes
const R2_NOT_CONFIGURED = "R2_NOT_CONFIGURED";

export function ImageUploader({
  productId,
  existingImages = [],
  onImagesChange,
  maxImages = 5,
}: ImageUploaderProps) {
  const [uploadingImages, setUploadingImages] = useState<UploadingImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveImage = useMutation(api.productImages.saveImage);
  const deleteImage = useMutation(api.productImages.deleteImage);
  const setPrimaryImage = useMutation(api.productImages.setPrimaryImage);
  const reorderImages = useMutation(api.productImages.reorderImages);

  const totalImages = existingImages.length + uploadingImages.filter(i => i.status !== "error").length;
  const canAddMore = totalImages < maxImages;

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Invalid file type. Allowed: JPEG, PNG, WebP, GIF";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 5MB limit";
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File, uploadId: string) => {
    try {
      // Update status to uploading
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, status: "uploading" as const, progress: 10 } : img
        )
      );

      // Get presigned URL from our API
      const urlResponse = await fetch("/api/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        if (error.code === R2_NOT_CONFIGURED) {
          throw new Error("Image upload is not available. Please configure R2 storage in environment variables.");
        }
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, key, publicUrl } = await urlResponse.json();

      // Update progress
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, progress: 30 } : img
        )
      );

      // Upload directly to R2
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload to storage");
      }

      // Update progress
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, progress: 70 } : img
        )
      );

      // Save image metadata to Convex
      await saveImage({
        productId,
        r2Key: key,
        url: publicUrl,
      });

      // Update progress to complete
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, status: "complete" as const, progress: 100 } : img
        )
      );

      // Remove from uploading list after a short delay
      setTimeout(() => {
        setUploadingImages((prev) => prev.filter((img) => img.id !== uploadId));
        onImagesChange?.();
      }, 500);

    } catch (error) {
      console.error("Upload error:", error);
      setUploadingImages((prev) =>
        prev.map((img) =>
          img.id === uploadId ? { ...img, status: "error" as const } : img
        )
      );
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    }
  }, [onImagesChange, productId, saveImage]);

  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const availableSlots = maxImages - totalImages;

      if (fileArray.length > availableSlots) {
        toast.error(`Can only add ${availableSlots} more image(s)`);
        fileArray.splice(availableSlots);
      }

      const newUploads: UploadingImage[] = [];

      for (const file of fileArray) {
        const error = validateFile(file);
        if (error) {
          toast.error(`${file.name}: ${error}`);
          continue;
        }

        const uploadId = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const preview = URL.createObjectURL(file);

        newUploads.push({
          id: uploadId,
          file,
          preview,
          progress: 0,
          status: "pending",
        });
      }

      if (newUploads.length > 0) {
        setUploadingImages((prev) => [...prev, ...newUploads]);

        // Start uploads
        newUploads.forEach((upload) => {
          uploadFile(upload.file, upload.id);
        });
      }
    },
    [maxImages, totalImages, uploadFile]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (!canAddMore) {
        toast.error(`Maximum ${maxImages} images allowed`);
        return;
      }

      const files = e.dataTransfer.files;
      handleFiles(files);
    },
    [canAddMore, handleFiles, maxImages]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      handleFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteImage = async (imageId: Id<"productImages">, r2Key: string) => {
    try {
      // Delete from Convex
      await deleteImage({ imageId });

      // Delete from R2
      await fetch("/api/images/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: r2Key }),
      });

      toast.success("Image deleted");
      onImagesChange?.();
    } catch (error) {
      toast.error("Failed to delete image");
      console.error(error);
    }
  };

  const handleSetPrimary = async (imageId: Id<"productImages">) => {
    try {
      await setPrimaryImage({ imageId });
      toast.success("Primary image updated");
      onImagesChange?.();
    } catch (error) {
      toast.error("Failed to set primary image");
      console.error(error);
    }
  };

  const handleRemoveUpload = (uploadId: string) => {
    setUploadingImages((prev) => {
      const upload = prev.find((img) => img.id === uploadId);
      if (upload) {
        URL.revokeObjectURL(upload.preview);
      }
      return prev.filter((img) => img.id !== uploadId);
    });
  };

  // Drag and drop reordering
  const handleImageDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleImageDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...existingImages];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);

    // Update order
    const imageIds = newOrder.map((img) => img._id);
    reorderImages({ productId, imageIds });
    setDraggedIndex(index);
  };

  const handleImageDragEnd = () => {
    setDraggedIndex(null);
    onImagesChange?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">
          Product Images ({totalImages}/{maxImages})
        </label>
        {canAddMore && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Add Images
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Drop zone */}
      {canAddMore && (
        <Card
          className={`border-2 border-dashed p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center gap-2">
            <ImageIcon className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drag and drop images here, or click to select
            </p>
            <p className="text-xs text-muted-foreground">
              JPEG, PNG, WebP, GIF up to 5MB
            </p>
          </div>
        </Card>
      )}

      {/* Image grid */}
      {(existingImages.length > 0 || uploadingImages.length > 0) && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {/* Existing images */}
          {existingImages.map((image, index) => (
            <div
              key={image._id}
              draggable
              onDragStart={() => handleImageDragStart(index)}
              onDragOver={(e) => handleImageDragOver(e, index)}
              onDragEnd={handleImageDragEnd}
              className={`group relative aspect-square overflow-hidden rounded-lg border bg-muted ${
                draggedIndex === index ? "opacity-50" : ""
              }`}
            >
              <Image
                src={image.url}
                alt={`Product image ${index + 1}`}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              />

              {/* Primary badge */}
              {image.isPrimary && (
                <div className="absolute left-2 top-2 rounded bg-yellow-500 px-2 py-0.5 text-xs font-medium text-white">
                  Primary
                </div>
              )}

              {/* Hover overlay */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8"
                  onClick={() => handleSetPrimary(image._id)}
                  title="Set as primary"
                >
                  <Star
                    className={`h-4 w-4 ${image.isPrimary ? "fill-yellow-500 text-yellow-500" : ""}`}
                  />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="h-8 w-8 cursor-grab active:cursor-grabbing"
                  title="Drag to reorder"
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="destructive"
                  className="h-8 w-8"
                  onClick={() => handleDeleteImage(image._id, image.r2Key)}
                  title="Delete"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}

          {/* Uploading images */}
          {uploadingImages.map((upload) => (
            <div
              key={upload.id}
              className="relative aspect-square overflow-hidden rounded-lg border bg-muted"
            >
              <Image
                src={upload.preview}
                alt="Uploading"
                fill
                className="object-cover"
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
              />

              {/* Upload overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                {upload.status === "uploading" || upload.status === "pending" ? (
                  <>
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                    <div className="w-3/4">
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/30">
                        <div
                          className="h-full bg-white transition-all duration-300"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    </div>
                  </>
                ) : upload.status === "error" ? (
                  <>
                    <p className="text-sm text-red-400">Failed</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleRemoveUpload(upload.id)}
                    >
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {existingImages.length === 0 && uploadingImages.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No images uploaded yet. Add at least one image for your product.
        </p>
      )}
    </div>
  );
}
