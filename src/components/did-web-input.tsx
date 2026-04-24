"use client"

import React, { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckIcon, AlertCircleIcon, InfoIcon } from "lucide-react"
import { normalizeDomain } from "@oma3/omatrust/identity"

interface DidWebInputProps {
  value?: string;
  onChange: (did: string | null) => void;
  className?: string;
  error?: string;
}

/**
 * Simple input for did:web identifiers
 * Shows "did:web:" prefix, user just enters domain
 */
export function DidWebInput({
  value = "",
  onChange,
  className = "",
  error: externalError,
}: DidWebInputProps) {
  const [domain, setDomain] = useState("");
  const [internalError, setInternalError] = useState<string | null>(null);

  // Parse existing DID on mount
  useEffect(() => {
    if (value && value.startsWith("did:web:")) {
      setDomain(value.replace("did:web:", ""));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDomain = e.target.value;
    setDomain(newDomain);
    setInternalError(null);

    const trimmed = newDomain.trim();
    if (!trimmed) {
      onChange(null);
      return;
    }

    const normalized = normalizeDomain(trimmed);
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;

    if (domainRegex.test(normalized)) {
      onChange(`did:web:${normalized}`);
    } else {
      onChange(null);
    }
  };

  const handleBlur = () => {
    if (!domain.trim()) {
      onChange(null);
      return;
    }

    // Basic domain validation
    const normalized = normalizeDomain(domain);
    
    // Basic domain regex
    const domainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    
    if (!domainRegex.test(normalized)) {
      setInternalError("Invalid domain format");
      onChange(null);
      return;
    }

    setDomain(normalized);
    const did = `did:web:${normalized}`;
    onChange(did);
  };

  const completeDid = domain ? `did:web:${normalizeDomain(domain)}` : "";
  const showError = externalError || internalError;
  const errorMessage = externalError || internalError;

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid gap-2">
        <Label htmlFor="did-web-domain">Domain</Label>
        <div className="flex items-center border rounded-md">
          <span className="px-3 py-2 text-sm text-muted-foreground bg-muted border-r select-none">
            did:web:
          </span>
          <Input
            id="did-web-domain"
            value={domain}
            onChange={handleChange}
            onBlur={handleBlur}
            placeholder="example.com"
            className={`border-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${showError ? "field-error" : ""}`}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Enter your domain (e.g., example.com or app.example.com)
        </p>

        {/* Error */}
        {showError && (
          <div className="feedback-error">
            <AlertCircleIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Success */}
        {!showError && domain && (
          <div className="feedback-success">
            <CheckIcon size={16} className="mt-0.5 flex-shrink-0" />
            <span>Valid domain format</span>
          </div>
        )}
      </div>

      {/* Complete DID Preview */}
      {completeDid && (
        <div className="info-panel p-3">
          <div className="flex gap-2 items-start">
            <InfoIcon size={16} className="mt-0.5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="mb-1 text-xs font-medium">
                Complete DID:
              </p>
              <code className="block break-all text-xs font-mono text-muted-foreground">
                {completeDid}
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
