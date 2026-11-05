"use client";

import {
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { FileUp } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

function validate(file: File): string | null {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return "That file type isn't supported. Please upload a PDF.";
  if (file.size === 0) return "That file is empty. Please choose a different PDF.";
  if (file.size > MAX_BYTES) return "That file is larger than 5 MB. Please upload a smaller PDF.";
  return null;
}

interface ResumeDropzoneProps {
  onFile: (file: File) => void;
  inputRef: RefObject<HTMLInputElement>;
  disabled: boolean;
  progress: number | null;
}

export function ResumeDropzone({ onFile, inputRef, disabled, progress }: ResumeDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept(file: File | undefined) {
    if (!file) return;
    const message = validate(file);
    setError(message);
    if (!message) onFile(file);
  }

  function openPicker() {
    if (!disabled) inputRef.current?.click();
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) accept(e.dataTransfer.files[0]);
  }

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    accept(e.target.files?.[0]);
    e.target.value = "";
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openPicker();
    }
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-describedby="resume-dropzone-hint"
        onClick={openPicker}
        onKeyDown={onKeyDown}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-forest-900/25 bg-cream-100 px-6 py-12 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700 focus-visible:ring-offset-2",
          dragging && "border-forest-700 bg-lime-soft",
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-cream-200",
        )}
      >
        <FileUp className="h-8 w-8 text-forest-600" aria-hidden />
        <p className="font-medium text-forest-950">
          Drag and drop your PDF here, or <span className="underline underline-offset-4">browse</span>
        </p>
        <p id="resume-dropzone-hint" className="text-sm text-forest-900/60">
          PDF only, up to 5 MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-label="Choose a PDF resume"
        disabled={disabled}
        onChange={onChange}
      />
      {progress !== null && (
        <div className="mt-4 space-y-2" role="status">
          <Progress value={progress} aria-label="Upload progress" className="h-2" />
          <p className="text-sm text-forest-900/70">
            {progress < 100 ? `Uploading… ${progress}%` : "Upload complete. Processing your resume…"}
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-amber-800">
          {error}
        </p>
      )}
    </div>
  );
}