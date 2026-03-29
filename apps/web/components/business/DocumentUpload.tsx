"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, CheckCircle2, X, FileImage } from "lucide-react";
import { toast } from "sonner";
import {
  MAX_FILE_SIZE,
  ALLOWED_DOCUMENT_TYPES,
} from "@/lib/r2";

const R2_NOT_CONFIGURED = "R2_NOT_CONFIGURED";
const DEFAULT_ACCEPT = ALLOWED_DOCUMENT_TYPES.join(",");

export type BusinessDocType =
  | "business-licence"
  | "memo-of-association"
  | "tin-certificate"
  | "import-export-permit";

interface DocumentUploadProps {
  docType: BusinessDocType;
  onUploadComplete: (url: string) => void;
  onClear?: () => void;
  existingUrl?: string | null;
  disabled?: boolean;
  accept?: string;
  label?: string;
}

export function DocumentUpload({
  docType,
  onUploadComplete,
  onClear,
  existingUrl,
  disabled = false,
  accept = DEFAULT_ACCEPT,
  label,
}: DocumentUploadProps) {
  const [status, setStatus] = useState<"idle" | "uploading" | "complete" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUrl = existingUrl ?? null;
  const hasFile = !!currentUrl || status === "complete";

  const validateFile = (file: File): string | null => {
    const types = accept.split(",").map((t) => t.trim());
    const allowed =
      types.length > 0 ? types : [...ALLOWED_DOCUMENT_TYPES];
    if (!allowed.some((t) => file.type === t)) {
      return "Invalid file type. Allowed: JPEG, PNG, WebP, GIF, PDF";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File size exceeds 5MB limit";
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setStatus("uploading");
    setProgress(10);

    try {
      const urlResponse = await fetch("/api/images/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context: "business-registration",
          docType,
          filename: file.name,
          contentType: file.type,
          fileSize: file.size,
        }),
      });

      setProgress(30);

      if (!urlResponse.ok) {
        const error = await urlResponse.json();
        if (error.code === R2_NOT_CONFIGURED) {
          throw new Error(
            "Document upload is not available. Please configure R2 storage in environment variables."
          );
        }
        throw new Error(error.error || "Failed to get upload URL");
      }

      const { uploadUrl, publicUrl } = await urlResponse.json();

      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      setProgress(70);

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload document");
      }

      setProgress(100);
      setStatus("complete");
      onUploadComplete(publicUrl);
    } catch (error) {
      console.error("Document upload error:", error);
      setStatus("error");
      toast.error(error instanceof Error ? error.message : "Failed to upload document");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      toast.error(err);
      return;
    }
    uploadFile(file);
    e.target.value = "";
  };

  const handleClear = () => {
    setStatus("idle");
    setProgress(0);
    onClear?.();
    fileInputRef.current?.form?.reset();
  };

  return (
    <div className="space-y-2">
      {label && (
        <span className="text-sm font-medium text-foreground">{label}</span>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileChange}
          disabled={disabled || status === "uploading"}
          className="hidden"
          id={`document-upload-${docType}`}
        />
        {!hasFile ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || status === "uploading"}
            onClick={() => fileInputRef.current?.click()}
          >
            {status === "uploading" ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </>
            )}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <FileImage className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {status === "complete" || currentUrl ? "Uploaded" : "Uploading..."}
            </span>
            {status === "uploading" && (
              <Progress value={progress} className="h-2 w-24" />
            )}
            {status === "complete" && (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            )}
            {(currentUrl || status === "complete") && onClear && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleClear}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
