export type UserRole = 'admin' | 'annotator' | 'reviewer' | 'guest';

export interface User {
  id: string;
  username: string;
  role: UserRole;
  avatar?: string;
  createdAt: string;
}

export type ImageStatus = 'uploaded' | 'segmented' | 'recognized' | 'reviewing' | 'completed';

export interface Image {
  id: string;
  name: string;
  originalName: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  fileSize: number;
  projectId: string;
  uploadedBy: string;
  status: ImageStatus;
  blockCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type BlockStatus = 'pending' | 'confirmed' | 'rejected';

export interface TextBlock {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  recognizedText?: string;
  correctedText?: string;
  confidence?: number;
  status: BlockStatus;
  annotatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Version {
  id: string;
  imageId: string;
  versionNumber: number;
  authorId: string;
  authorName: string;
  comment?: string;
  data: TextBlock[];
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  imageCount?: number;
  memberCount?: number;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  username: string;
  role: UserRole;
  joinedAt: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface CollaborativeCursor {
  userId: string;
  username: string;
  x: number;
  y: number;
  color: string;
}

export interface BlockUpdate {
  blockId: string;
  imageId: string;
  userId: string;
  changes: Partial<TextBlock>;
}

export interface VariantCharacter {
  id: string;
  standard_char: string;
  variant_char: string;
  category: string;
  source?: string;
  description?: string;
  createdAt: string;
}

export type AnnotationType = 'comment' | 'correction' | 'question' | 'reference';

export interface Annotation {
  id: string;
  blockId?: string;
  imageId: string;
  type: AnnotationType;
  content: string;
  authorId?: string;
  authorName?: string;
  positionX?: number;
  positionY?: number;
  isPublic?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OfflineSyncItem {
  id: string;
  userId: string;
  operationType: 'create' | 'update' | 'delete';
  entityType: 'text_block' | 'annotation';
  entityId: string;
  data: any;
  status: 'pending' | 'syncing' | 'synced' | 'error';
  errorMessage?: string;
  createdAt: string;
  syncedAt?: string;
}
