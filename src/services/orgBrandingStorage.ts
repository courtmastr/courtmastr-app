import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadBytes,
} from '@/services/firebase';
import { validateBrandingFile } from './tournamentBrandingStorage';

export { validateBrandingFile };

const buildStorageFilename = (file: File): string =>
  `${Date.now()}_${file.name.replace(/\s+/g, '-')}`;

export const buildOrgLogoPath = (orgId: string, filename: string): string =>
  `orgs/${orgId}/logo/${filename}`;

export const buildOrgBannerPath = (orgId: string, filename: string): string =>
  `orgs/${orgId}/banner/${filename}`;

export const buildOrgSponsorLogoPath = (
  orgId: string,
  sponsorId: string,
  filename: string
): string => `orgs/${orgId}/sponsors/${sponsorId}/${filename}`;

interface BrandingUploadResult {
  downloadUrl: string;
  storagePath: string;
}

const uploadOrgAsset = async (storagePath: string, file: File): Promise<BrandingUploadResult> => {
  const validationError = validateBrandingFile(file);
  if (validationError) throw new Error(validationError);

  const storage = getStorage();
  const fileRef = storageRef(storage, storagePath);
  await uploadBytes(fileRef, file);
  return { downloadUrl: await getDownloadURL(fileRef), storagePath };
};

export const uploadOrgLogo = (orgId: string, file: File): Promise<BrandingUploadResult> =>
  uploadOrgAsset(buildOrgLogoPath(orgId, buildStorageFilename(file)), file);

export const uploadOrgBanner = (orgId: string, file: File): Promise<BrandingUploadResult> =>
  uploadOrgAsset(buildOrgBannerPath(orgId, buildStorageFilename(file)), file);

export const uploadOrgSponsorLogo = (
  orgId: string,
  sponsorId: string,
  file: File
): Promise<BrandingUploadResult> =>
  uploadOrgAsset(buildOrgSponsorLogoPath(orgId, sponsorId, buildStorageFilename(file)), file);

export const deleteOrgBrandingAsset = async (storagePath: string | null | undefined): Promise<void> => {
  if (!storagePath) {
    return;
  }

  const storage = getStorage();
  await deleteObject(storageRef(storage, storagePath));
};
