import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from '@/services/firebase';

export const BRANDING_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

const buildStorageFilename = (file: File): string =>
  `${Date.now()}_${file.name.replace(/\s+/g, '-')}`;

export const buildTournamentLogoPath = (
  tournamentId: string,
  filename: string
): string => `tournaments/${tournamentId}/branding/logo/${filename}`;

export const buildSponsorLogoPath = (
  tournamentId: string,
  sponsorId: string,
  filename: string
): string => `tournaments/${tournamentId}/branding/sponsors/${sponsorId}/${filename}`;

export const validateBrandingFile = (file: File): string | null => {
  if (!file.type.startsWith('image/')) {
    return 'Branding assets must be image files.';
  }

  if (file.size > BRANDING_MAX_FILE_SIZE_BYTES) {
    return 'Branding assets must be 2 MB or smaller.';
  }

  return null;
};

interface BrandingUploadResult {
  downloadUrl: string;
  storagePath: string;
}

const uploadBrandingAsset = async (
  storagePath: string,
  file: File
): Promise<BrandingUploadResult> => {
  const validationError = validateBrandingFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const storage = getStorage();
  const fileRef = storageRef(storage, storagePath);

  await uploadBytes(fileRef, file);

  return {
    downloadUrl: await getDownloadURL(fileRef),
    storagePath,
  };
};

export const uploadTournamentLogo = async (
  tournamentId: string,
  file: File
): Promise<BrandingUploadResult> => {
  const storagePath = buildTournamentLogoPath(
    tournamentId,
    buildStorageFilename(file)
  );

  return uploadBrandingAsset(storagePath, file);
};

export const uploadSponsorLogo = async (
  tournamentId: string,
  sponsorId: string,
  file: File
): Promise<BrandingUploadResult> => {
  const storagePath = buildSponsorLogoPath(
    tournamentId,
    sponsorId,
    buildStorageFilename(file)
  );

  return uploadBrandingAsset(storagePath, file);
};

export const deleteBrandingAsset = async (storagePath: string | null | undefined): Promise<void> => {
  if (!storagePath) {
    return;
  }

  const storage = getStorage();
  await deleteObject(storageRef(storage, storagePath));
};
