export interface VersionMetadata {
  added: number;
  removed: number;
  modified: number;
}

export interface VersionDto {
  id: string;
  storyboardId: string;
  createdBy: string | null;
  label: string | null;
  contentVersion: number;
  restoredFromId: string | null;
  metadata: VersionMetadata | null;
  createdAt: string; // ISO 8601
}

export interface VersionWithContentDto extends VersionDto {
  content: Record<string, unknown>;
}

export interface VersionRestoredEvent {
  storyboardId: string;
  content: Record<string, unknown>;
  contentVersion: number;
  restoredBy: string;
}
