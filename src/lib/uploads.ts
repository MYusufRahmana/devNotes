export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif']
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024

export const ATTACHMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'txt', 'md', 'json', 'csv', 'zip', 'png', 'jpg', 'jpeg']
export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
  md: 'text/markdown',
  json: 'application/json',
  csv: 'text/csv',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((e) => '.' + e).join(',')

function ext(name: string) {
  return name.split('.').pop()?.toLowerCase() ?? ''
}

export function validateImage(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name}: only PNG, JPG, GIF, WEBP or AVIF images are allowed.`
  if (file.size > MAX_IMAGE_BYTES) return `${file.name}: images must be under 10 MB.`
  return null
}

/** Returns the MIME type to store, or an error message. Executables are never allowed. */
export function validateAttachment(file: File): { mime: string } | { error: string } {
  const e = ext(file.name)
  if (!ATTACHMENT_EXTENSIONS.includes(e)) {
    return { error: `${file.name}: .${e || '?'} files are not allowed. Use ${ATTACHMENT_EXTENSIONS.join(', ')}.` }
  }
  if (file.size > MAX_ATTACHMENT_BYTES) return { error: `${file.name}: attachments must be under 25 MB.` }
  return { mime: MIME_BY_EXT[e] }
}
