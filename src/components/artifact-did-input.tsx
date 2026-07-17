"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { artifactDidFromJson, artifactDidFromBytes, parseArtifactDid } from "@oma3/omatrust/identity"
import { Upload, X } from "lucide-react"

interface ArtifactDidInputProps {
  /** The resolved did:artifact value (controlled) */
  value?: string
  /** Called with the resolved did:artifact or null on error/empty */
  onChange: (did: string | null) => void
  /** External error message */
  error?: string
  /** Optional class name */
  className?: string
}

/**
 * Artifact DID Input Component
 *
 * Two input modes:
 * 1. Paste a did:artifact DID directly
 * 2. Upload a file to generate the DID from content
 *
 * When a file is uploaded, the DID field updates automatically.
 * When a DID is pasted, it is validated against the did:artifact format.
 */
export function ArtifactDidInput({
  value = "",
  onChange,
  error: externalError,
  className = "",
}: ArtifactDidInputProps) {
  const [didText, setDidText] = useState<string>(value || "")
  const [fileName, setFileName] = useState<string | null>(null)
  const [fileSize, setFileSize] = useState<number | null>(null)
  const [internalError, setInternalError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [matchedAs, setMatchedAs] = useState<"json" | "binary" | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync from external value changes
  useEffect(() => {
    if (value && value !== didText) {
      setDidText(value)
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  const getArtifactDidErrorMessage = (text: string) => {
    if (!text.startsWith("did:artifact:b")) {
      return "This isn't a valid content ID. It should start with did:artifact:b..."
    }
    return "This isn't a valid content ID. Check that the full did:artifact:b... value was copied correctly."
  }

  // Handle direct DID text input
  const handleDidTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value
    setDidText(text)
    setInternalError(null)

    if (!text.trim()) {
      onChange(null)
      return
    }

    // Validate if it looks like a complete did:artifact
    if (text.startsWith("did:artifact:")) {
      try {
        parseArtifactDid(text)
        onChange(text)
        // Clear file state since user typed directly
        setFileName(null)
        setFileSize(null)
        setMatchedAs(null)
      } catch (err) {
        setInternalError(getArtifactDidErrorMessage(text))
        onChange(null)
      }
    } else if (text.length > 5) {
      setInternalError("Must start with did:artifact:")
      onChange(null)
    }
  }

  const handleFileSelect = useCallback(async (file: File) => {
    setFileName(file.name)
    setFileSize(file.size)
    setIsProcessing(true)
    setInternalError(null)

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)

      let did: string
      const textExtensions = [".json", ".md", ".txt", ".yaml", ".yml", ".toml", ".xml", ".csv", ".html", ".css", ".js", ".ts"]
      const isTextFile = textExtensions.some(ext => file.name.toLowerCase().endsWith(ext)) || file.type.startsWith("text/")

      if (isTextFile) {
        const text = new TextDecoder().decode(bytes)
        try {
          JSON.parse(text)
          did = await artifactDidFromJson(text)
          setMatchedAs("json")
        } catch {
          did = await artifactDidFromBytes(bytes)
          setMatchedAs("binary")
        }
      } else {
        did = await artifactDidFromBytes(bytes)
        setMatchedAs("binary")
      }

      setDidText(did)
      setInternalError(null)
      onChange(did)
    } catch (err) {
      setDidText("")
      setMatchedAs(null)
      setInternalError(err instanceof Error ? err.message : "Failed to process file")
      onChange(null)
    } finally {
      setIsProcessing(false)
    }
  }, [onChange])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      void handleFileSelect(file)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFileSelect(file)
    }
  }, [handleFileSelect])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const removeFile = () => {
    setFileName(null)
    setFileSize(null)
    setDidText("")
    setMatchedAs(null)
    setInternalError(null)
    onChange(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const hasFile = fileName !== null
  const showError = externalError || internalError
  const errorMessage = externalError || internalError

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* DID text input */}
      <div className="space-y-1">
        <Label htmlFor="artifact-did">DID</Label>
        <Input
          id="artifact-did"
          type="text"
          value={didText}
          onChange={handleDidTextChange}
          placeholder="did:artifact:bafkrei..."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Paste a DID, or upload a file below to generate one.
        </p>
      </div>

      {/* File upload section */}
      <div className="space-y-1">
        <Label>Or upload file</Label>
      </div>

      {hasFile ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{fileName}</p>
            <div className="flex items-center gap-2">
              {fileSize !== null && (
                <p className="text-xs text-muted-foreground">{formatFileSize(fileSize)}</p>
              )}
              {matchedAs && (
                <p className="text-xs text-muted-foreground">
                  · {matchedAs === "json" ? "canonical JSON" : "raw bytes"}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-7 px-2 text-xs"
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={removeFile}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      ) : (
        <div
          className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            showError ? "border-destructive" : "border-border hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Upload className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag and drop, or{" "}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="font-medium text-primary underline underline-offset-2"
            >
              browse
            </button>
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Hashing content...
        </div>
      )}

      {/* Error */}
      {showError && !isProcessing && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}
    </div>
  )
}
