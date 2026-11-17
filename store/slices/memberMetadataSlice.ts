import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Small, non-sensitive projection used only by Home's shared-path cards. */
export interface PathMemberPreview {
  id: string;
  displayLabel: string;
  hasAvatar: boolean;
  avatarUpdatedAt?: string | null;
}

export interface PathMemberMetadata {
  memberCount: number;
  memberPreviews: PathMemberPreview[];
}

export interface MemberMetadataState {
  /** The account that owns this cache. Never use a cache across accounts. */
  account: string | null;
  hydrated: boolean;
  byPathId: Record<number, PathMemberMetadata>;
}

export const initialMemberMetadataState: MemberMetadataState = {
  account: null,
  hydrated: false,
  byPathId: {},
};

export const memberMetadataSlice = createSlice({
  name: 'memberMetadata',
  initialState: initialMemberMetadataState,
  reducers: {
    hydrateMemberMetadata: (
      state,
      action: PayloadAction<{
        account: string | null;
        byPathId: Record<number, PathMemberMetadata>;
      }>
    ) => {
      state.account = action.payload.account;
      state.byPathId = action.payload.byPathId;
      state.hydrated = true;
    },
    upsertMemberMetadata: (
      state,
      action: PayloadAction<{
        pathId: number;
        metadata: PathMemberMetadata;
        account: string | null;
      }>
    ) => {
      state.account = action.payload.account;
      state.byPathId[action.payload.pathId] = action.payload.metadata;
    },
  },
});

export const { hydrateMemberMetadata, upsertMemberMetadata } = memberMetadataSlice.actions;
