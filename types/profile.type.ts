export interface IProfile {
    id : string;
    displayName : string;
    link : string;
    createdAt : string;
    updatedAt? : string;
    avatarUrl : string;
    avatarUploadedAt? : string | null;
    description : string;
    backgroundUrl : string;
    musicUrl?: string;
    musicTitle?: string;
    musicAuthor?: string;
    musicCoverUrl?: string;
    secondaryLinks?: string[];
}
