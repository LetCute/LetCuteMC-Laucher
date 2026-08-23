import { handleIpc } from './ipcHelper'
import {
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  setActiveProfile,
} from '../services/profile/profileService'
import { profilePackageService } from '../services/profile/profilePackageService'
import type { CreateProfileInput, UpdateProfileInput, ExportProfilePackageOptions } from '../../shared/types'

export function registerProfileIpc(): void {
  handleIpc('profiles:get', getProfiles)
  handleIpc('profiles:create', (input: CreateProfileInput) => createProfile(input))
  handleIpc('profiles:update', (profileId: string, input: UpdateProfileInput) => updateProfile(profileId, input))
  handleIpc('profiles:delete', (profileId: string) => deleteProfile(profileId))
  handleIpc('profiles:set-active', (profileId: string) => setActiveProfile(profileId))

  // Profile Package Export / Import & Sharing
  handleIpc('profiles:export-package', (options: ExportProfilePackageOptions) =>
    profilePackageService.exportProfilePackage(options)
  )
  handleIpc('profiles:read-package-info', (packageFilePath: string) =>
    profilePackageService.readPackageInfo(packageFilePath)
  )
  handleIpc('profiles:import-package', (packageFilePath: string, customName?: string) =>
    profilePackageService.importProfilePackage(packageFilePath, customName)
  )
}
