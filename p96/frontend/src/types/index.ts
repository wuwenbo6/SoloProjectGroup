export interface User {
  id: number
  username: string
  email: string
  role: 'ADMIN' | 'USER'
  avatar?: string
}

export interface Rubbing {
  id: number
  name: string
  description?: string
  imageUrl: string
  thumbnailUrl: string
  width: number
  height: number
  createdAt: string
  updatedAt: string
  createdBy: number
  status: 'UPLOADED' | 'PROCESSING' | 'INTERPRETED'
}

export interface Annotation {
  id?: number
  rubbingId: number
  userId: number
  x: number
  y: number
  width: number
  height: number
  text: string
  confidence?: number
  createdAt?: string
}

export interface Interpretation {
  id: number
  rubbingId: number
  userId: number
  annotations: Annotation[]
  status: 'DRAFT' | 'COMPLETED'
  createdAt: string
  updatedAt: string
}

export interface ComparisonResult {
  id: number
  interpretationIds: number[]
  diffAnnotations: Array<{
    annotationId: number
    text: string
    x: number
    y: number
    versions: Array<{
      interpretationId: number
      username: string
      text: string
      diff: string
    }>
  }>
  createdAt: string
}
