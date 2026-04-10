import { useState, useEffect, useRef } from 'react'
import { Paperclip, Upload, Trash2, FileText, Image, File, Download } from 'lucide-react'
import { useAttachmentsStore } from '../../store/attachmentsStore'
import { toast } from '../../store/toastStore'
import { useTranslations } from '../../i18n'
import type { Attachment } from '../../types'

interface AttachmentsListProps {
  entityType: 'contact' | 'company' | 'deal'
  entityId: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image size={16} className="text-purple-400" />
  if (mimeType.includes('pdf')) return <FileText size={16} className="text-red-400" />
  return <File size={16} className="text-slate-400" />
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AttachmentsList({ entityType, entityId }: AttachmentsListProps) {
  const t = useTranslations()
  // Manual subscription for persisted store
  const [allAttachments, setAllAttachments] = useState(() => useAttachmentsStore.getState().attachments)
  useEffect(() => useAttachmentsStore.subscribe((s) => setAllAttachments(s.attachments)), [])

  const attachments = allAttachments.filter(a => a.entityType === entityType && a.entityId === entityId)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB limit for localStorage demo

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name} excede el límite de 5MB`)
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        useAttachmentsStore.getState().addAttachment({
          entityType,
          entityId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type || 'application/octet-stream',
          data: base64,
          uploadedBy: 'David Muñoz',
        })
        toast.success(`${file.name} adjuntado`)
      }
      reader.readAsDataURL(file)
    })
  }

  const handleDownload = (attachment: Attachment) => {
    const byteString = atob(attachment.data)
    const ab = new ArrayBuffer(byteString.length)
    const ia = new Uint8Array(ab)
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i)
    const blob = new Blob([ab], { type: attachment.mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.fileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = (id: string, fileName: string) => {
    useAttachmentsStore.getState().deleteAttachment(id)
    toast.success(`${fileName} eliminado`)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-slate-500" />
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            {t.inbox.attachments} {attachments.length > 0 && `(${attachments.length})`}
          </p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#0d0e1a] border border-white/8 text-slate-400 hover:text-white hover:border-white/15 transition-colors"
        >
          <Upload size={12} />
          {t.email.addFile}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          title={t.email.addFile}
          aria-label={t.email.addFile}
          onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
        />
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
          dragOver
            ? 'border-brand-500/50 bg-brand-500/5'
            : attachments.length === 0
              ? 'border-white/8 hover:border-white/15'
              : 'border-transparent p-0'
        }`}
      >
        {attachments.length === 0 && !dragOver && (
          <p className="text-xs text-slate-600">{t.email.attachHint}</p>
        )}
        {dragOver && (
          <p className="text-xs text-brand-400">{t.email.addFile}</p>
        )}

        {/* File list */}
        {attachments.length > 0 && (
          <div className="space-y-1.5">
            {attachments
              .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
              .map(att => (
                <div
                  key={att.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-white/3 border border-white/6 hover:border-white/10 group transition-colors"
                >
                  {getFileIcon(att.mimeType)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate">{att.fileName}</p>
                    <p className="text-[10px] text-slate-600">
                      {formatFileSize(att.fileSize)} · {formatDate(att.uploadedAt)} · {att.uploadedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleDownload(att)}
                      className="p-1 rounded text-slate-500 hover:text-brand-400 transition-colors"
                      title={t.common.export}
                    >
                      <Download size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(att.id, att.fileName)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      title={t.common.delete}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
