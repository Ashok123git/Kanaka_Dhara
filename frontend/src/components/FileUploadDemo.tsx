import { useState, type ChangeEvent } from 'react'

interface UploadState {
  file: File | null
  fileName: string | null
  successMessage: string | null
  errorMessage: string | null
  isUploading: boolean
}

const initialState: UploadState = {
  file: null,
  fileName: null,
  successMessage: null,
  errorMessage: null,
  isUploading: false,
}

export function FileUploadDemo() {
  const [state, setState] = useState<UploadState>(initialState)

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    setState(prev => ({
      ...prev,
      file,
      fileName: file?.name ?? null,
      successMessage: null,
      errorMessage: null,
    }))
  }

  const handleUpload = async () => {
    if (!state.file) {
      setState(prev => ({
        ...prev,
        successMessage: null,
        errorMessage: 'Please select a file',
      }))
      return
    }

    const formData = new FormData()
    formData.append('file', state.file)

    setState(prev => ({
      ...prev,
      isUploading: true,
      successMessage: null,
      errorMessage: null,
    }))

    try {
      const res = await fetch('/api/v1/uploads', {
        method: 'POST',
        body: formData,
      })

      const data =
        (await res
          .clone()
          .json()
          .catch(() => null)) ?? {}

      if (!res.ok) {
        const message =
          typeof (data as { detail?: string }).detail === 'string'
            ? (data as { detail: string }).detail
            : 'Upload failed'
        setState(prev => ({
          ...prev,
          isUploading: false,
          successMessage: null,
          errorMessage: message,
        }))
        return
      }

      const fileName =
        (data as { fileName?: string }).fileName ?? state.file.name
      const message =
        (data as { message?: string }).message ?? 'Upload successful'

      setState(prev => ({
        ...prev,
        isUploading: false,
        successMessage: message,
        errorMessage: null,
        fileName,
      }))
    } catch {
      setState(prev => ({
        ...prev,
        isUploading: false,
        successMessage: null,
        errorMessage: 'Network error',
      }))
    }
  }

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-lg font-semibold">File Upload Demo</h1>

      <input
        type="file"
        data-testid="file-input"
        onChange={handleFileChange}
      />

      <button
        type="button"
        data-testid="upload-button"
        onClick={handleUpload}
        disabled={state.isUploading}
        className="inline-flex items-center rounded-md border px-3 py-1 text-sm"
      >
        {state.isUploading ? 'Uploading…' : 'Upload'}
      </button>

      {state.fileName && (
        <div data-testid="uploaded-file-name" className="text-sm">
          Uploaded: {state.fileName}
        </div>
      )}

      {state.successMessage && (
        <div
          data-testid="upload-success"
          className="text-sm text-green-700"
        >
          {state.successMessage}
        </div>
      )}

      {state.errorMessage && (
        <div data-testid="upload-error" className="text-sm text-red-700">
          {state.errorMessage}
        </div>
      )}
    </div>
  )
}

