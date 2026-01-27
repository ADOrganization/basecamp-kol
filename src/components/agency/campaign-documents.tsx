"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText,
  Upload,
  Download,
  Trash2,
  Loader2,
  File,
  FileImage,
  Plus,
  ExternalLink,
} from "lucide-react";

interface CampaignDocument {
  id: string;
  name: string;
  filename: string;
  type: string;
  mimeType: string;
  fileSize: number;
  description: string | null;
  createdAt: string;
}

interface CampaignDocumentsProps {
  campaignId: string;
  campaignName: string;
}

const DOCUMENT_TYPES = [
  { value: "CONTRACT", label: "Contract" },
  { value: "AGREEMENT", label: "Agreement" },
  { value: "NDA", label: "NDA" },
  { value: "INVOICE", label: "Invoice" },
  { value: "OTHER", label: "Other" },
];

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) {
    return <FileImage className="h-5 w-5 text-blue-500" />;
  }
  if (mimeType === "application/pdf") {
    return <File className="h-5 w-5 text-red-500" />;
  }
  return <FileText className="h-5 w-5 text-zinc-500" />;
}

export function CampaignDocuments({ campaignId, campaignName }: CampaignDocumentsProps) {
  const [documents, setDocuments] = useState<CampaignDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<CampaignDocument | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadType, setUploadType] = useState("CONTRACT");
  const [uploadDescription, setUploadDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch(`/api/campaigns/${campaignId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadName) {
        // Auto-fill name from filename (without extension)
        setUploadName(file.name.replace(/\.[^/.]+$/, ""));
      }
      setUploadError("");
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      setUploadError("Please select a file");
      return;
    }

    setIsUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", uploadName || uploadFile.name);
      formData.append("type", uploadType);
      if (uploadDescription) {
        formData.append("description", uploadDescription);
      }

      const response = await fetch(`/api/campaigns/${campaignId}/documents`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setShowUploadDialog(false);
        resetUploadForm();
        fetchDocuments();
      } else {
        const data = await response.json();
        setUploadError(data.error || "Failed to upload document");
      }
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedDocument) return;

    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/documents/${selectedDocument.id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setShowDeleteDialog(false);
        setSelectedDocument(null);
        fetchDocuments();
      }
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  const handleDownload = (doc: CampaignDocument) => {
    // Open in new tab for viewing
    window.open(`/api/campaigns/${campaignId}/documents/${doc.id}`, "_blank");
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadType("CONTRACT");
    setUploadDescription("");
    setUploadError("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="font-semibold">Legal Documents</h3>
          <p className="text-sm text-muted-foreground">
            Upload and manage contracts, agreements, and other legal documents
          </p>
        </div>
        <Button size="sm" onClick={() => setShowUploadDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {documents.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No documents uploaded yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Upload contracts, NDAs, and other legal documents for this campaign.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-muted-foreground">Document</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Type</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Size</th>
                <th className="text-left p-4 font-medium text-muted-foreground">Uploaded</th>
                <th className="w-[120px]"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-t hover:bg-muted/30">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      {getFileIcon(doc.mimeType)}
                      <div>
                        <p className="font-medium">{doc.name}</p>
                        {doc.description && (
                          <p className="text-sm text-muted-foreground">{doc.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className="inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium">
                      {doc.type}
                    </span>
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="p-4 text-muted-foreground">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        title="View/Download"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDocument(doc);
                          setShowDeleteDialog(true);
                        }}
                        className="text-destructive hover:text-destructive"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {uploadError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {uploadError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="file">File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={handleFileSelect}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">
                Allowed: PDF, DOC, DOCX, PNG, JPG (max 10MB)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Document Name</Label>
              <Input
                id="name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g., Client Agreement - Q1 2025"
                disabled={isUploading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Document Type</Label>
              <Select value={uploadType} onValueChange={setUploadType} disabled={isUploading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of the document"
                disabled={isUploading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={!uploadFile || isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedDocument?.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
